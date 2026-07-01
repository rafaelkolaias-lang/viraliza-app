import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";
import { pastaSaida, pastaEntrada } from "@/lib/jobs";
import { custoCreditos, CREDITOS_FIXO, type Consumo } from "@/lib/precos";
import { debitarClamp, jobJaDebitado } from "@/lib/creditos";
import { notificarJobPronto } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "video.mp4";
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
  try {
    if (await jobJaDebitado(job.id)) return;
    const dono = await prisma.user.findUnique({
      where: { id: job.userId },
      select: { role: true },
    });
    if (!dono || dono.role === "admin" || dono.role === "demo") return;

    let consumo: Consumo = {};
    try {
      consumo = JSON.parse(String(consumoRaw ?? "{}")) as Consumo;
    } catch {}

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
    await debitarClamp(job.userId, creditos, tipo, {
      descricao: desc,
      jobId: job.id,
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
    await prisma.job.update({
      where: { id },
      data: { status: "pronto", duracao, erro: null, etapa: null },
    });
    await notificarJobPronto(job).catch(() => {});
    await fs.rm(pastaEntrada(id), { recursive: true, force: true }).catch(() => {});
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

    // acumula no estado já salvo (parte 0 começa do zero - cobre re-runs)
    let saidas: string[] = [];
    let midias: Midia[] = [];
    if (parte > 0) {
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

    saidas[parte] = arquivo;
    midias[parte] = {
      arquivo,
      driveId,
      thumbDriveId,
      thumb,
      legenda: String(form.get("legenda") ?? "") || undefined,
      hashtags: String(form.get("hashtags") ?? "") || undefined,
    };

    const duracao = Number(form.get("duracao") ?? 0) || job.duracao || null;
    const final = total > 0 && parte + 1 >= total;
    await prisma.job.update({
      where: { id },
      data: {
        status: final ? "pronto" : "processando",
        duracao,
        saidas: JSON.stringify(saidas),
        midias: JSON.stringify(midias),
        erro: null,
      },
    });
    if (final) {
      await notificarJobPronto(job).catch(() => {});
      await fs.rm(pastaEntrada(id), { recursive: true, force: true }).catch(() => {});
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
  await prisma.job.update({
    where: { id },
    data: {
      status: "pronto",
      duracao,
      saidas: JSON.stringify(saidas),
      midias: JSON.stringify(midias),
      erro: null,
      etapa: null,
    },
  });
  await notificarJobPronto(job).catch(() => {});

  // limpa a mídia de entrada (não precisa mais - economiza disco)
  await fs.rm(pastaEntrada(id), { recursive: true, force: true }).catch(() => {});

  return NextResponse.json({ ok: true, saidas });
}
