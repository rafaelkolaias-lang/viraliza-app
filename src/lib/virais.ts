import "server-only";

import { prisma } from "@/lib/prisma";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import type { ViralVideo } from "@/lib/types";

/**
 * Vídeos virais Shopee. Migrados => servidos do serverrk (media.univershoop.com,
 * SSD + Cloudflare: rápido, player nativo). Ainda não migrados => Drive (driveId).
 */
export async function getViralVideos(): Promise<ViralVideo[]> {
  const rows = await prisma.videoShopee.findMany({
    orderBy: { adicionadoEm: "desc" },
  });
  return rows.map((r) => {
    const base = {
      id: r.id,
      titulo: r.titulo,
      categoria: r.categoria || undefined,
      emAlta: r.emAlta,
      link: r.link ?? undefined,
      duracaoSeg: r.duracaoSeg,
      adicionadoEm: r.adicionadoEm.toISOString(),
      canal: r.canal ?? undefined,
    };
    if (r.migrado) {
      // serve direto do serverrk (arquivo/thumb são URLs absolutas)
      return {
        ...base,
        arquivo: `${MEDIA_BASE}/virais/${r.id}.mp4`,
        thumb: `${MEDIA_BASE}/thumbs/${r.id}.jpg`,
      };
    }
    return {
      ...base,
      driveId: r.driveId ?? undefined,
      thumbDriveId: r.thumbDriveId ?? undefined,
    };
  });
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
