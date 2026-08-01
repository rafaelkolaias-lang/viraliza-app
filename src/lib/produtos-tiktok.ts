import "server-only";

import dados from "@/data/produtos-tiktok.json";

/**
 * Produtos do TikTok Shop (Radar), coletados em 01/ago/2026: 382 produtos com
 * vendas, faturamento, anúncios e imagem.
 *
 * As FOTOS ficam no serverrk (`media.univershoop.com/tiktok/produtos/...`), como
 * toda mídia nossa; aqui fica só o texto, que é leve e nunca vai inteiro pro
 * navegador (a página manda só a página atual).
 *
 * Sobre a COMISSÃO: 109 dos 382 vêm com o valor real da API. Nos outros 273 o
 * número é uma estimativa (a fonte gera por hash do id do produto). A gente
 * mostra os dois, mas o estimado vai marcado como estimativa: quem decide
 * quanto vai ganhar precisa saber a diferença.
 */

export type ProdutoTiktok = {
  id: string;
  rank: number;
  titulo: string;
  categoria: string;
  loja: string;
  lojaOficial: boolean;
  preco: number;
  comissaoPct: number;
  comissaoValor: number;
  comissaoEstimada: boolean;
  vendas: number;
  vendasTotais: number;
  gmv: number;
  gmvTotal: number;
  crescimento: number;
  emAlta: boolean;
  imagem: string;
  url: string;
  anuncios: number;
  anunciosViews: number;
  legendas: string[];
  criativos: { tipo: string; descricao: string }[];
};

const PRODUTOS = dados as ProdutoTiktok[];

export const BASE_IMAGEM_TIKTOK = "https://media.univershoop.com/tiktok/produtos";

export const imagemProdutoTiktok = (arquivo: string) => `${BASE_IMAGEM_TIKTOK}/${arquivo}`;

export type OrdemTiktok = "rank" | "vendas" | "crescimento" | "comissao" | "preco";

/** Categorias que existem no acervo, com a contagem de cada uma. */
export function categoriasTiktok(): { nome: string; qtd: number }[] {
  const mapa = new Map<string, number>();
  for (const p of PRODUTOS) mapa.set(p.categoria, (mapa.get(p.categoria) ?? 0) + 1);
  return [...mapa.entries()]
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd);
}

/** Busca com filtro, ordenação e paginação (tudo no servidor). */
export function buscarProdutosTiktok(opts: {
  busca?: string;
  categoria?: string;
  ordem?: OrdemTiktok;
  soAlta?: boolean;
  pagina?: number;
  porPagina?: number;
}) {
  const busca = (opts.busca ?? "").trim().toLowerCase();
  const porPagina = Math.min(60, Math.max(12, opts.porPagina ?? 24));
  const pagina = Math.max(1, opts.pagina ?? 1);

  let lista = PRODUTOS;
  if (opts.categoria) lista = lista.filter((p) => p.categoria === opts.categoria);
  if (opts.soAlta) lista = lista.filter((p) => p.emAlta);
  if (busca) {
    lista = lista.filter(
      (p) =>
        p.titulo.toLowerCase().includes(busca) ||
        p.loja.toLowerCase().includes(busca) ||
        p.categoria.toLowerCase().includes(busca),
    );
  }

  const ordem = opts.ordem ?? "rank";
  const ordenada = [...lista].sort((a, b) => {
    switch (ordem) {
      case "vendas":
        return b.vendas - a.vendas;
      case "crescimento":
        return b.crescimento - a.crescimento;
      case "comissao":
        return b.comissaoValor - a.comissaoValor;
      case "preco":
        return a.preco - b.preco;
      default:
        return a.rank - b.rank;
    }
  });

  const total = ordenada.length;
  const inicio = (pagina - 1) * porPagina;
  return {
    itens: ordenada.slice(inicio, inicio + porPagina),
    total,
    paginas: Math.max(1, Math.ceil(total / porPagina)),
    pagina,
  };
}

export function totalProdutosTiktok(): number {
  return PRODUTOS.length;
}

export function produtoTiktokPorId(id: string): ProdutoTiktok | null {
  return PRODUTOS.find((p) => p.id === id) ?? null;
}
