import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Scissors, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BaixarTodos } from "@/components/app/baixar-todos";
import { ExcluirVideo } from "@/components/app/excluir-video";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { AutoAtualizar } from "@/components/app/auto-atualizar";
import { StatusBadge } from "@/components/app/status-badge";
import { requireUser } from "@/lib/dal";
import { getJobDoUsuario } from "@/lib/jobs";
import { midiaUrl } from "@/lib/utils";
import { drivePreview, driveDownload } from "@/lib/drive";

export const metadata: Metadata = { title: "Cortes do vídeo" };
export const dynamic = "force-dynamic";

export default async function CortesDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const video = await getJobDoUsuario(user.id, id);
  if (!video) notFound();

  const midias = video.midias ?? [];
  const arquivos = midias
    .map((m) => (m.driveId ? driveDownload(m.driveId) : m.arquivo))
    .filter(Boolean);
  const processando =
    video.status === "na_fila" || video.status === "renderizando";

  return (
    <div className="space-y-6">
      {/* atualiza sozinho enquanto cortes ainda estão chegando (streaming) */}
      <AutoAtualizar ativo={processando} />

      <div>
        <Link
          href="/painel"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar pra Meus vídeos
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Scissors className="size-6 text-primary" />
            {video.produto}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
            <StatusBadge status={video.status} />
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {midias.length} {midias.length === 1 ? "corte" : "cortes"}
            </span>
            {processando && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-400">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
                chegando…
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {midias.length > 0 && <BaixarTodos arquivos={arquivos} />}
          <ExcluirVideo id={video.id} />
        </div>
      </div>

      {video.status === "erro" && video.erro && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {video.erro}
        </p>
      )}

      {midias.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border py-20 text-center">
          <Scissors className="size-7 text-primary/60" />
          <p className="mt-3 font-medium">
            {processando ? "Gerando os cortes…" : "Nenhum corte ainda"}
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {processando
              ? "Os cortes vão aparecendo aqui conforme ficam prontos."
              : "Esse vídeo não gerou cortes."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {midias.map((m, i) => (
            <div
              key={m.arquivo}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {m.driveId ? (
                <iframe
                  src={drivePreview(m.driveId)}
                  title={`Corte ${i + 1}`}
                  loading="lazy"
                  allow="autoplay; encrypted-media; fullscreen"
                  className="aspect-[9/16] w-full bg-black"
                />
              ) : (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  poster={m.thumb ? midiaUrl(m.thumb) : undefined}
                  className="aspect-[9/16] w-full bg-black object-contain"
                >
                  <source src={midiaUrl(m.arquivo)} type="video/mp4" />
                </video>
              )}
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Corte {i + 1}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <a
                        href={m.driveId ? driveDownload(m.driveId) : midiaUrl(m.arquivo)}
                        download
                        target={m.driveId ? "_blank" : undefined}
                        rel={m.driveId ? "noreferrer" : undefined}
                      />
                    }
                  >
                    <Download className="size-4" />
                    Baixar
                  </Button>
                </div>
                {m.hashtags && (
                  <div className="flex items-start gap-1.5">
                    <Hash className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <p className="break-words text-xs text-primary">
                      {m.hashtags}
                    </p>
                  </div>
                )}
                {m.legenda && (
                  <CopyLinkButton
                    link={m.legenda}
                    label="Copiar legenda"
                    className="w-auto"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
