import "server-only";

import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { VideoJob, VideoMidia } from "@/lib/types";

// Mídia enviada pelo usuário (entrada da fábrica) - fora do public, baixada pelo worker.
export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
// Vídeos prontos (saída) - servidos pela web em /videos/<id>/...
export const VIDEOS_OUT_DIR = path.join(process.cwd(), "public", "videos");

export function pastaEntrada(jobId: string) {
  return path.join(UPLOADS_DIR, jobId);
}
export function pastaSaida(jobId: string) {
  return path.join(VIDEOS_OUT_DIR, jobId);
}

/** Tipo do banco -> formato que os componentes usam. */
export function paraVideoJob(job: {
  id: string;
  produto: string;
  tipo: string;
  formato: string;
  status: string;
  variantes: number;
  duracao: number | null;
  saidas: string | null;
  midias: string | null;
  erro: string | null;
  etapa: string | null;
  criadoEm: Date;
}): VideoJob {
  let saidas: string[] = [];
  try {
    if (job.saidas) saidas = JSON.parse(job.saidas) as string[];
  } catch {
    /* ignora json inválido */
  }
  let midias: VideoMidia[] = [];
  try {
    if (job.midias) midias = JSON.parse(job.midias) as VideoMidia[];
  } catch {
    /* ignora json inválido */
  }
  return {
    id: job.id,
    produto: job.produto,
    tipo: job.tipo || "produto",
    formato: job.formato === "voz" ? "voz" : "legenda",
    status: job.status as VideoJob["status"],
    variantes: job.variantes,
    criadoEm: job.criadoEm.toISOString(),
    duracaoSeg: job.duracao ?? undefined,
    saidas,
    midias,
    erro: job.erro ?? undefined,
    etapa: job.etapa ?? undefined,
  };
}

export async function getJobsDoUsuario(userId: string): Promise<VideoJob[]> {
  const jobs = await prisma.job.findMany({
    // "recebendo" = rascunho ainda recebendo os pedaços do upload; não mostra
    where: { userId, status: { not: "recebendo" } },
    orderBy: { criadoEm: "desc" },
  });
  const lista = jobs.map(paraVideoJob);

  // créditos debitados por job (custo real) — pra mostrar no card
  const ids = lista.map((j) => j.id);
  if (ids.length) {
    const txs = await prisma.creditoTransacao.findMany({
      where: {
        jobId: { in: ids },
        tipo: { in: ["debito_geracao", "debito_processamento"] },
      },
      select: { jobId: true, valor: true },
    });
    const porJob = new Map<string, number>();
    for (const t of txs) {
      if (!t.jobId) continue;
      porJob.set(t.jobId, (porJob.get(t.jobId) ?? 0) + Math.abs(t.valor));
    }
    for (const j of lista) {
      const c = porJob.get(j.id);
      if (c) j.creditosGastos = c;
    }
  }
  return lista;
}

/** Config de um vídeo pra REUTILIZAR no editor (mesmos ajustes). Só do dono.
 *  Não serve pra cortes (esses têm fluxo próprio). null = não achou/não aplica. */
export async function getConfigReuso(userId: string, id: string) {
  const j = await prisma.job.findFirst({
    where: { id, userId },
    select: {
      produto: true,
      descricao: true,
      preco: true,
      formato: true,
      vozId: true,
      tom: true,
      legendaPos: true,
      tipo: true,
    },
  });
  if (!j || j.tipo === "cortes") return null;
  return {
    nome: j.produto,
    descricao: j.descricao ?? "",
    preco: j.preco ?? "",
    formato: (j.formato === "voz" ? "voz" : "legenda") as "legenda" | "voz",
    tom: j.tom || "agressivo",
    legendaPos: j.legendaPos || "baixo",
    voz: j.vozId ?? undefined,
  };
}

/** Um job específico do usuário (ou null) - pra página de detalhe dos cortes. */
export async function getJobDoUsuario(
  userId: string,
  id: string,
): Promise<VideoJob | null> {
  const job = await prisma.job.findFirst({ where: { id, userId } });
  return job ? paraVideoJob(job) : null;
}
