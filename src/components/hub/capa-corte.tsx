"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Download, TrendingUp, Flame, ExternalLink, Pencil, X } from "lucide-react";
import { midiaUrl, vendidosLabel, capaCorte } from "@/lib/utils";
import { drivePreview, driveDownload } from "@/lib/drive";
import { CorteThumb } from "@/components/hub/corte-thumb";
import type { ViralVideo } from "@/lib/types";

/** 6 gradientes pra dar vida à parede mesmo sem thumbnail (escolhido pelo id). */
const GRADIENTES = [
  "from-emerald-500/30 via-card to-background",
  "from-cyan-500/30 via-card to-background",
  "from-fuchsia-500/30 via-card to-background",
  "from-amber-500/30 via-card to-background",
  "from-rose-500/30 via-card to-background",
  "from-violet-500/30 via-card to-background",
];

function gradDe(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTES[h % GRADIENTES.length];
}

function duracao(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Capa grande de um corte (estilo Netflix), 9:16. Hover destaca + revela as ações. */
export function CapaCorte({ video }: { video: ViralVideo }) {
  const [aberto, setAberto] = useState(false);

  // Baixar: link direto (Drive) ou arquivo local.
  const baixar = video.driveId ? driveDownload(video.driveId) : midiaUrl(video.arquivo);
  // Player inline (modal): iframe do Drive, ou o próprio arquivo local.
  const preview = video.driveId ? drivePreview(video.driveId) : undefined;
  const arquivoLocal = !video.driveId && video.arquivo ? midiaUrl(video.arquivo) : undefined;
  const podeAssistir = !!(preview || arquivoLocal);
  // "Editar esse": abre o Editor com uma CÓPIA (URL mesma-origem, sem CORS).
  // Drive passa pelo proxy /api/drive-video; arquivo local já é mesma-origem.
  const editUrl = video.driveId
    ? `/api/drive-video/${video.driveId}`
    : video.arquivo
      ? midiaUrl(video.arquivo)
      : null;
  const editorHref = editUrl
    ? `/painel/novo?video=${encodeURIComponent(editUrl)}&nome=${encodeURIComponent(video.titulo)}`
    : null;

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
        className={`relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-gradient-to-b ${gradDe(
          video.id,
        )} shadow-sm ring-1 ring-inset ring-white/5 transition-all duration-200 group-hover:scale-[1.04] group-hover:border-primary/60 group-hover:shadow-xl group-hover:shadow-primary/20`}
      >
        <CorteThumb
          thumbId={video.thumbDriveId}
          fallback={capaCorte(video)}
          alt={video.titulo}
          className="size-full object-cover"
        />

        {/* selo Viral (foguinho) */}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-orange-400 backdrop-blur-sm">
          <Flame className="size-3 fill-orange-400" />
          Viral
        </span>

        {/* play central - abre o player inline (modal), sem sair da plataforma */}
        {podeAssistir ? (
          <button
            type="button"
            onClick={() => setAberto(true)}
            aria-label="Assistir"
            className="absolute inset-0 z-10 grid cursor-pointer place-items-center"
          >
            <span className="grid size-11 place-items-center rounded-full bg-background/55 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="size-5 fill-white text-white" />
            </span>
          </button>
        ) : (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-11 place-items-center rounded-full bg-background/55 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="size-5 fill-white text-white" />
            </span>
          </div>
        )}

        {/* duração */}
        <span className="absolute bottom-2 right-2 z-20 rounded bg-black/65 px-1.5 text-[11px] font-medium text-white">
          {duracao(video.duracaoSeg)}
        </span>

        {/* rodapé com ações (revela no hover no desktop; sempre visível no mobile) */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex translate-y-0 flex-col gap-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6 opacity-100 transition-all duration-200 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          {editorHref && (
            <Link
              href={editorHref}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-semibold text-primary-foreground"
            >
              <Pencil className="size-3.5" />
              Editar esse
            </Link>
          )}
          {baixar && (
            <a
              href={baixar}
              download
              {...(video.driveId ? { target: "_blank", rel: "noreferrer" } : {})}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/25 bg-black/40 text-xs font-semibold text-white backdrop-blur-sm hover:border-primary/60"
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
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-white/25 bg-black/40 text-xs font-semibold text-white backdrop-blur-sm hover:border-primary/60"
            >
              <ExternalLink className="size-3.5" />
              Ver produto
            </a>
          )}
        </div>
      </div>

      {/* título + prova social */}
      <p className="mt-1.5 line-clamp-1 text-xs font-medium">{video.titulo}</p>
      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
        <TrendingUp className="size-3" />
        {vendidosLabel(video.id)}
      </span>

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
                className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
          </div>
        </div>
      )}
    </div>
  );
}
