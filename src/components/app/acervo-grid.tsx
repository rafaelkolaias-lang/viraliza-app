"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { driveThumb, drivePreview, driveDownload } from "@/lib/drive";

type Item = { id: string; nome: string };

/**
 * Card do acervo: capa 9:16 e prévia muda ao passar o mouse.
 *
 * O arquivo do vídeo só é carregado quando o mouse chega no card (o `src` é
 * setado no hover), senão a página abriria baixando dezenas de vídeos de uma vez.
 */
function AcervoCard({ item, onAbrir }: { item: Item; onAbrir: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function preverInicio() {
    const el = videoRef.current;
    if (!el) return;
    if (!el.src) el.src = driveDownload(item.id);
    el.play().catch(() => {});
  }

  function preverFim() {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }

  return (
    <button
      type="button"
      onClick={onAbrir}
      onMouseEnter={preverInicio}
      onMouseLeave={preverFim}
      aria-label={`Assistir ${item.nome}`}
      className="group relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-border/60 bg-black text-left transition-colors hover:border-primary/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={driveThumb(item.id, 400)}
        alt={item.nome}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* prévia muda por cima da capa */}
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/25">
        <span className="grid size-11 place-items-center rounded-full bg-black/55 opacity-80 backdrop-blur-sm transition-transform group-hover:scale-110">
          <Play className="size-4 fill-white text-white" />
        </span>
      </span>

      <p className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6 text-xs font-medium text-white">
        {item.nome}
      </p>
    </button>
  );
}

export function AcervoGrid({ itens }: { itens: Item[] }) {
  const [aberto, setAberto] = useState<Item | null>(null);

  const indexAtual = aberto ? itens.findIndex((i) => i.id === aberto.id) : -1;
  const temAnterior = indexAtual > 0;
  const temProximo = indexAtual >= 0 && indexAtual < itens.length - 1;

  const irParaAnterior = useCallback(() => {
    setAberto((atual) => {
      if (!atual) return atual;
      const i = itens.findIndex((x) => x.id === atual.id);
      return i > 0 ? itens[i - 1] : atual;
    });
  }, [itens]);

  const irParaProximo = useCallback(() => {
    setAberto((atual) => {
      if (!atual) return atual;
      const i = itens.findIndex((x) => x.id === atual.id);
      return i >= 0 && i < itens.length - 1 ? itens[i + 1] : atual;
    });
  }, [itens]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(null);
      if (e.key === "ArrowLeft") irParaAnterior();
      if (e.key === "ArrowRight") irParaProximo();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto, irParaAnterior, irParaProximo]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {itens.map((item) => (
          <AcervoCard key={item.id} item={item} onAbrir={() => setAberto(item)} />
        ))}
      </div>

      {/* MODAL PLAYER (iframe só quando aberto) */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setAberto(null)}
        >
          <div
            className="relative w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-white">
                {aberto.nome}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={irParaAnterior}
                  disabled={!temAnterior}
                  aria-label="Vídeo anterior"
                  className="grid size-8 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={irParaProximo}
                  disabled={!temProximo}
                  aria-label="Próximo vídeo"
                  className="grid size-8 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAberto(null)}
                  aria-label="Fechar"
                  className="grid size-8 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              {/* setas grandes nas laterais (só desktop, onde sobra espaço) */}
              {temAnterior && (
                <button
                  type="button"
                  onClick={irParaAnterior}
                  aria-label="Vídeo anterior"
                  className="absolute -left-14 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 md:grid"
                >
                  <ChevronLeft className="size-6" />
                </button>
              )}
              {temProximo && (
                <button
                  type="button"
                  onClick={irParaProximo}
                  aria-label="Próximo vídeo"
                  className="absolute -right-14 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 md:grid"
                >
                  <ChevronRight className="size-6" />
                </button>
              )}

              <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
                <iframe
                  key={aberto.id}
                  src={drivePreview(aberto.id)}
                  title={aberto.nome}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  className="size-full"
                />
              </div>
            </div>

            <div className="mt-2">
              <a
                href={driveDownload(aberto.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                <Download className="size-4" />
                Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
