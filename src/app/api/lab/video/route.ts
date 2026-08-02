import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AVISO_PAUSADO, CHAVES, podeGerar } from "@/lib/configuracao";
import { duracaoPorChave, vaiTerFala } from "@/lib/lab-video";
import { montarPromptVideoLab } from "@/lib/lab-video-prompt";
import { movimentoCompativel } from "@/lib/movimentos";
import { custoVideoLab } from "@/lib/lab-custos";
import { baixarImagemEntrada, ehImagemNossa } from "@/lib/imagem-entrada";
import { gerarVideoGrok, type ArquivoImagem } from "@/lib/video-robot";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { criarNotificacao } from "@/lib/notificacoes";
import { contarVideoDaImagem } from "@/lib/galeria-servidor";

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
  if (!(await podeGerar(CHAVES.geracaoVideo, user.role))) {
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
    pov?: boolean;
    semMaos?: boolean; // POV "produto parado": ninguém na foto
    semFala?: boolean; // a pessoa pediu vídeo mudo numa duração que aceita fala
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const dur = duracaoPorChave(body.duracao);
  if (!dur) return NextResponse.json({ erro: "Escolha a duração do vídeo." }, { status: 400 });

  // a imagem base só pode ser uma das nossas (gerada aqui ou subida pra cá)
  if (!ehImagemNossa(body.imagem)) {
    return NextResponse.json({ erro: "Imagem inválida. Gere a cena de novo." }, { status: 400 });
  }
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

  // O movimento tem que combinar com a imagem: POV só anima movimento de POV e
  // cena com pessoa nunca anima POV. A tela já filtra, mas quem decide é aqui.
  const movimento = movimentoCompativel(body.movimento, {
    temPessoa: !body.pov,
    temMaos: !body.pov || !body.semMaos,
  });

  const escolhas = {
    duracao: dur.chave,
    tom: body.tom,
    voz: body.voz,
    tonalidade: body.tonalidade,
    fala: typeof body.fala === "string" ? body.fala.trim().slice(0, 600) : "",
    instrucoes: typeof body.instrucoes === "string" ? body.instrucoes.slice(0, 600) : "",
    produtoNome: typeof body.produtoNome === "string" ? body.produtoNome.slice(0, 160) : "",
    movimento: movimento?.chave,
    pov: !!body.pov,
    semMaos: !!body.pov && !!body.semMaos,
    semFala: !!body.semFala,
  };
  // fala de verdade = a duração aceita E a pessoa não pediu mudo
  const comFala = vaiTerFala(dur.chave, escolhas.semFala);
  const prompt = montarPromptVideoLab(escolhas);
  if (!prompt) {
    return NextResponse.json({ erro: "Não consegui montar o roteiro." }, { status: 400 });
  }

  /**
   * Trava de pedido repetido.
   *
   * A tela trava o botão enquanto gera, mas isso se perde se a pessoa recarrega
   * ou sai e volta pro Lab: ela clica de novo achando que não funcionou e paga
   * outra vez pelo mesmo vídeo (aconteceu: 3 cobranças do mesmo pedido em 3
   * minutos). Se já existe um vídeo em andamento com a MESMA imagem e a MESMA
   * fala, devolve aquele em vez de abrir outro.
   */
  const emAndamento = await prisma.job.findFirst({
    where: {
      userId: user.id,
      status: { in: ["na_fila", "renderizando"] },
      criadoEm: { gte: new Date(Date.now() - 20 * 60_000) },
      opcoes: { contains: body.imagem! },
    },
    orderBy: { criadoEm: "desc" },
    select: { id: true, opcoes: true },
  });
  if (emAndamento) {
    let mesmaFala = false;
    try {
      const o = JSON.parse(emAndamento.opcoes ?? "{}") as { entrada?: { fala?: string } };
      mesmaFala = (o.entrada?.fala ?? "") === escolhas.fala;
    } catch {
      // opções ilegíveis: trata como pedido diferente e deixa gerar
    }
    if (mesmaFala) {
      return NextResponse.json({
        ok: true,
        jobId: emAndamento.id,
        custo: 0,
        jaRodando: true,
      });
    }
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
        semAudio: !comFala,
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
          descricao: `Vídeo do Lab (${dur.segundos}s, ${comFala ? "com fala" : "sem fala"})`,
          jobId: job.id,
        }).catch(() => {});
      }

      // "3 vídeos gerados" no card da galeria: conta um a mais pra imagem base
      await contarVideoDaImagem(userId, body.imagem);

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
