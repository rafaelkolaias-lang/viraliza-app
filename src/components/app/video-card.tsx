import Link from "next/link";
import { Play, Download, Hash, Type, Pencil, Coins, RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/app/status-badge";
import { ExcluirVideo } from "@/components/app/excluir-video";
import { CortesCard } from "@/components/app/cortes-card";
import { CorteThumb } from "@/components/hub/corte-thumb";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { Button } from "@/components/ui/button";
import { midiaUrl } from "@/lib/utils";
import { driveDownload, drivePreview } from "@/lib/drive";
import type { VideoJob, VideoMidia } from "@/lib/types";

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

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      {/* Cabeçalho */}
      <div className="flex gap-4 p-4">
        {/* Miniatura 9:16 */}
        <div className="relative aspect-[9/16] w-[84px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-b from-primary/15 to-muted ring-1 ring-inset ring-white/5">
          {capaMidia ? (
            <CorteThumb
              thumbId={capaMidia.thumbDriveId}
              fallback={
                capaMidia.thumb ? midiaUrl(capaMidia.thumb)! : "/capas/shopee.png"
              }
              alt={video.produto}
              w={200}
              className="size-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <Play className="size-5 text-primary/70" />
            </div>
          )}
          {dur && (
            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
              {dur}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold leading-tight">
              {video.produto}
            </p>
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

      {/* Variantes prontas */}
      {pronto && midias.length > 0 && (
        <div className="space-y-3 border-t border-border bg-muted/20 p-4">
          {midias.map((m, i) => (
            <VarianteBloco
              key={m.arquivo}
              midia={m}
              indice={i}
              total={midias.length}
              produto={video.produto}
            />
          ))}
        </div>
      )}

      {/* Legado (sem legenda/thumb): só download */}
      {pronto && midias.length === 0 && saidas.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 p-4">
          {saidas.map((url, i) => (
            <Button
              key={url}
              size="sm"
              render={<a href={midiaUrl(url)} download />}
            >
              <Download className="size-4" />
              {saidas.length > 1 ? `Baixar v${i + 1}` : "Baixar vídeo"}
            </Button>
          ))}
        </div>
      )}

      {/* Reutilizar: reabre o editor com os mesmos ajustes (refazer/modificar) */}
      {pronto && video.tipo === "produto" && (
        <div className="border-t border-border bg-muted/10 px-4 py-3">
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/painel/novo?reutilizar=${video.id}`} />}
          >
            <RotateCcw className="size-4" />
            Reutilizar estes ajustes
          </Button>
        </div>
      )}
    </div>
  );
}

function VarianteBloco({
  midia,
  indice,
  total,
  produto,
}: {
  midia: VideoMidia;
  indice: number;
  total: number;
  produto: string;
}) {
  // URL mesma-origem é a ideal pra reabrir no editor (sem problema de CORS).
  const editUrl = midia.arquivo
    ? midiaUrl(midia.arquivo)
    : midia.driveId
      ? driveDownload(midia.driveId)
      : null;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      {total > 1 && (
        <span className="inline-flex items-center rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
          Variante {indice + 1}
        </span>
      )}

      {midia.legenda && (
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            <Type className="size-3" />
            Legenda
          </p>
          <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">
            {midia.legenda}
          </p>
        </div>
      )}

      {midia.hashtags && (
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            <Hash className="size-3" />
            Hashtags
          </p>
          <p className="mt-1 break-words text-sm text-primary">
            {midia.hashtags}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        {midia.driveId && (
          <Button
            size="sm"
            variant="outline"
            render={
              <a
                href={drivePreview(midia.driveId)}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <Play className="size-4" />
            Assistir
          </Button>
        )}
        <Button
          size="sm"
          render={
            <a
              href={midia.driveId ? driveDownload(midia.driveId) : midiaUrl(midia.arquivo)}
              download
              target={midia.driveId ? "_blank" : undefined}
              rel={midia.driveId ? "noreferrer" : undefined}
            />
          }
        >
          <Download className="size-4" />
          Baixar vídeo
        </Button>
        {editUrl && (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                href={`/painel/novo?video=${encodeURIComponent(editUrl)}&nome=${encodeURIComponent(produto)}`}
              />
            }
          >
            <Pencil className="size-4" />
            Editar
          </Button>
        )}
        {midia.legenda && (
          <CopyLinkButton
            link={midia.legenda}
            label="Copiar legenda"
            className="w-auto"
          />
        )}
        {midia.hashtags && (
          <CopyLinkButton
            link={midia.hashtags}
            label="Copiar hashtags"
            className="w-auto"
          />
        )}
      </div>
    </div>
  );
}
