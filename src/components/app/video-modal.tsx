"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Player em modal (lightbox) 9:16 - só monta o <video> quando abre, então a grade
 * não carrega vídeo nenhum (fica leve/fluida). Fecha no ESC, no X ou clicando fora.
 */
export function VideoModal({
  src,
  titulo,
  aberto,
  onFechar,
}: {
  src?: string;
  titulo?: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto || !src) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <video
          src={src}
          controls
          autoPlay
          playsInline
          className="max-h-[86vh] w-auto rounded-2xl bg-black shadow-2xl shadow-black/50 aspect-[9/16]"
        />
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute -right-3 -top-3 grid size-9 place-items-center rounded-full bg-white text-black shadow-lg transition-transform hover:scale-105"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
