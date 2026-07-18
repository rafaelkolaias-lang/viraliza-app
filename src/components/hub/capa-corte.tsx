"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Download, TrendingUp, Flame, ExternalLink, Pencil, X, Tag, Stamp } from "lucide-react";
import { midiaUrl, linkBaixar, vendidosLabel, capaCorte } from "@/lib/utils";
import { drivePreview, driveDownload } from "@/lib/drive";
import { CorteThumb } from "@/components/hub/corte-thumb";
import {
  guardarFontesMarca,
  podeColocarMarca,
  ROTA_MARCA_LOTE,
} from "@/lib/marca-lote-client";
import type { ViralVideo } from "@/lib/types";

function duracao(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Capa grande de um corte (estilo Netflix), 9:16. Passa o mouse: o vídeo toca sozinho. */
export function CapaCorte({ video }: { video: ViralVideo }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);

  // "Colocar marca": leva o vídeo pra ferramenta de marca em lote (só serverrk).
  const podeMarca = podeColocarMarca(video.arquivo);
  function colocarMarca() {
    if (!video.arquivo) return;
    guardarFontesMarca([
      {
        url: video.arquivo,
        nome: video.titulo,
        thumb: video.thumb ? midiaUrl(video.thumb) : undefined,
      },
    ]);
    router.push(ROTA_MARCA_LOTE);
  }

  // Baixar: Drive segue direto (abre em nova aba); arquivo nosso passa pelo
  // linkBaixar, que força o download de verdade no celular (iOS/Android).
  const baixar = video.driveId
    ? driveDownload(video.driveId)
    : linkBaixar(midiaUrl(video.arquivo), video.titulo);
  // Player inline (modal): iframe do Drive, ou o próprio arquivo local.
  const preview = video.driveId ? drivePreview(video.driveId) : undefined;
  const arquivoLocal = !video.driveId && video.arquivo ? midiaUrl(video.arquivo) : undefined;
  const podeAssistir = !!(preview || arquivoLocal);
  // Preview que toca no hover: arquivo do serverrk direto, ou proxy do Drive (mesma-origem).
  const previewSrc = video.arquivo
    ? midiaUrl(video.arquivo)
    : video.driveId
      ? `/api/drive-video/${video.driveId}`
      : null;
  // "Editar esse": abre o Editor com uma CÓPIA (URL mesma-origem, sem CORS).
  const editUrl = video.driveId
    ? `/api/drive-video/${video.driveId}`
    : video.arquivo
      ? midiaUrl(video.arquivo)
      : null;
  const editorHref = editUrl
    ? `/painel/novo?video=${encodeURIComponent(editUrl)}&nome=${encodeURIComponent(video.titulo)}`
    : null;

  // hover no desktop: começa a tocar (mudo, em loop); sai: pausa e volta pro início
  function tocarHover() {
    const v = vidRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }
  function pararHover() {
    const v = vidRef.current;
    if (!v) return;
    v.pause();
    try {
      v.currentTime = 0;
    } catch {
      /* alguns navegadores reclamam antes de carregar; ignora */
    }
  }

  // fecha o modal com ESC + trava o scroll do fundo
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <div className="group relative w-[150px] shrink-0 sm:w-[170px]">
      <div
        onMouseEnter={tocarHover}
        onMouseLeave={pararHover}
        className="relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-inset ring-white/5 transition-all duration-200 group-hover:scale-[1.04] group-hover:border-primary/60 group-hover:shadow-xl group-hover:shadow-primary/20"
      >
        {/* base: thumbnail (paint instantâneo) */}
        <CorteThumb
          thumbId={video.thumbDriveId}
          fallback={capaCorte(video)}
          alt={video.titulo}
          className="size-full object-cover"
        />

        {/* vídeo que aparece e toca no hover (por cima do thumb) */}
        {previewSrc && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={vidRef}
            src={previewSrc}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}

        {/* badge: Em alta (foguinho, degradê) quando bombando; senão Viral discreto */}
        {video.emAlta ? (
          <span className="absolute left-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <Flame className="size-3 fill-white" />
            Em alta
          </span>
        ) : (
          <span className="absolute left-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-orange-400 backdrop-blur-sm">
            <Flame className="size-3 fill-orange-400" />
            Viral
          </span>
        )}

        {/* play central - abre o player inline (modal), sem sair da plataforma.
            Some no hover pra não tapar o preview em vídeo. */}
        {podeAssistir ? (
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Assistir"
            className="absolute inset-0 z-10 grid cursor-pointer place-items-center"
          >
            <span className="grid size-11 place-items-center rounded-full bg-background/55 backdrop-blur-sm transition-all duration-200 group-hover:scale-90 group-hover:opacity-0">
              <Play className="size-5 fill-white text-white" />
            </span>
          </button>
        ) : (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-11 place-items-center rounded-full bg-background/55 backdrop-blur-sm">
              <Play className="size-5 fill-white text-white" />
            </span>
          </div>
        )}

        {/* duração */}
        <span className="absolute bottom-2 right-2 z-20 rounded bg-black/65 px-1.5 text-[11px] font-medium text-white">
          {duracao(video.duracaoSeg)}
        </span>

        {/* rodapé com ações (revela no hover no desktop; sempre visível no mobile) */}
        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6 opacity-100 transition-all duration-200 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          {editorHref && (
            <Link
              href={editorHref}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              <Pencil className="size-3.5" />
              Editar esse
            </Link>
          )}
          {podeMarca && (
            <button
              type="button"
              onClick={colocarMarca}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/25 bg-black/40 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:border-primary/60"
            >
              <Stamp className="size-3.5" />
              Colocar marca
            </button>
          )}
          {baixar && (
            <a
              href={baixar}
              download
              {...(video.driveId ? { target: "_blank", rel: "noreferrer" } : {})}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/25 bg-black/40 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:border-primary/60"
            >
              <Download className="size-3.5" />
              Baixar
            </a>
          )}
          {video.link && (
            <a
              href={video.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/25 bg-black/40 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:border-primary/60"
            >
              <ExternalLink className="size-3.5" />
              Ver produto
            </a>
          )}
        </div>
      </div>

      {/* título (2 linhas, cabe o nome do produto) + nicho + prova social */}
      <p className="mt-1.5 line-clamp-2 min-h-[2.25rem] text-xs font-medium leading-snug">
        {video.titulo}
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
          <TrendingUp className="size-3" />
          {vendidosLabel(video.id)}
        </span>
        {video.categoria && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Tag className="size-3" />
            {video.categoria}
          </span>
        )}
      </div>

      {/* ===== MODAL PLAYER (só monta quando aberto) ===== */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setAberto(false)}
        >
          <div
            className="relative w-full max-w-sm cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-white">{video.titulo}</p>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
              {preview ? (
                <iframe
                  src={preview}
                  title={video.titulo}
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                  className="size-full"
                />
              ) : (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={arquivoLocal} controls autoPlay playsInline className="size-full" />
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {editorHref && (
                <Link
                  href={editorHref}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                >
                  <Pencil className="size-4" />
                  Editar esse
                </Link>
              )}
              {baixar && (
                <a
                  href={baixar}
                  download
                  {...(video.driveId ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <Download className="size-4" />
                  Baixar
                </a>
              )}
            </div>
            {podeMarca && (
              <button
                type="button"
                onClick={colocarMarca}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 text-sm font-semibold text-white transition-colors hover:border-primary/60 hover:bg-white/20"
              >
                <Stamp className="size-4" />
                Colocar marca
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
