import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";
import { pastaSaida } from "@/lib/jobs";
import { custoCreditos, CREDITOS_FIXO, type Consumo } from "@/lib/precos";
import { debitarClamp, jobJaDebitado } from "@/lib/creditos";
import { registrarConsumoJob } from "@/lib/gastos-api";
import { notificarJobPronto } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "video.mp4";
}

type Opcoes = Record<string, unknown>;

function lerOpcoes(job: { opcoes: string | null }): Opcoes {
  try {
    const o = JSON.parse(job.opcoes ?? "{}");
    return o && typeof o === "object" ? (o as Opcoes) : {};
  } catch {
    return {};
  }
}

/**
 * Guarda no job as FAIXAS DE ÁUDIO separadas que o render produziu (som do
 * vídeo, música e narração) e apaga o pedido de reajuste que acabou de rodar.
 * São essas faixas que deixam o botão "Reajustar áudio" refazer só o som depois,
 * em segundos e sem cobrar de novo. Devolve `undefined` quando nada mudou.
 */
function opcoesAtualizadas(
  job: { opcoes: string | null },
  form: FormData,
): string | undefined {
  const antes = lerOpcoes(job);
  const depois: Opcoes = { ...antes };
  let mudou = false;

  const bruto = form.get("stems");
  if (typeof bruto === "string" && bruto.trim()) {
    try {
      const s = JSON.parse(bruto) as { total?: number } & Record<string, unknown>;
      if (s && typeof s === "object") {
        depois.stems = {
          orig: typeof s.orig === "string" ? s.orig : undefined,
          musica: typeof s.musica === "string" ? s.musica : undefined,
          voz: typeof s.voz === "string" ? s.voz : undefined,
        };
        depois.stemsDur = Number(s.total) || undefined;
        if (s.volumes) depois.volumes = s.volumes;
        mudou = true;
      }
    } catch {}
  }
  if (depois.remix) {
    // o reajuste pedido já foi aplicado: some com ele pra não repetir
    delete depois.remix;
    mudou = true;
  }
  return mudou ? JSON.stringify(depois) : undefined;
}

/**
 * Debita o custo do job no dono (pós-pago, pelo consumo REAL que o worker mediu).
 * Sem uso de API => preço fixo de processamento. Admin/demo não pagam. Idempotente.
 * Nunca derruba a entrega do vídeo (falha em silêncio).
 */
async function debitarJob(
  job: { id: string; userId: string; tipo: string },
  consumoRaw: FormDataEntryValue | null,
) {
  let consumo: Consumo = {};
  try {
    consumo = JSON.parse(String(consumoRaw ?? "{}")) as Consumo;
  } catch {}

  // Contabilidade do DONO (aba Finanças): grava o gasto real de API do job.
  // Fica FORA do débito de créditos de propósito: job de admin/demo não paga
  // crédito, mas a API cobrou do mesmo jeito. Idempotente por jobId.
  await registrarConsumoJob(
    job.userId,
    job.id,
    consumo,
    job.tipo === "cortes" ? "cortes" : "fabrica",
  ).catch(() => {});

  try {
    if (await jobJaDebitado(job.id)) return;
    const dono = await prisma.user.findUnique({
      where: { id: job.userId },
      select: { role: true },
    });
    if (!dono || dono.role === "admin" || dono.role === "demo") return;

    let creditos = custoCreditos(consumo);
    let tipo: "debito_geracao" | "debito_processamento" = "debito_geracao";
    let desc = "Geração de vídeo";
    if (creditos <= 0) {
      // não usou API de IA => cobra o preço fixo de processamento
      creditos = job.tipo === "marca" ? CREDITOS_FIXO.lote : CREDITOS_FIXO.editorManual;
      tipo = "debito_processamento";
      desc =
        job.tipo === "marca"
          ? "Marca em lote (processamento)"
          : "Edição (processamento)";
    }
    // o que não couber no saldo vira saldo devedor (auditoria #8/#36): sem isso,
    // gerar vários vídeos da fábrica com 1 crédito fazia o excedente sumir. As
    // rotas de vídeo do Grok já usavam faltaViraDivida; a fábrica/editor/cortes
    // (que fecham por aqui) tinham ficado de fora.
    await debitarClamp(job.userId, creditos, tipo, {
      descricao: desc,
      jobId: job.id,
      faltaViraDivida: true,
    });
  } catch {
    /* débito nunca derruba a entrega */
  }
}

