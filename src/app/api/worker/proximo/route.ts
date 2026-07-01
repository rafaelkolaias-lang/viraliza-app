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

  const job = await prisma.job.findFirst({
    where: { status: "na_fila" },
    orderBy: { criadoEm: "asc" },
  });

  if (!job) return NextResponse.json({ job: null });

  // marca como renderizando (claim). Single worker -> sem corrida.
  await prisma.job.update({
    where: { id: job.id },
    data: { status: "renderizando", erro: null },
  });

  const [videos, imagens, musica, template] = await Promise.all([
    listar(job.id, "videos"),
    listar(job.id, "imagens"),
    listar(job.id, "musica"),
    listar(job.id, "template"),
  ]);

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
