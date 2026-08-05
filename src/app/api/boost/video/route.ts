import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AVISO_PAUSADO, CHAVES, podeGerar } from "@/lib/configuracao";
import { montarPromptVideoFruta } from "@/lib/viral-boost-prompt";
import { resolverBoost, type CorpoBoost } from "@/lib/boost-servidor";
import { duracaoBoost } from "@/lib/viral-boost";
import { custoVideoLab } from "@/lib/lab-custos";
import { baixarImagemEntrada, ehImagemNossa } from "@/lib/imagem-entrada";
import { gerarVideoGrok, type ArquivoImagem } from "@/lib/video-robot";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { registrarGrokVideo } from "@/lib/gastos-api";
import { travaDeGeracao } from "@/lib/niveis";
import { criarNotificacao } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const maxDuration = 1600;

/**
 * Gera o VÍDEO da historinha de fruta: um take só, animando a cena aprovada ou
 * as fotos dos personagens. Dura 15s com uma imagem e 10s com várias (limite do
 * motor, ver duracaoBoost). Mesmo desenho do vídeo do Lab (Job em background +
 * a tela perguntando o andamento), só muda o prompt.
 */

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await podeGerar(CHAVES.geracaoVideo, user.role))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }

  let body: CorpoBoost & { imagem?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const r0 = await resolverBoost(body, user.id);
  if (!r0.ok) return NextResponse.json({ erro: r0.erro }, { status: 400 });
  const { h, frutas, cenario, formato } = r0.dados;

  /**
   * A base do vídeo. Dois caminhos:
   *  - a pessoa gerou a CENA antes: anima ela (uma imagem só);
   *  - caminho normal: manda a FOTO DE CADA PERSONAGEM (até três).
   * Quantas imagens vão daqui define a duração: uma imagem cabe em 15s, várias
   * só em 10s (o motor recusa mais de uma referência no vídeo de 15s).
   */
  const comCena = ehImagemNossa(body.imagem);
  const urls = comCena ? [body.imagem!] : frutas.map((f) => f.imagem);
  const entradas = (await Promise.all(urls.map((u) => baixarImagemEntrada(u)))).filter(
    (e) => !!e,
  );
  if (!entradas.length) {
    return NextResponse.json(
      { erro: comCena ? "Não consegui ler a cena." : "Não consegui ler as fotos dos personagens." },
      { status: 400 },
    );
  }
  const arquivos: ArquivoImagem[] = entradas.map((e) => ({
    bytes: Buffer.from(e!.base64, "base64"),
    ext: MIME_EXT[e!.mime] ?? "png",
  }));
  const [base, ...demais] = arquivos;

  // A duração sai de QUANTAS imagens vão pro motor, não do que a tela pediu:
  // com uma imagem só (um personagem, ou a cena montada) dá pra fazer 15s.
  const duracao = duracaoBoost(arquivos.length);
  const custo = custoVideoLab(duracao === 15 ? "15s" : "10s");
  const isAdmin = user.role === "admin" || user.role === "demo";
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < custo) {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo },
        { status: 402 },
      );
    }
  }

  const prompt = montarPromptVideoFruta({ h, frutas, cenario, formato, comCena, duracaoSeg: duracao });

  // Mesma trava do Lab: recarregar a página não pode virar uma segunda cobrança
  // do mesmo pedido. Historinha + personagens iguais e ainda rodando = é o mesmo.
  const assinatura = `"historinha":"${h.chave}"`;
  const emAndamento = await prisma.job.findFirst({
    where: {
      userId: user.id,
      status: { in: ["na_fila", "renderizando"] },
      criadoEm: { gte: new Date(Date.now() - 20 * 60_000) },
      opcoes: { contains: assinatura },
    },
    orderBy: { criadoEm: "desc" },
    select: { id: true, opcoes: true },
  });
  if (emAndamento) {
    let mesmosPersonagens = false;
    try {
      const o = JSON.parse(emAndamento.opcoes ?? "{}") as { entrada?: { frutas?: string[] } };
      mesmosPersonagens =
        (o.entrada?.frutas ?? []).join(",") === frutas.map((f) => f.chave).join(",");
    } catch {
      // opções ilegíveis: trata como pedido diferente
    }
    if (mesmosPersonagens) {
      return NextResponse.json({ ok: true, jobId: emAndamento.id, custo: 0, jaRodando: true });
    }
  }

  // Trava por nível da conta (depois do dedup: pedido repetido reconecta no job
  // que já roda em vez de esbarrar no limite de simultâneos).
  if (!isAdmin) {
    const trava = await travaDeGeracao(user);
    if (!trava.ok) {
      return NextResponse.json({ erro: trava.erro }, { status: trava.status });
    }
  }

  const nomeVideo = `${h.nome} (${frutas.map((f) => f.nome).join(" e ")})`.slice(0, 255);
  const job = await prisma.job.create({
    data: {
      userId: user.id,
      produto: nomeVideo,
      tipo: "produto",
      formato: "legenda",
      variantes: 1,
      status: "renderizando",
      etapa: "Gravando a sua historinha (3 a 5 min)",
      duracao,
      opcoes: JSON.stringify({
        boost: true,
        entrada: {
          imagem: body.imagem ?? null,
          formato,
          historinha: h.chave,
          cenario,
          frutas: frutas.map((f) => f.chave),
        },
      }),
    },
  });

  const userId = user.id;
  after(async () => {
    try {
      const r = await gerarVideoGrok({
        prompt,
        avatar: base,
        produtos: demais,
        duracaoSeg: duracao,
        qualidade: "720p",
      });

      if (!r.ok || !r.videoUrl) {
        await prisma.job
          .update({
            where: { id: job.id },
            data: { status: "erro", etapa: null, erro: r.erro ?? "Falha ao gerar o vídeo." },
          })
          .catch(() => {});
        await criarNotificacao({
          userId,
          tipo: "video_erro",
          titulo: "Falha ao gerar sua historinha",
          mensagem: `Não consegui gerar "${nomeVideo}". Tente de novo (não descontamos créditos).`,
          link: "/painel/viral-boost",
          jobId: job.id,
        }).catch(() => {});
        return;
      }

      if (!isAdmin) {
        await debitarClamp(userId, custo, "debito_geracao", {
          descricao: `Historinha de fruta (${h.nome})`,
          jobId: job.id,
        }).catch(() => {});
      }

      // contabilidade do dono (aba Finanças): custo médio do Grok por vídeo
      await registrarGrokVideo(userId, job.id, duracao, "boost-video").catch(() => {});

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "pronto",
          etapa: null,
          saidas: JSON.stringify([r.videoUrl]),
          midias: JSON.stringify([
            { arquivo: r.videoUrl, ...(r.thumbUrl ? { thumb: r.thumbUrl } : {}) },
          ]),
        },
      });
      await criarNotificacao({
        userId,
        tipo: "video_pronto",
        titulo: "Sua historinha ficou pronta!",
        mensagem: `"${nomeVideo}" já está em Meus vídeos.`,
        link: "/painel",
        jobId: job.id,
      }).catch(() => {});
    } catch (e) {
      console.error("[boost-video] geração em background falhou", e);
      await prisma.job
        .update({
          where: { id: job.id },
          data: { status: "erro", etapa: null, erro: "Falha inesperada ao gerar. Tente de novo." },
        })
        .catch(() => {});
    }
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    custo: isAdmin ? 0 : custo,
    ...(user.role === "admin" ? { prompt } : {}),
  });
}
