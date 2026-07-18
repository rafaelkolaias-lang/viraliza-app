"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Play, Download, Pencil, Type, Hash, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { midiaUrl, linkBaixar } from "@/lib/utils";
import { driveDownload } from "@/lib/drive";
import type { VideoJob, VideoMidia } from "@/lib/types";

// Limites do Shopee (vídeo): descrição curta + poucas hashtags.
const SHOPEE_DESC = 20;
const SHOPEE_TAGS = 5;

/** Primeiras N hashtags de uma string ("#a #b #c ..." -> "#a #b ..."). */
function primeirasTags(hashtags: string, n: number) {
  return (hashtags.match(/#[^\s#]+/g) ?? []).slice(0, n).join(" ");
}

/** Modal de detalhes do vídeo: toca o vídeo + legenda/hashtags + versão Shopee. */
export function VideoDetalhesModal({
  video,
  aberto,
  onFechar,
}: {
  video: VideoJob;
  aberto: boolean;
  onFechar: () => void;
}) {
  const midias = video.midias ?? [];
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (!aberto) return;
    setSel(0);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto || midias.length === 0) return null;

  const m: VideoMidia = midias[Math.min(sel, midias.length - 1)];
  const arquivoUrl = midiaUrl(m.arquivo); // mesma-origem (serverrk) = toca inline
  const src = arquivoUrl ?? (m.driveId ? driveDownload(m.driveId) : undefined); // download/editar
  const editUrl = src;
  const legenda = m.legenda?.trim() ?? "";
  const hashtags = m.hashtags?.trim() ?? "";
  const tags5 = primeirasTags(hashtags, SHOPEE_TAGS);
  const descShopee = legenda.slice(0, SHOPEE_DESC);
  const shopeeTexto = [descShopee, tags5].filter(Boolean).join("\n");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-3 backdrop-blur-sm animate-in fade-in duration-150 sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={video.produto}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Player 9:16 - vídeo do serverrk (media.univershoop.com), toca inline */}
        <div className="grid shrink-0 place-items-center bg-black p-3 md:w-[46%]">
          {arquivoUrl ? (
            <video
              src={arquivoUrl}
              controls
              autoPlay
              playsInline
              className="aspect-[9/16] max-h-[42vh] w-auto rounded-xl bg-black md:max-h-[82vh]"
            />
          ) : (
            <div className="grid aspect-[9/16] w-full max-w-[220px] place-items-center rounded-xl bg-muted text-center">
              <span className="px-4 text-xs text-muted-foreground">
                <Play className="mx-auto mb-2 size-8" />
                Vídeo indisponível pra tocar aqui.
              </span>
            </div>
          )}
        </div>

        {/* Detalhes (rolável) */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-5">
          <h2 className="pr-8 text-lg font-semibold leading-tight">{video.produto}</h2>

          {/* seletor de variantes */}
          {midias.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {midias.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSel(i)}
                  className={
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                    (i === sel
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground")
                  }
                >
                  Variante {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Pronto pro Shopee */}
          {(descShopee || tags5) && (
            <div className="mt-4 rounded-xl border border-primary/25 bg-primary/8 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <ShoppingBag className="size-3.5" />
                Pronto pro Shopee
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                O Shopee aceita até <b className="text-foreground">{SHOPEE_DESC} caracteres</b> de
                descrição e <b className="text-foreground">{SHOPEE_TAGS} hashtags</b>. Já deixamos
                cortadinho:
              </p>
              <div className="mt-2 space-y-1 rounded-lg bg-background/60 p-2.5 text-sm">
                {descShopee && <p className="font-medium">{descShopee}</p>}
                {tags5 && <p className="break-words text-primary">{tags5}</p>}
              </div>
              <CopyLinkButton
                link={shopeeTexto}
                label="Copiar pro Shopee"
                className="mt-2.5 w-full"
              />
            </div>
          )}

          {/* Legenda completa */}
          {legenda && (
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                <Type className="size-3.5" />
                Descrição completa
                <span className="ml-auto font-normal normal-case tracking-normal text-muted-foreground/60">
                  {legenda.length} caracteres
                </span>
              </p>
              <p className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-2.5 text-sm leading-relaxed">
                {legenda}
              </p>
              <CopyLinkButton link={legenda} label="Copiar descrição" className="mt-2 w-full" />
            </div>
          )}

          {/* Hashtags completas */}
          {hashtags && (
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                <Hash className="size-3.5" />
                Hashtags
              </p>
              <p className="mt-1.5 break-words rounded-lg bg-muted/30 p-2.5 text-sm text-primary">
                {hashtags}
              </p>
              <CopyLinkButton link={hashtags} label="Copiar todas as hashtags" className="mt-2 w-full" />
            </div>
          )}

          {/* Ações */}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {src && (
              <Button
                render={<a href={linkBaixar(src, video.produto)} download />}
              >
                <Download className="size-4" />
                Baixar vídeo
              </Button>
            )}
            {editUrl && (
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/painel/novo?video=${encodeURIComponent(editUrl)}&nome=${encodeURIComponent(video.produto)}`}
                  />
                }
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
          </div>
        </div>

        {/* Fechar */}
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
