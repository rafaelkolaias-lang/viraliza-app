import "server-only";

import { prisma } from "@/lib/prisma";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import type { ViralVideo } from "@/lib/types";

// cortes sem nicho (só o link) caem nesse balde
export const BUCKET_SEM_NICHO = "Achadinhos";

// só as colunas que a UI precisa (evita puxar linha inteira)
const SELECT = {
  id: true,
  titulo: true,
  categoria: true,
  emAlta: true,
  link: true,
  duracaoSeg: true,
  canal: true,
  adicionadoEm: true,
  migrado: true,
  driveId: true,
  thumbDriveId: true,
} as const;

type Row = {
  id: string;
  titulo: string;
  categoria: string;
  emAlta: boolean;
  link: string | null;
  duracaoSeg: number;
  canal: string | null;
  adicionadoEm: Date;
  migrado: boolean;
  driveId: string | null;
  thumbDriveId: string | null;
};

/** Migrado => serve do serverrk (URLs absolutas); senão Drive (driveId). */
function mapear(r: Row): ViralVideo {
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
    return {
      ...base,
      arquivo: `${MEDIA_BASE}/virais/${r.id}.mp4`,
      thumb: `${MEDIA_BASE}/thumbs/${r.id}.jpg`,
    };
  }
  return { ...base, driveId: r.driveId ?? undefined, thumbDriveId: r.thumbDriveId ?? undefined };
}

/** Rótulo do nicho -> filtro real de categoria ("Achadinhos" = categoria vazia). */
function filtroCategoria(nicho?: string) {
  if (!nicho) return {};
  return { categoria: nicho === BUCKET_SEM_NICHO ? "" : nicho };
}

/** Página de vídeos (opcionalmente de um nicho). Só carrega `porPagina` linhas. */
export async function getViralVideosPagina(opts: {
  nicho?: string;
  pagina: number;
  porPagina: number;
}): Promise<{ itens: ViralVideo[]; total: number }> {
  const where = filtroCategoria(opts.nicho);
  const pagina = Math.max(1, opts.pagina);
  const [rows, total] = await Promise.all([
    prisma.videoShopee.findMany({
      where,
      select: SELECT,
      orderBy: { adicionadoEm: "desc" },
      skip: (pagina - 1) * opts.porPagina,
      take: opts.porPagina,
    }),
    prisma.videoShopee.count({ where }),
  ]);
  return { itens: rows.map(mapear), total };
}

export type Prateleira = { nicho: string; total: number; itens: ViralVideo[] };

/**
 * Prateleiras da página de cortes SEM carregar tudo: um groupBy pega os nichos +
 * contagem, e pra cada nicho puxa só os `porPrateleira` mais novos (índice
 * [categoria, adicionadoEm]). Tudo em paralelo.
 */
export async function getPrateleirasVirais(
  porPrateleira = 20,
  maxNichos = 14,
): Promise<{ emAlta: ViralVideo[]; nichos: Prateleira[] }> {
  const grupos = await prisma.videoShopee.groupBy({
    by: ["categoria"],
    _count: { _all: true },
  });
  const ordenados = grupos
    .map((g) => ({ cat: g.categoria, total: g._count._all }))
    .sort((a, b) => b.total - a.total)
    .slice(0, maxNichos);

  const [emAltaRows, ...porNicho] = await Promise.all([
    prisma.videoShopee.findMany({
      where: { emAlta: true },
      select: SELECT,
      orderBy: { adicionadoEm: "desc" },
      take: porPrateleira,
    }),
    ...ordenados.map((g) =>
      prisma.videoShopee.findMany({
        where: { categoria: g.cat },
        select: SELECT,
        orderBy: { adicionadoEm: "desc" },
        take: porPrateleira,
      }),
    ),
  ]);

  let emAlta = emAltaRows.map(mapear);
  if (!emAlta.length) {
    // ninguém marcado "em alta" ainda -> usa os mais novos de todos
    const recent = await prisma.videoShopee.findMany({
      select: SELECT,
      orderBy: { adicionadoEm: "desc" },
      take: porPrateleira,
    });
    emAlta = recent.map(mapear);
  }

  const nichos: Prateleira[] = ordenados.map((g, i) => ({
    nicho: g.cat || BUCKET_SEM_NICHO,
    total: g.total,
    itens: porNicho[i].map(mapear),
  }));

  return { emAlta, nichos };
}

/** Só a contagem (pro Início/Shopee). */
export async function getTotalVirais(): Promise<number> {
  return prisma.videoShopee.count();
}

/** Quantos vídeos entraram DEPOIS de `desde` (badge "novos" do menu, O(1) no índice). */
export async function contarViraisNovos(desde: Date): Promise<number> {
  return prisma.videoShopee.count({ where: { adicionadoEm: { gt: desde } } });
}
