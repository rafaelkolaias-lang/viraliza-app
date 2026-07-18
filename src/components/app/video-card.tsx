"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Download, Coins, RotateCcw, Eye, Pencil, Stamp } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { ExcluirVideo } from "@/components/app/excluir-video";
import { CortesCard } from "@/components/app/cortes-card";
import { CorteThumb } from "@/components/hub/corte-thumb";
import { VideoDetalhesModal } from "@/components/app/video-detalhes-modal";
import { Button } from "@/components/ui/button";
import { midiaUrl, linkBaixar } from "@/lib/utils";
import { driveDownload } from "@/lib/drive";
import {
  guardarFontesMarca,
  podeColocarMarca,
  ROTA_MARCA_LOTE,
} from "@/lib/marca-lote-client";
import type { VideoJob } from "@/lib/types";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function duracao(seg?: number) {
  if (!seg) return null;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function VideoCard({ video }: { video: VideoJob }) {
  // hooks sempre no topo (antes de qualquer return) pra não quebrar a ordem dos hooks
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  // Cortes do clipador viram uma "capa" que abre a página com todos os cortes.
  if (video.tipo === "cortes") {
    return <CortesCard video={video} />;
  }

  const formatoLabel = video.formato === "voz" ? "Voz narrada" : "Legenda";
  const dur = duracao(video.duracaoSeg);
  const midias = video.midias ?? [];
  const saidas = video.saidas ?? [];
  const pronto = video.status === "pronto";
  const capaMidia = midias.find((m) => m.driveId || m.thumb);
  const temModal = pronto && midias.length > 0;

  // src bruto da 1ª saída (variante 1 ou legado) - serve pra baixar e pra editar
  const primeiraSrc = (() => {
    const m = midias[0];
    if (m) return midiaUrl(m.arquivo) ?? (m.driveId ? driveDownload(m.driveId) : undefined);
    if (saidas[0]) return midiaUrl(saidas[0]);
    return undefined;
  })();
  const baixarPrimeira = primeiraSrc ? linkBaixar(primeiraSrc, video.produto) : null;

  // "Colocar marca": manda o vídeo pronto pra ferramenta de marca em lote (só serverrk)
  const podeMarca = pronto && podeColocarMarca(primeiraSrc);
  function colocarMarca() {
    if (!primeiraSrc) return;
    guardarFontesMarca([
      {
        url: primeiraSrc,
        nome: video.produto,
        thumb: capaMidia?.thumb ? midiaUrl(capaMidia.thumb) : undefined,
      },
    ]);
    router.push(ROTA_MARCA_LOTE);
  }

  return (
    <>
      <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        <div className="flex gap-4 p-4">
          {/* Miniatura 9:16 (clica pra abrir o player) */}
          <button
            type="button"
            onClick={() => temModal && setAberto(true)}
            disabled={!temModal}
            aria-label={temModal ? "Assistir vídeo" : undefined}
            className="relative aspect-[9/16] w-[84px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-primary/15 to-muted ring-1 ring-inset ring-white/5 disabled:cursor-default"
          >
            {capaMidia ? (
              <CorteThumb
                thumbId={capaMidia.thumbDriveId}
                fallback={capaMidia.thumb ? midiaUrl(capaMidia.thumb)! : "/capas/shopee.png"}
                alt={video.produto}
                w={200}
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center">
                <Play className="size-5 text-primary/70" />
              </div>
            )}
            {temModal && (
              <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="grid size-9 place-items-center rounded-full bg-white/95 text-black shadow-lg">
                  <Play className="size-4 translate-x-px fill-current" />
                </span>
              </span>
            )}
            {dur && (
              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                {dur}
              </span>
            )}
          </button>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-semibold leading-tight">{video.produto}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge status={video.status} />
                <ExcluirVideo id={video.id} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill>{formatoLabel}</Pill>
              <Pill>
                {video.variantes} {video.variantes > 1 ? "variantes" : "variante"}
              </Pill>
              <Pill>{fmtData.format(new Date(video.criadoEm))}</Pill>
              {video.creditosGastos != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Coins className="size-3" />
                  {video.creditosGastos.toLocaleString("pt-BR")} créditos
                </span>
              )}
            </div>
            {(video.status === "renderizando" || video.status === "processando") &&
              video.etapa && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
                  {video.etapa}
                </p>
              )}
            {video.status === "erro" && video.erro && (
              <p
                className="mt-2 line-clamp-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
                title={video.erro}
              >
                {video.erro}
              </p>
            )}
          </div>
        </div>

        {/* Ações rápidas (uniforme em todos os cards prontos) */}
        {pronto && (temModal || baixarPrimeira) && (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border bg-muted/15 p-3">
            {temModal && (
              <Button size="sm" onClick={() => setAberto(true)}>
                <Eye className="size-4" />
                Ver detalhes
              </Button>
            )}
            {baixarPrimeira && (
              <Button
                size="sm"
                variant="outline"
                render={<a href={baixarPrimeira} download />}
              >
                <Download className="size-4" />
                Baixar
              </Button>
            )}
            {primeiraSrc && (
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link
                    href={`/painel/novo?video=${encodeURIComponent(primeiraSrc)}&nome=${encodeURIComponent(video.produto)}`}
                  />
                }
              >
                <Pencil className="size-4" />
                Editar
              </Button>
            )}
            {podeMarca && (
              <Button size="sm" variant="outline" onClick={colocarMarca}>
                <Stamp className="size-4" />
                Colocar marca
              </Button>
            )}
            {video.tipo === "produto" && (
              <Button
                size="sm"
                variant="ghost"
                render={<Link href={`/painel/novo?reutilizar=${video.id}`} />}
              >
                <RotateCcw className="size-4" />
                Refazer
              </Button>
            )}
          </div>
        )}
      </div>

      {temModal && (
        <VideoDetalhesModal video={video} aberto={aberto} onFechar={() => setAberto(false)} />
      )}
    </>
  );
}
