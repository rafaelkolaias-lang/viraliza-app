"use client";

import { useState } from "react";
import { driveThumb } from "@/lib/drive";

/**
 * Miniatura a partir de uma IMAGEM no Drive (`thumbId` = id do JPG do frame).
 *
 * IMPORTANTE: o Drive serve thumbnail de IMAGEM na hora (lh3 → 200), mas NÃO
 * serve poster de VÍDEO (lh3 → 404 sempre). Por isso só tentamos o lh3 quando
 * há `thumbId` (uma imagem). Sem `thumbId`, mostra o `fallback` direto, SEM
 * request - é o que evita o "tiroteio de 404" que travava a página do acervo
 * (centenas de vídeos tentando carregar um poster que não existe).
 */
export function CorteThumb({
  thumbId,
  fallback,
  alt,
  w = 320,
  className,
}: {
  thumbId?: string;
  fallback: string;
  alt: string;
  w?: number;
  className?: string;
}) {
  const inicial = thumbId ? driveThumb(thumbId, w) : fallback;
  const [src, setSrc] = useState(inicial);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
      className={className}
    />
  );
}