/**
 * Worker terminou de renderizar: sobe os .mp4 prontos (multipart) + a duração.
 * Salva em public/videos/<id>/ e marca o job como "pronto".
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ erro: "job não existe" }, { status: 404 });

  // Excluído durante a geração (auditoria #28): a pessoa apagou o card e o robô
  // terminou depois. Aceita o resultado e descarta - gravar "pronto" por cima
  // faria o vídeo apagado reaparecer na lista, com notificação e cobrança.
  if (job.status === "excluido") {
    return NextResponse.json({ ok: true, ignorado: "excluido" });
  }

  const form = await req.formData();

  type Midia = {
    /** caminho local (/videos/..) OU URL pública direta (https://media...) do vídeo */
    arquivo: string;
    driveId?: string;
    thumbDriveId?: string;
    thumb?: string;
    legenda?: string;
    hashtags?: string;
  };

  // ---- FINALIZAR: fecha o job depois do streaming de partes (sem mandar vídeo) ----
  // Usado quando o worker sobe cada corte assim que fica pronto e só no fim sabe o total.
  if (form.get("finalizar") !== null) {
    const duracao = Number(form.get("duracao") ?? 0) || job.duracao || null;
    let midias: Midia[] = [];
    try {
      midias = JSON.parse(job.midias ?? "[]");
    } catch {}
    const validas = midias.filter((m) => m && (m.driveId || m.arquivo));
    if (validas.length === 0) {
      return NextResponse.json({ erro: "nenhum corte recebido" }, { status: 400 });
    }
    // debita ANTES de marcar "pronto": garante que o crédito gasto já aparece
    // no mesmo refresh em que o vídeo fica pronto (sem precisar de F5).
    await debitarJob(job, form.get("consumo"));
    const opcoesFinal = opcoesAtualizadas(job, form);
    // condicional no status (auditoria #28): se a pessoa excluiu o job entre a
    // leitura lá em cima e agora, o "pronto" não pode ressuscitar o card
    const r = await prisma.job.updateMany({
      where: { id, status: { not: "excluido" } },
      data: {
        status: "pronto",
        duracao,
        erro: null,
        etapa: null,
        ...(opcoesFinal ? { opcoes: opcoesFinal } : {}),
      },
    });
    if (r.count > 0) await notificarJobPronto(job).catch(() => {});
    // a mídia de entrada NÃO é mais apagada aqui: fica 24h no servidor pro
    // "Editar novamente" reusar (tarefa 21; limpeza no instrumentation.ts)
    return NextResponse.json({ ok: true, total: validas.length, final: true });
  }

  // ---- modo INCREMENTAL: 1 vídeo por request (evita 413 com muitos cortes) ----
  // O worker manda parte=0..N; status fica "processando" até o finalizar (ou total).
  const parteRaw = form.get("parte");
  if (parteRaw !== null) {
    const parte = Math.max(0, Number(parteRaw) || 0);
    const total = Number(form.get("total") ?? 0) || 0; // 0 = streaming (fecha no finalizar)
    const driveId = String(form.get("driveId") ?? "").trim() || undefined;
    const thumbDriveId = String(form.get("thumbDriveId") ?? "").trim() || undefined;
    // URL pública direta (serverrk/Cloudflare) - o vídeo já está hospedado, só metadados
    const urlMidia = String(form.get("url") ?? "").trim() || undefined;
    const thumbUrl = String(form.get("thumbUrl") ?? "").trim() || undefined;
    const file = form.get("video");
    // aceita: bytes do vídeo OU só metadados (driveId do Drive OU url pública direta)
    if (!(file instanceof File) && !driveId && !urlMidia) {
      return NextResponse.json({ erro: "nenhum vídeo enviado" }, { status: 400 });
    }

    const dir = pastaSaida(id);
    await fs.mkdir(dir, { recursive: true });

    // acumula no estado já salvo (parte 0 começa do zero - cobre re-runs).
    // No reajuste de áudio o vídeo é SUBSTITUÍDO: aí a parte 0 precisa do estado
    // anterior pra não perder a legenda e as hashtags que já estavam prontas.
    const ehRemix = !!lerOpcoes(job).remix;
    let saidas: string[] = [];
    let midias: Midia[] = [];
    if (parte > 0 || ehRemix) {
      try {
        saidas = JSON.parse(job.saidas ?? "[]");
      } catch {}
      try {
        midias = JSON.parse(job.midias ?? "[]");
      } catch {}
    }

    // URL pública direta (serverrk) tem prioridade; senão grava os bytes localmente;
    // quando é Drive (driveId) o arquivo fica vazio e a mídia toca pelo driveId.
    let arquivo = "";
    if (urlMidia) {
      arquivo = urlMidia;
    } else if (file instanceof File) {
      const nome = `corte-${parte + 1}.mp4`;
      await fs.writeFile(path.join(dir, nome), Buffer.from(await file.arrayBuffer()));
      arquivo = `/videos/${id}/${nome}`;
    }

    let thumb: string | undefined;
    if (thumbUrl) {
      thumb = thumbUrl;
    } else {
      const t = form.get("thumb");
      if (t instanceof File) {
        const tnome = `thumb-${parte}.jpg`;
        await fs.writeFile(path.join(dir, tnome), Buffer.from(await t.arrayBuffer()));
        thumb = `/videos/${id}/${tnome}`;
      }
    }

    const antes = midias[parte];
    saidas[parte] = arquivo;
    midias[parte] = {
      arquivo,
      driveId,
      thumbDriveId,
      thumb: thumb ?? (ehRemix ? antes?.thumb : undefined),
      legenda: String(form.get("legenda") ?? "") || (ehRemix ? antes?.legenda : undefined),
      hashtags: String(form.get("hashtags") ?? "") || (ehRemix ? antes?.hashtags : undefined),
    };

    const duracao = Number(form.get("duracao") ?? 0) || job.duracao || null;
    const final = total > 0 && parte + 1 >= total;
    // fechar pelo `total` também COBRA (auditoria #12): esse caminho marcava
    // "pronto" direto e entregava o vídeo de graça - o worker atual fecha pelo
    // "finalizar", mas qualquer variante que use `total` caía no buraco. Sem
    // consumo no form, o debitarJob cobra o preço fixo de processamento.
    if (final) await debitarJob(job, form.get("consumo"));
    const opcoesParte = final ? opcoesAtualizadas(job, form) : undefined;
    // condicional no status (auditoria #28): job excluído não volta pra lista
    const r = await prisma.job.updateMany({
      where: { id, status: { not: "excluido" } },
      data: {
        status: final ? "pronto" : "processando",
        duracao,
        saidas: JSON.stringify(saidas),
        midias: JSON.stringify(midias),
        erro: null,
        ...(opcoesParte ? { opcoes: opcoesParte } : {}),
      },
    });
    if (final && r.count > 0) {
      await notificarJobPronto(job).catch(() => {});
      // entrada retida por 24h pro reuso (tarefa 21; limpeza no instrumentation.ts)
    }
    return NextResponse.json({ ok: true, parte, total, final });
  }

  // ---- modo BATCH (compat): todos os vídeos num request só ----
  const arquivos = form.getAll("videos").filter((f): f is File => f instanceof File);
  const duracao = Number(form.get("duracao") ?? 0) || null;

  // legendas/hashtags por variante (mesma ordem dos vídeos)
  let legendas: { legenda?: string; hashtags?: string }[] = [];
  try {
    legendas = JSON.parse(String(form.get("legendas") ?? "[]"));
  } catch {
    legendas = [];
  }

  if (arquivos.length === 0) {
    return NextResponse.json({ erro: "nenhum vídeo enviado" }, { status: 400 });
  }

  const dir = pastaSaida(id);
  await fs.mkdir(dir, { recursive: true });

  const saidas: string[] = [];
  const midias: {
    arquivo: string;
    thumb?: string;
    legenda?: string;
    hashtags?: string;
  }[] = [];

  for (let i = 0; i < arquivos.length; i++) {
    const file = arquivos[i];
    const nome = nomeSeguro(file.name);
    await fs.writeFile(path.join(dir, nome), Buffer.from(await file.arrayBuffer()));
    const arquivo = `/videos/${id}/${nome}`;
    saidas.push(arquivo);

    // miniatura dessa variante (thumb_0, thumb_1, ...)
    let thumb: string | undefined;
    const t = form.get(`thumb_${i}`);
    if (t instanceof File) {
      const tnome = `thumb-${i}.jpg`;
      await fs.writeFile(path.join(dir, tnome), Buffer.from(await t.arrayBuffer()));
      thumb = `/videos/${id}/${tnome}`;
    }

    midias.push({
      arquivo,
      thumb,
      legenda: legendas[i]?.legenda || undefined,
      hashtags: legendas[i]?.hashtags || undefined,
    });
  }

  // debita ANTES de marcar "pronto" (crédito visível no mesmo refresh do pronto)
  await debitarJob(job, form.get("consumo"));
  const opcoesBatch = opcoesAtualizadas(job, form);
  // condicional no status (auditoria #28): job excluído não volta pra lista
  const rBatch = await prisma.job.updateMany({
    where: { id, status: { not: "excluido" } },
    data: {
      status: "pronto",
      duracao,
      saidas: JSON.stringify(saidas),
      midias: JSON.stringify(midias),
      erro: null,
      etapa: null,
      ...(opcoesBatch ? { opcoes: opcoesBatch } : {}),
    },
  });
  if (rBatch.count > 0) await notificarJobPronto(job).catch(() => {});

  // a mídia de entrada fica 24h no servidor pro "Editar novamente" reusar
  // (tarefa 21); quem apaga é a varredura periódica do instrumentation.ts

  return NextResponse.json({ ok: true, saidas });
}
