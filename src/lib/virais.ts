import "server-only";

import { prisma } from "@/lib/prisma";
import type { ViralVideo } from "@/lib/types";

/**
 * Vídeos virais Shopee - hospedados no Google Drive e catalogados no MySQL
 * (deploy-safe). Player e download são servidos pelo `driveId`.
 */
export async function getViralVideos(): Promise<ViralVideo[]> {
  const rows = await prisma.videoShopee.findMany({
    orderBy: { adicionadoEm: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    link: r.link ?? undefined,
    driveId: r.driveId,
    thumbDriveId: r.thumbDriveId ?? undefined,
    duracaoSeg: r.duracaoSeg,
    adicionadoEm: r.adicionadoEm.toISOString(),
    canal: r.canal ?? undefined,
  }));
}

/** Só a contagem (pro Início/Shopee). */
export async function getTotalVirais(): Promise<number> {
  return prisma.videoShopee.count();
}

/** Datas (ISO) de todos os vídeos - pra contar quantos são "novos" no menu. */
export async function getViraisTimestamps(): Promise<string[]> {
  const rows = await prisma.videoShopee.findMany({
    select: { adicionadoEm: true },
  });
  return rows.map((r) => r.adicionadoEm.toISOString());
}
