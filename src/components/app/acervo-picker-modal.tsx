"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, Loader2, Search, Flame, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maisVirais } from "@/app/actions/virais";
import { midiaUrl, cn } from "@/lib/utils";
import type { ViralVideo } from "@/lib/types";

export type FonteAcervo = { url: string; nome: string; thumb?: string };

const POR_PAGINA = 24;

/** Só dá pra carimbar vídeo que mora no serverrk (tem `arquivo` http). Drive fica de fora. */
function urlDoAcervo(v: ViralVideo): string | null {
  return v.arquivo && /^https?:\/\//i.test(v.arquivo) ? v.arquivo : null;
}

/**
 * Modal pra escolher vídeos da plataforma (Shopee), multi-seleção. Carrega sob
 * demanda (scroll infinito) e devolve as fontes escolhidas.
 */
export function AcervoPickerModal({
  aberto,
  onFechar,
  onConfirmar,
  jaSelecionados,
  limite,
}: {
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (fontes: FonteAcervo[]) => void;
  jaSelecionados: string[];
  limite: number;
}) {
  const [itens, setItens] = useState<ViralVideo[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Map<string, FonteAcervo>>(new Map());
  const sentinela = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setSel(new Map(jaSelecionados.map((u) => [u, { url: u, nome: "Vídeo" }])));
    setItens([]);
    setPagina(1);
    setTotal(0);
    document.body.style.overflow = "hidden";
    let vivo = true;
    setCarregando(true);
    maisVirais({ emAlta: true, pagina: 1, porPagina: POR_PAGINA })
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setTotal(r.total);
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const carregarMais = useCallback(async () => {
    if (carregando || itens.length >= total) return;
    setCarregando(true);
    try {
      const prox = pagina + 1;
      const r = await maisVirais({ emAlta: true, pagina: prox, porPagina: POR_PAGINA });
      setItens((atual) => {
        const vistos = new Set(atual.map((v) => v.id));
        const novos = r.itens.filter((v) => !vistos.has(v.id));
        return novos.length ? [...atual, ...novos] : atual;
      });
      setPagina(prox);
    } finally {
      setCarregando(false);
    }
  }, [carregando, itens.length, total, pagina]);

  useEffect(() => {
    if (!aberto) return;
    const alvo = sentinela.current;
    if (!alvo) return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && carregarMais(),
      { rootMargin: "400px" },
    );
    io.observe(alvo);
    return () => io.disconnect();
  }, [aberto, carregarMais]);

  if (!aberto) return null;

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? itens.filter(
        (v) =>
          v.titulo.toLowerCase().includes(termo) ||
          (v.categoria ?? "").toLowerCase().includes(termo),
      )
    : itens;

  function toggle(v: ViralVideo) {
    const url = urlDoAcervo(v);
    if (!url) return;
    setSel((prev) => {
      const next = new Map(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        if (next.size >= limite) return prev;
        next.set(url, { url, nome: v.titulo, thumb: v.thumb ? midiaUrl(v.thumb) : undefined });
      }
      return next;
    });
  }

  const totalSel = sel.size;
  const noLimite = totalSel >= limite;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end bg-black/80 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Escolher vídeos da plataforma"
    >
      <div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[88vh] sm:max-w-4xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
            <ShoppingBag className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-tight">Vídeos da plataforma</h2>
            <p className="text-xs text-muted-foreground">
              Escolha os produtos Shopee pra colocar sua marca. Até {limite} por lote.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por nome ou nicho..."
              className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {itens.length === 0 && carregando ? (
            <div className="grid place-items-center py-20 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : visiveis.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">
              Nenhum vídeo encontrado{termo ? ` pra "${busca}"` : ""}.
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {visiveis.map((v) => {
                  const url = urlDoAcervo(v);
                  const marcado = url ? sel.has(url) : false;
                  const bloqueado = !url || (!marcado && noLimite);
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => toggle(v)}
                        disabled={bloqueado}
                        title={!url ? "Esse vídeo ainda não está no servidor" : v.titulo}
                        className={cn(
                          "group relative block w-full overflow-hidden rounded-lg border bg-black text-left transition-all",
                          marcado ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50",
                          bloqueado && !marcado && "cursor-not-allowed opacity-40",
                        )}
                        style={{ aspectRatio: "9 / 16" }}
                      >
                        {v.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={midiaUrl(v.thumb)}
                            alt={v.titulo}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="grid size-full place-items-center bg-gradient-to-b from-primary/15 to-muted">
                            <ShoppingBag className="size-5 text-primary/60" />
                          </div>
                        )}

                        {v.emAlta && (
                          <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            <Flame className="size-2.5 fill-white" />
                            Alta
                          </span>
                        )}

                        <span
                          className={cn(
                            "absolute right-1 top-1 grid size-5 place-items-center rounded-md border transition-colors",
                            marcado
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-white/70 bg-black/40 text-transparent",
                          )}
                        >
                          <Check className="size-3.5" />
                        </span>

                        <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-medium leading-tight text-white">
                          {v.titulo}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div ref={sentinela} className="h-8" />
              {carregando && (
                <div className="grid place-items-center py-4 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 p-3">
          <p className="text-sm">
            <b className={totalSel ? "text-primary" : ""}>{totalSel}</b>
            <span className="text-muted-foreground"> selecionado(s){noLimite ? ` (máx. ${limite})` : ""}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onFechar}>
              Cancelar
            </Button>
            <Button size="sm" disabled={totalSel === 0} onClick={() => onConfirmar(Array.from(sel.values()))}>
              <Check className="size-4" />
              Usar {totalSel > 0 ? totalSel : ""} vídeo{totalSel === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
