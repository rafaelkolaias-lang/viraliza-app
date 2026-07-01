import { Play, Download, TrendingUp, Flame, ExternalLink } from "lucide-react";
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

/** Capa grande de um corte (estilo Netflix), 9:16. Hover destaca + revela o "Baixar". */
export function CapaCorte({ video }: { video: ViralVideo }) {
  // Hospedado no Drive: assiste pelo player do Drive, baixa pelo link direto.
  const baixar = video.driveId ? driveDownload(video.driveId) : midiaUrl(video.arquivo);
  const assistir = video.driveId ? drivePreview(video.driveId) : undefined;
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

        {/* play central - toca abre o player do Drive (nova aba; confiável no mobile) */}
        {assistir ? (
          <a
            href={assistir}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Assistir"
            className="absolute inset-0 z-10 grid place-items-center"
          >
            <span className="grid size-11 place-items-center rounded-full bg-background/55 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="size-5 fill-white text-white" />
            </span>
          </a>
        ) : (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-11 place-items-center rounded-full bg-background/55 backdrop-blur-sm transition-transform group-hover:scale-110">
              <Play className="size-5 fill-white text-white" />
            </span>
          </div>
        )}

        {/* duração */}
        <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 text-[11px] font-medium text-white">
          {duracao(video.duracaoSeg)}
        </span>

        {/* rodapé com baixar + ver produto (revela no hover) */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex translate-y-0 flex-col gap-1.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6 opacity-100 transition-all duration-200 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          {baixar && (
            <a
              href={baixar}
              download
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-semibold text-primary-foreground"
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
    </div>
  );
}
