"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Flame,
  TrendingUp,
  ShoppingCart,
  Store,
  BadgeCheck,
  ExternalLink,
  Video,
  X,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProdutoTiktok, OrdemTiktok } from "@/lib/produtos-tiktok";

/** O produto com a URL da foto já montada (a página resolve, o card só usa). */
export type ProdutoTiktokComFoto = ProdutoTiktok & { imagemUrl: string };

/**
 * Galeria dos produtos do TikTok Shop. Cada card mostra o que vende de verdade
 * (vendas, faturamento, crescimento e anúncios rodando) e abre um painel com os
 * detalhes e as ideias de criativo.
 *
 * A comissão aparece marcada quando é ESTIMADA: em 273 dos 382 produtos a fonte
 * não tem o número real e gera um valor a partir do id. Quem vai escolher produto
 * pra divulgar precisa saber qual dos dois está lendo.
 */

const ORDENS: { chave: OrdemTiktok; label: string }[] = [
  { chave: "rank", label: "Ranking" },
  { chave: "vendas", label: "Mais vendidos" },
  { chave: "crescimento", label: "Crescendo mais" },
  { chave: "comissao", label: "Maior comissão" },
  { chave: "preco", label: "Menor preço" },
];

function num(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")}K`;
  return String(n);
}

