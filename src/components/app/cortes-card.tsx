import Link from "next/link";
import { Scissors, Play, Film } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { ExcluirVideo } from "@/components/app/excluir-video";
import { BaixarTodos } from "@/components/app/baixar-todos";
import { CorteThumb } from "@/components/hub/corte-thumb";
import { Button } from "@/components/ui/button";
import { midiaUrl } from "@/lib/utils";
import { driveDownload } from "@/lib/drive";
import type { VideoJob } from "@/lib/types";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Card "capa" de um job de cortes: mostra uma capa, conta os cortes e leva
 *  pra página de detalhe (onde dá pra ver/rodar/baixar cada um). */
export function CortesCard({ video }: { video: VideoJob }) {
  const midias = video.midias ?? [];
  const capaMidia = midias.find((m) => m.driveId || m.thumb);
  const n = midias.length;
  const pronto = video.status === "pronto";
  // baixa do Drive quando tiver driveId, senão do arquivo local
  const arquivos = midias
    .map((m) => (m.driveId ? driveDownload(m.driveId) : m.arquivo))
    .filter(Boolean);
  const href = `/painel/videos/${video.id}`;

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <Link href={href} className="block">
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/15 to-muted">
          {capaMidia ? (
            <CorteThumb
              thumbId={capaMidia.thumbDriveId}
              fallback={
                capaMidia.thumb ? midiaUrl(capaMidia.thumb)! : "/capas/youtube.png"
              }
              alt={video.produto}
              w={480}
              className="size-full object-cover opacity-90 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <Film className="size-8 text-primary/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <Scissors className="size-3.5" /> {n} {n === 1 ? "corte" : "cortes"}
          </span>
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            <span className="line-clamp-2 text-sm font-semibold text-white drop-shadow">
              {video.produto}
            </span>
            {pronto && n > 0 && (
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition group-hover:scale-110">
                <Play className="size-5" />
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge status={video.status} />
          <span>{fmtData.format(new Date(video.criadoEm))}</span>
        </div>
        <ExcluirVideo id={video.id} />
      </div>

      {video.status === "erro" && video.erro && (
        <p
          className="mx-3 mb-3 line-clamp-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
          title={video.erro}
        >
          {video.erro}
        </p>
      )}

      {pronto && n > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 p-3">
          <Button size="sm" render={<Link href={href} />}>
            <Scissors className="size-4" />
            Ver cortes
          </Button>
          <BaixarTodos arquivos={arquivos} />
        </div>
      )}
    </div>
  );
}
