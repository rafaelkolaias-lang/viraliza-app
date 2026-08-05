import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";
import { pastaEntrada } from "@/lib/jobs";
import { decifrar } from "@/lib/cripto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function listar(jobId: string, sub: string): Promise<string[]> {
  try {
    return await fs.readdir(path.join(pastaEntrada(jobId), sub));
  } catch {
    return [];
  }
}

/**
 * Worker pede o próximo job da fila. Marca como "renderizando" e devolve os dados +
 * a lista de arquivos de entrada (que o worker baixa em /api/worker/entrada/...).
 */
export async function GET(req: Request) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  // Claim ATÔMICO: com vários workers em paralelo, garante que só UM pega cada job
  // (senão dois renderizam o mesmo e gastam crédito em dobro). O updateMany com
  // guarda "status: na_fila" é atômico no MySQL; quem conseguir count===1 ficou com ele.
  let job = null as Awaited<ReturnType<typeof prisma.job.findUnique>>;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const cand = await prisma.job.findFirst({
      where: { status: "na_fila" },
      orderBy: { criadoEm: "asc" },
      select: { id: true },
    });
    if (!cand) break;
    const claim = await prisma.job.updateMany({
      where: { id: cand.id, status: "na_fila" },
      data: { status: "renderizando", erro: null },
    });
    if (claim.count === 1) {
      job = await prisma.job.findUnique({ where: { id: cand.id } });
      break;
    }
    // outro worker pegou esse antes; tenta o próximo da fila
  }

  if (!job) return NextResponse.json({ job: null });

  const [videos, imagens, musica, template] = await Promise.all([
    listar(job.id, "videos"),
    listar(job.id, "imagens"),
    listar(job.id, "musica"),
    listar(job.id, "template"),
  ]);

  // Reajuste de áudio: o vídeo já existe e a mídia de entrada foi apagada quando
  // ele ficou pronto. Esse job não precisa de entrada nenhuma, então escapa da
  // defesa abaixo (senão morreria com "a mídia não chegou no servidor").
  let ehRemix = false;
  try {
    const o = JSON.parse(job.opcoes ?? "{}");
    ehRemix = !!(o && typeof o === "object" && o.remix);
  } catch {}

  // defesa: job de produto sem NENHUMA mídia e sem fonte não vai pro worker (a
  // fábrica montaria 0 clipes e explodiria com "concat n=0"). Falha limpa aqui.
  if (
    !ehRemix &&
    (job.tipo ?? "produto") === "produto" &&
    !job.fonte &&
    videos.length === 0 &&
    imagens.length === 0
  ) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "erro",
        erro: "A mídia desse vídeo não chegou no servidor. Tente gerar de novo (não descontamos créditos).",
      },
    });
    return NextResponse.json({ job: null });
  }

  // BYO: se o dono do job tem chave ElevenLabs própria e o job é de voz, manda a
  // chave decifrada pro worker renderizar na conta dele (canal já fica protegido
  // pelo WORKER_TOKEN). Só nesse caso o segredo viaja.
  let elevenKey = "";
  if (job.formato === "voz") {
    const dono = await prisma.user.findUnique({
      where: { id: job.userId },
      select: { elevenKey: true },
    });
    if (dono?.elevenKey) {
      try {
        elevenKey = decifrar(dono.elevenKey);
      } catch {
        elevenKey = "";
      }
    }
  }

  return NextResponse.json({
    job: {
      id: job.id,
      tipo: job.tipo ?? "produto",
      fonte: job.fonte ?? "",
      opcoes: job.opcoes ?? "",
      produto: job.produto,
      descricao: job.descricao ?? "",
      formato: job.formato,
      voz_id: job.vozId ?? "",
      eleven_key: elevenKey,
      tom: job.tom,
      variantes: job.variantes,
      preco: job.preco ?? "",
      legenda_pos: job.legendaPos ?? "baixo",
      arquivos: { videos, imagens, musica, template },
    },
  });
}
