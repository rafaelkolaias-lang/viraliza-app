import "server-only";

import { prisma } from "@/lib/prisma";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import type { ViralProduto } from "@/lib/types";

/**
 * Produtos virais Shopee. Migrados => imagem servida do serverrk
 * (media.univershoop.com); ainda não migrados => Drive (driveId).
 */
export async function getViralProdutos(): Promise<ViralProduto[]> {
  const rows = await prisma.produtoShopee.findMany({
    orderBy: { adicionadoEm: "desc" },
  });
  return rows.map((r) => {
    const base = {
      id: r.id,
      titulo: r.titulo,
      link: r.link ?? undefined,
      adicionadoEm: r.adicionadoEm.toISOString(),
      canal: r.canal ?? undefined,
    };
    // migrado => serve do serverrk (arquivo); imagemProduto prefere driveId,
    // então NÃO devolvemos driveId quando migrado (cai no arquivo do serverrk).
    if (r.migrado) {
      return { ...base, arquivo: `${MEDIA_BASE}/produtos/${r.id}.jpg` };
    }
    return { ...base, driveId: r.driveId };
  });
}

/** Só a contagem (pro Início/Shopee, sem carregar tudo). */
export async function getTotalProdutos(): Promise<number> {
  return prisma.produtoShopee.count();
}
