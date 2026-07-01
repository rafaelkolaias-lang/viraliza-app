import "server-only";

import { prisma } from "@/lib/prisma";

export type AcervoCategoria = {
  slug: string;
  nome: string;
  cover: string;
  count: number;
};
export type AcervoItem = { id: string; nome: string };

export const ACERVO_POR_PAGINA = 48;

/** Categorias (com capa e contagem) - só as que têm vídeo, na ordem definida. */
export async function getCategorias(): Promise<AcervoCategoria[]> {
  try {
    const cats = await prisma.acervoCategoria.findMany({
      orderBy: { ordem: "asc" },
    });
    return cats
      .filter((c) => c.total > 0)
      .map((c) => ({ slug: c.slug, nome: c.nome, cover: c.cover, count: c.total }));
  } catch {
    return [];
  }
}

/** Total de vídeos no acervo. */
export async function getTotalAcervo(): Promise<number> {
  try {
    const r = await prisma.acervoCategoria.aggregate({ _sum: { total: true } });
    return r._sum.total ?? 0;
  } catch {
    return 0;
  }
}

/** Uma categoria + seus vídeos PAGINADOS (e busca opcional). */
export async function getCategoria(
  slug: string,
  opts: { page?: number; q?: string } = {},
): Promise<{
  cat: AcervoCategoria | null;
  itens: AcervoItem[];
  total: number;
  totalPaginas: number;
  pagina: number;
}> {
  const vazio = { cat: null, itens: [], total: 0, totalPaginas: 0, pagina: 1 };
  try {
    const cat = await prisma.acervoCategoria.findUnique({ where: { slug } });
    if (!cat) return vazio;

    const q = (opts.q || "").trim();
    const where = {
      categoriaSlug: slug,
      ...(q ? { nome: { contains: q } } : {}),
    };

    const total = await prisma.acervoVideo.count({ where });
    const totalPaginas = Math.max(1, Math.ceil(total / ACERVO_POR_PAGINA));
    const pagina = Math.min(Math.max(1, opts.page || 1), totalPaginas);

    const rows = await prisma.acervoVideo.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: (pagina - 1) * ACERVO_POR_PAGINA,
      take: ACERVO_POR_PAGINA,
    });

    return {
      cat: { slug: cat.slug, nome: cat.nome, cover: cat.cover, count: cat.total },
      itens: rows.map((r) => ({ id: r.driveId, nome: r.nome })),
      total,
      totalPaginas,
      pagina,
    };
  } catch {
    return vazio;
  }
}
