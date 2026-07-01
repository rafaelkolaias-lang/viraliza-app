"use client";

import { useEffect, useState } from "react";
import { Play, Download, X, ExternalLink } from "lucide-react";
import { driveThumb, drivePreview, driveDownload } from "@/lib/drive";

type Item = { id: string; nome: string };

export function AcervoGrid({ itens }: { itens: Item[] }) {
  const [aberto, setAberto] = useState<Item | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {itens.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAberto(item)}
            className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-black text-left transition-all duration-200 hover:scale-[1.03] hover:border-primary/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={driveThumb(item.id, 320)}
              alt={item.nome}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/25">
              <span className="grid size-10 place-items-center rounded-full bg-black/55 opacity-80 backdrop-blur-sm transition-transform group-hover:scale-110">
                <Play className="size-4 fill-white text-white" />
              </span>
            </div>
            <p className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-medium text-white">
              {item.nome}
            </p>
          </button>
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
              <button
                type="button"
                onClick={() => setAberto(null)}
                aria-label="Fechar"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={drivePreview(aberto.id)}
                title={aberto.nome}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="size-full"
              />
            </div>
            <p className="mt-2 text-center text-[11px] text-white/55">
              No celular o player pode não abrir - toque em “Abrir no Drive”.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a
                href={drivePreview(aberto.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <ExternalLink className="size-4" />
                Abrir no Drive
              </a>
              <a
                href={driveDownload(aberto.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
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
