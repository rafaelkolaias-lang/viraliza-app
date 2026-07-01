"use client";

import { Play, Flame, Check, ExternalLink, Download, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { cn, midiaUrl, vendidosLabel } from "@/lib/utils";
import type { ViralVideo } from "@/lib/types";

function duracao(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ViralCard({
  video,
  selected,
  onToggle,
  isAdmin = false,
  onExcluir,
  excluindo = false,
}: {
  video: ViralVideo;
  selected: boolean;
  onToggle: () => void;
  isAdmin?: boolean;
  onExcluir?: () => void;
  excluindo?: boolean;
}) {
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border bg-card transition-colors",
        selected ? "border-primary" : "border-border hover:border-primary/40",
      )}
    >
      {/* Miniatura 9:16 - prioriza o thumbnail (rápido); só carrega o vídeo se não houver */}
      <div className="relative aspect-[9/16] bg-gradient-to-b from-primary/15 via-card to-muted">
        {video.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={midiaUrl(video.thumb)}
            alt={video.titulo}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : video.arquivo ? (
          <video
            src={`${midiaUrl(video.arquivo)}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <Play className="size-8 text-primary/70 transition-transform group-hover:scale-110" />
          </div>
        )}

        {/* ícone de play indicando que é vídeo */}
        {(video.thumb || video.arquivo) && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-10 place-items-center rounded-full bg-background/55 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="size-5 text-white" />
            </span>
          </div>
        )}

        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <Flame className="size-3" />
          Viral
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-background/85 px-1.5 text-[11px] font-medium">
          {duracao(video.duracaoSeg)}
        </span>

        {/* Seleção */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? "Desmarcar" : "Selecionar"}
          aria-pressed={selected}
          className={cn(
            "absolute right-2 top-2 grid size-6 place-items-center rounded-md border transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/60 bg-background/60 text-transparent hover:text-white/80",
          )}
        >
          <Check className="size-4" />
        </button>
      </div>

      {/* Info */}
      <div className="space-y-3 p-3">
        <div>
          <p className="line-clamp-2 text-sm font-medium">{video.titulo}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <TrendingUp className="size-3" />
            {vendidosLabel(video.id)}
          </span>
          {video.categoria && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {video.categoria}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {video.link && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 justify-start px-2 text-primary"
                render={
                  <a href={video.link} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ExternalLink className="size-4" />
                Ver produto
              </Button>
              <CopyLinkButton link={video.link} />
            </>
          )}

          {video.arquivo ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              render={<a href={midiaUrl(video.arquivo)} download />}
            >
              <Download className="size-4" />
              Baixar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                toast.info("Fica disponível quando o bot do Telegram rodar.")
              }
            >
              <Download className="size-4" />
              Baixar
            </Button>
          )}

          {isAdmin && onExcluir && (
            <Button
              variant="ghost"
              size="sm"
              disabled={excluindo}
              onClick={onExcluir}
              className="h-8 justify-start px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {excluindo ? "Excluindo..." : "Excluir"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