function reais(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Painel de detalhes do produto. */
function Detalhe({
  p,
  imagem,
  onFechar,
}: {
  p: ProdutoTiktokComFoto;
  imagem: string;
  onFechar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm duration-200 animate-in fade-in"
      onClick={onFechar}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl duration-300 animate-in zoom-in-95 sm:p-6"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{p.titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagem}
            alt={p.titulo}
            className="aspect-square w-full shrink-0 rounded-2xl object-cover sm:w-56"
          />
          <div className="flex-1 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">
                #{p.rank} no ranking
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                {p.categoria}
              </span>
              {p.emAlta && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 font-semibold text-orange-400">
                  <Flame className="size-3" />
                  Em alta
                </span>
              )}
            </div>

            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Store className="size-3.5" />
              {p.loja}
              {p.lojaOficial && <BadgeCheck className="size-3.5 text-primary" />}
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <Dado rotulo="Preço" valor={reais(p.preco)} />
              <Dado
                rotulo="Comissão"
                valor={`${p.comissaoPct.toFixed(1).replace(".", ",")}% (${reais(p.comissaoValor)})`}
                nota={p.comissaoEstimada ? "estimativa" : "confirmada"}
                alerta={p.comissaoEstimada}
              />
              <Dado rotulo="Vendas no período" valor={num(p.vendas)} />
              <Dado rotulo="Vendas totais" valor={num(p.vendasTotais)} />
              <Dado rotulo="Faturamento no período" valor={reais(p.gmv)} />
              <Dado
                rotulo="Crescimento"
                valor={`${p.crescimento > 0 ? "+" : ""}${Math.round(p.crescimento)}%`}
              />
            </div>
          </div>
        </div>

        {p.anuncios > 0 && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Video className="size-4 text-primary" />
              {p.anuncios} anúncio{p.anuncios > 1 ? "s" : ""} rodando · {num(p.anunciosViews)}{" "}
              visualizações
            </p>
            {p.legendas.length > 0 && (
              <ul className="mt-2 space-y-1">
                {p.legendas.map((l, i) => (
                  <li key={i} className="truncate text-xs text-muted-foreground">
                    “{l}”
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {p.criativos.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-primary" />
              Ideias de criativo
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {p.criativos.map((c) => (
                <div key={c.tipo} className="rounded-xl border border-border/60 bg-card/60 p-3">
                  <p className="text-sm font-semibold">{c.tipo}</p>
                  <p className="text-xs text-muted-foreground">{c.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <ExternalLink className="size-4" />
            Ver no TikTok Shop
          </a>
        </div>
      </div>
    </div>
  );
}

function Dado({
  rotulo,
  valor,
  nota,
  alerta,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <p className="text-sm font-semibold">{valor}</p>
      {nota && (
        <p className={cn("text-[10px]", alerta ? "text-amber-400" : "text-muted-foreground")}>
          {nota}
        </p>
      )}
    </div>
  );
}

export function TiktokProdutos({
  itens,
  total,
  pagina,
  paginas,
  categorias,
  base,
  filtros,
}: {
  itens: ProdutoTiktokComFoto[];
  total: number;
  pagina: number;
  paginas: number;
  categorias: { nome: string; qtd: number }[];
  base: string;
  filtros: { busca: string; categoria: string; ordem: OrdemTiktok; soAlta: boolean };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [busca, setBusca] = useState(filtros.busca);
  const [aberto, setAberto] = useState<ProdutoTiktokComFoto | null>(null);

  /** Mexer num filtro sempre volta pra página 1. */
  function irCom(mudancas: Record<string, string | null>) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v === null || v === "") q.delete(k);
      else q.set(k, v);
    }
    q.delete("page");
    router.push(`${base}?${q.toString()}`);
  }

  function irPagina(n: number) {
    const q = new URLSearchParams(sp.toString());
    q.set("page", String(n));
    router.push(`${base}?${q.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      {/* ===== BUSCA E ORDEM ===== */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <form
          className="relative flex-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            irCom({ q: busca });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
            placeholder="Buscar produto, loja ou categoria"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </form>

        <div className="flex gap-2">
          <select
            value={filtros.ordem}
            onChange={(ev) => irCom({ ordem: ev.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60"
          >
            {ORDENS.map((o) => (
              <option key={o.chave} value={o.chave}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => irCom({ alta: filtros.soAlta ? null : "1" })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
              filtros.soAlta
                ? "border-orange-500/60 bg-orange-500/10 text-orange-400"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <Flame className="size-4" />
            Em alta
          </button>
        </div>
      </div>

      {/* ===== CATEGORIAS ===== */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => irCom({ cat: null })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            !filtros.categoria
              ? "border-primary bg-primary/12 text-primary"
              : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          Todas
        </button>
        {categorias.map((c) => (
          <button
            key={c.nome}
            type="button"
            onClick={() => irCom({ cat: c.nome })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filtros.categoria === c.nome
                ? "border-primary bg-primary/12 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {c.nome} <span className="opacity-60">{c.qtd}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {total} produto{total === 1 ? "" : "s"}
        {filtros.categoria ? ` em ${filtros.categoria}` : ""}
      </p>

      {/* ===== GRADE ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {itens.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setAberto(p)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 text-left backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-[0_0_30px_-12px_var(--color-primary)]"
          >
            <div className="relative aspect-square overflow-hidden bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imagemUrl}
                alt={p.titulo}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                #{p.rank}
              </span>
              {p.emAlta && (
                <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Flame className="size-3" />
                  Alta
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <p className="line-clamp-2 text-xs font-medium leading-snug">{p.titulo}</p>
              <p className="text-sm font-bold text-primary">{reais(p.preco)}</p>
              <div className="mt-auto space-y-0.5 pt-1.5 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-1">
                  <ShoppingCart className="size-3" />
                  {num(p.vendas)} vendas
                </p>
                <p className="flex items-center gap-1">
                  <TrendingUp className="size-3" />
                  {p.crescimento > 0 ? "+" : ""}
                  {Math.round(p.crescimento)}% no período
                </p>
                <p className={cn("flex items-center gap-1", p.comissaoEstimada && "text-amber-400/80")}>
                  <Sparkles className="size-3" />
                  {p.comissaoPct.toFixed(1).replace(".", ",")}% de comissão
                  {p.comissaoEstimada ? " (est.)" : ""}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {itens.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          Nenhum produto com esse filtro.
        </div>
      )}

      {/* ===== PAGINAÇÃO ===== */}
      {paginas > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => irPagina(pagina - 1)}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            {pagina} de {paginas}
          </span>
          <button
            type="button"
            disabled={pagina >= paginas}
            onClick={() => irPagina(pagina + 1)}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {/* ===== NOTA DA COMISSÃO ===== */}
      <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/40 p-3 text-[11px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Vendas, faturamento e anúncios vêm direto da fonte. A comissão marcada com
        &quot;est.&quot; é estimativa: só 109 dos 382 produtos têm o valor confirmado, então
        confira na página do produto antes de contar com ela.
      </p>

      {aberto && (
        <Detalhe p={aberto} imagem={aberto.imagemUrl} onFechar={() => setAberto(null)} />
      )}
    </div>
  );
}
