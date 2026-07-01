import "server-only";

import { prisma } from "@/lib/prisma";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import type { ViralProduto } from "@/lib/types";

type Row = {
  id: string;
  titulo: string;
  link: string | null;
  adicionadoEm: Date;
  canal: string | null;
  migrado: boolean;
  driveId: string;
};

const SELECT = {
  id: true,
  titulo: true,
  link: true,
  adicionadoEm: true,
  canal: true,
  migrado: true,
  driveId: true,
} as const;

// migrado => serve do serverrk; imagemProduto prefere driveId, então NÃO devolvemos
// driveId quando migrado (cai no arquivo do serverrk).
function mapear(r: Row): ViralProduto {
  const base = {
    id: r.id,
    titulo: r.titulo,
    link: r.link ?? undefined,
    adicionadoEm: r.adicionadoEm.toISOString(),
    canal: r.canal ?? undefined,
  };
  if (r.migrado) return { ...base, arquivo: `${MEDIA_BASE}/produtos/${r.id}.jpg` };
  return { ...base, driveId: r.driveId };
}

/** Página de produtos. Só carrega `porPagina` linhas (+ contagem). */
export async function getProdutosPagina(opts: {
  pagina: number;
  porPagina: number;
}): Promise<{ itens: ViralProduto[]; total: number }> {
  const pagina = Math.max(1, opts.pagina);
  const [rows, total] = await Promise.all([
    prisma.produtoShopee.findMany({
      select: SELECT,
      orderBy: { adicionadoEm: "desc" },
      skip: (pagina - 1) * opts.porPagina,
      take: opts.porPagina,
    }),
    prisma.produtoShopee.count(),
  ]);
  return { itens: rows.map(mapear), total };
}

/** Só a contagem (pro Início/Shopee, sem carregar tudo). */
export async function getTotalProdutos(): Promise<number> {
  return prisma.produtoShopee.count();
}
