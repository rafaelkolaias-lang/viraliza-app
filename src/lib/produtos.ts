import "server-only";

import { prisma } from "@/lib/prisma";
import type { ViralProduto } from "@/lib/types";

/**
 * Produtos virais Shopee - hospedados no Google Drive e catalogados no MySQL
 * (deploy-safe). A imagem é servida pelo `driveId`.
 */
export async function getViralProdutos(): Promise<ViralProduto[]> {
  const rows = await prisma.produtoShopee.findMany({
    orderBy: { adicionadoEm: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    link: r.link ?? undefined,
    driveId: r.driveId,
    adicionadoEm: r.adicionadoEm.toISOString(),
    canal: r.canal ?? undefined,
  }));
}

/** Só a contagem (pro Início/Shopee, sem carregar tudo). */
export async function getTotalProdutos(): Promise<number> {
  return prisma.produtoShopee.count();
}
