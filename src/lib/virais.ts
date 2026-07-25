import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import type { ViralVideo } from "@/lib/types";

// cortes sem nicho (só o link) caem nesse balde
export const BUCKET_SEM_NICHO = "Achadinhos";

// títulos "genéricos" = vídeo sem nome de produto (candidato ao enriquecimento por visão).
// A trava do enriquecedor só escreve nome novo por cima de um destes (nunca pisa num real).
export const TITULOS_GENERICOS = ["Achadinho viral", "Vídeo viral", "Video viral", ""];

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

/**
 * Deslocamento de rotação (0..total-1) a partir de uma semente. A semente muda a
 * cada visita, então o acervo "gira": cada entrada começa num ponto diferente da
 * mesma ordem base, sem repetir vídeo e cobrindo tudo ao paginar. 0 = sem giro.
 */
function rotacaoDe(seed: number | undefined, total: number): number {
  if (!seed || total <= 0) return 0;
  const r = Math.floor(seed) % total;
  return r < 0 ? r + total : r;
}

/** Busca `take` linhas na ordem base a partir do índice natural `start`, dando a
 *  volta (wrap) quando passa do fim. É o que "gira" o acervo por visita. */
async function buscarComRotacao(
  where: Prisma.VideoShopeeWhereInput,
  total: number,
  start: number,
  take: number,
): Promise<Row[]> {
  if (take <= 0 || total <= 0) return [];
  const primeira = Math.min(take, total - start);
  const rows1 = await prisma.videoShopee.findMany({
    where,
    select: SELECT,
    orderBy: { adicionadoEm: "desc" },
    skip: start,
    take: primeira,
  });
  if (primeira >= take) return rows1;
  // sobrou: completa dando a volta pro começo da ordem
  const rows2 = await prisma.videoShopee.findMany({
    where,
    select: SELECT,
    orderBy: { adicionadoEm: "desc" },
    skip: 0,
    take: take - primeira,
  });
  return [...rows1, ...rows2];
}

/** Página de vídeos (por nicho ou "Em alta"). Só carrega `porPagina` linhas.
 *  Com `rotacaoSeed`, gira o acervo por visita (ver rotacaoDe). */
export async function getViralVideosPagina(opts: {
  nicho?: string;
  emAlta?: boolean;
  pagina: number;
  porPagina: number;
  rotacaoSeed?: number;
}): Promise<{ itens: ViralVideo[]; total: number }> {
  const where = opts.emAlta ? { emAlta: true } : filtroCategoria(opts.nicho);
  const pagina = Math.max(1, opts.pagina);
  const total = await prisma.videoShopee.count({ where });
  if (total === 0) return { itens: [], total: 0 };

  const absStart = (pagina - 1) * opts.porPagina; // posição na sequência exibida
  if (absStart >= total) return { itens: [], total }; // página além do fim

  const rot = rotacaoDe(opts.rotacaoSeed, total);
  const take = Math.min(opts.porPagina, total - absStart); // última página parcial
  const rows =
    rot === 0
      ? await prisma.videoShopee.findMany({
          where,
          select: SELECT,
          orderBy: { adicionadoEm: "desc" },
          skip: absStart,
          take,
        })
      : await buscarComRotacao(where, total, (absStart + rot) % total, take);
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
  rotacaoSeed?: number,
): Promise<{ emAlta: ViralVideo[]; emAltaTotal: number; nichos: Prateleira[] }> {
  const grupos = await prisma.videoShopee.groupBy({
    by: ["categoria"],
    _count: { _all: true },
  });
  const ordenados = grupos
    .map((g) => ({ cat: g.categoria, total: g._count._all }))
    .sort((a, b) => b.total - a.total)
    .slice(0, maxNichos);

  const [emAltaRows, emAltaCount, ...porNicho] = await Promise.all([
    // "Em alta" NÃO gira: fica sempre com os mais novos/quentes no topo.
    prisma.videoShopee.findMany({
      where: { emAlta: true },
      select: SELECT,
      orderBy: { adicionadoEm: "desc" },
      take: porPrateleira,
    }),
    prisma.videoShopee.count({ where: { emAlta: true } }),
    // Cada nicho gira por visita (começa num ponto diferente do acervo).
    ...ordenados.map((g) => {
      const where = { categoria: g.cat };
      const rot = rotacaoDe(rotacaoSeed, g.total);
      const take = Math.min(porPrateleira, g.total);
      return rot === 0
        ? prisma.videoShopee.findMany({
            where,
            select: SELECT,
            orderBy: { adicionadoEm: "desc" },
            take,
          })
        : buscarComRotacao(where, g.total, rot, take);
    }),
  ]);

  let emAlta = emAltaRows.map(mapear);
  let emAltaTotal = emAltaCount;
  if (!emAlta.length) {
    // ninguém marcado "em alta" ainda -> usa os mais novos de todos
    const [recent, todos] = await Promise.all([
      prisma.videoShopee.findMany({
        select: SELECT,
        orderBy: { adicionadoEm: "desc" },
        take: porPrateleira,
      }),
      prisma.videoShopee.count(),
    ]);
    emAlta = recent.map(mapear);
    emAltaTotal = todos;
  }

  const nichos: Prateleira[] = ordenados.map((g, i) => ({
    nicho: g.cat || BUCKET_SEM_NICHO,
    total: g.total,
    itens: porNicho[i].map(mapear),
  }));

  return { emAlta, emAltaTotal, nichos };
}

/** Só a contagem (pro Início/Shopee). */
export async function getTotalVirais(): Promise<number> {
  return prisma.videoShopee.count();
}

/** Quantos vídeos entraram DEPOIS de `desde` (badge "novos" do menu, O(1) no índice). */
export async function contarViraisNovos(desde: Date): Promise<number> {
  return prisma.videoShopee.count({ where: { adicionadoEm: { gt: desde } } });
}
