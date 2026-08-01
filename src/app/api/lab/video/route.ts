import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AVISO_PAUSADO, CHAVES, estaLigado } from "@/lib/configuracao";
import { duracaoPorChave } from "@/lib/lab-video";
import { montarPromptVideoLab } from "@/lib/lab-video-prompt";
import { custoVideoLab } from "@/lib/lab-custos";
import { baixarImagemEntrada } from "@/lib/imagem-entrada";
import { gerarVideoGrok, type ArquivoImagem } from "@/lib/video-robot";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { criarNotificacao } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const maxDuration = 1600;

/**
 * Gera o VÍDEO do Viraliza Lab a partir da imagem da etapa anterior.
 *
 * Assíncrono como o "Vídeo com avatar": cria o Job na hora e responde o jobId; a
 * geração roda em background (after) e a tela vai perguntando o andamento em
 * GET /api/lab/video/<id>. A imagem é a única referência que vai pro motor, então
 * pessoa, produto e cenário já estão travados. Falha não cobra crédito.
 */

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await estaLigado(CHAVES.geracaoVideo))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }

  let body: {
    imagem?: string; // URL da imagem base (gerada no Lab ou a que a pessoa subiu)
    duracao?: string;
    tom?: string;
    voz?: string;
    tonalidade?: string;
    fala?: string;
    instrucoes?: string;
    movimento?: string | null;
    produtoNome?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const dur = duracaoPorChave(body.duracao);
  if (!dur) return NextResponse.json({ erro: "Escolha a duração do vídeo." }, { status: 400 });

  const entrada = await baixarImagemEntrada(body.imagem);
  if (!entrada) {
    return NextResponse.json({ erro: "Não consegui ler a imagem da cena." }, { status: 400 });
  }
  const base: ArquivoImagem = {
    bytes: Buffer.from(entrada.base64, "base64"),
    ext: MIME_EXT[entrada.mime] ?? "png",
  };

  const custo = custoVideoLab(dur.chave);
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

  const escolhas = {
    duracao: dur.chave,
    tom: body.tom,
    voz: body.voz,
    tonalidade: body.tonalidade,
    fala: typeof body.fala === "string" ? body.fala.trim().slice(0, 600) : "",
    instrucoes: typeof body.instrucoes === "string" ? body.instrucoes.slice(0, 600) : "",
    produtoNome: typeof body.produtoNome === "string" ? body.produtoNome.slice(0, 160) : "",
    movimento: body.movimento ?? undefined,
  };
  const prompt = montarPromptVideoLab(escolhas);
  if (!prompt) {
    return NextResponse.json({ erro: "Não consegui montar o roteiro." }, { status: 400 });
  }

  const nomeVideo = (escolhas.produtoNome?.trim() || "Vídeo do Lab").slice(0, 255);
  const job = await prisma.job.create({
    data: {
      userId: user.id,
      produto: nomeVideo,
      tipo: "produto",
      formato: "legenda",
      variantes: 1,
      status: "renderizando",
      etapa: "A IA está gravando seu vídeo (3 a 5 min)",
      duracao: dur.segundos,
      opcoes: JSON.stringify({ lab: true, entrada: { imagem: body.imagem ?? null, ...escolhas } }),
    },
  });

  const userId = user.id;
  after(async () => {
    try {
      const r = await gerarVideoGrok({
        prompt,
        avatar: base,
        produtos: [],
        duracaoSeg: dur.segundos,
        qualidade: "720p",
        semAudio: !dur.comFala,
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
          titulo: "Falha ao gerar seu vídeo",
          mensagem: `Não consegui gerar "${nomeVideo}". Tente de novo (não descontamos créditos).`,
          link: "/painel/lab",
          jobId: job.id,
        }).catch(() => {});
        return;
      }

      // cobra SÓ agora que o vídeo saiu (falha não desconta)
      if (!isAdmin) {
        await debitarClamp(userId, custo, "debito_geracao", {
          descricao: `Vídeo do Lab (${dur.segundos}s, ${dur.comFala ? "com fala" : "sem fala"})`,
          jobId: job.id,
        }).catch(() => {});
      }

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
        titulo: "Seu vídeo do Lab ficou pronto!",
        mensagem: `"${nomeVideo}" já está em Meus vídeos.`,
        link: "/painel",
        jobId: job.id,
      }).catch(() => {});
    } catch (e) {
      console.error("[lab-video] geração em background falhou", e);
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
