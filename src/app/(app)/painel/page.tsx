import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/app/video-card";
import { AutoAtualizar } from "@/components/app/auto-atualizar";
import { requireUser } from "@/lib/dal";
import { getJobsDoUsuario } from "@/lib/jobs";

export const metadata: Metadata = {
  title: "Meus vídeos",
};

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const user = await requireUser();
  const videos = await getJobsDoUsuario(user.id);

  const prontos = videos.filter((v) => v.status === "pronto").length;
  const emProducao = videos.filter(
    (v) =>
      v.status === "na_fila" ||
      v.status === "renderizando" ||
      v.status === "processando",
  ).length;

  return (
    <div className="space-y-6">
      {/* enquanto tem vídeo em produção, atualiza a página sozinho */}
      <AutoAtualizar ativo={emProducao > 0} />

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus vídeos</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {videos.length} no total
            </span>
            <span className="rounded-full bg-primary/12 px-2.5 py-1 text-primary">
              {prontos} prontos
            </span>
            {emProducao > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-400">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
                {emProducao} em produção
              </span>
            )}
          </div>
        </div>
        <Button size="lg" className="h-11" render={<Link href="/painel/novo" />}>
          <Sparkles className="size-4" />
          Novo vídeo
        </Button>
      </div>

      {/* Lista */}
      {videos.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-grid-glow py-20 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/12">
            <Sparkles className="size-7 text-primary" />
          </div>
          <p className="mt-4 font-medium">Nenhum vídeo ainda</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Crie seu primeiro vídeo em poucos cliques - a IA escreve a copy e
            monta tudo.
          </p>
          <Button size="lg" className="mt-5 h-11" render={<Link href="/painel/novo" />}>
            <Sparkles className="size-4" />
            Criar primeiro vídeo
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
