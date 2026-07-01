import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { getViralVideos } from "@/lib/virais";
import { requireAssinatura } from "@/lib/dal";
import { ViraisGaleria } from "@/components/app/virais-galeria";

export const metadata: Metadata = { title: "Cortes Shopee" };
export const dynamic = "force-dynamic";

const BUCKET_SEM_NICHO = "Achadinhos";

/** Grade paginada com TODOS os cortes (opcionalmente filtrada por nicho). */
export default async function ViraisTodosPage({
  searchParams,
}: {
  searchParams: Promise<{ nicho?: string }>;
}) {
  const user = await requireAssinatura();
  const sp = await searchParams;
  const nicho = (sp.nicho ?? "").trim();

  const todos = await getViralVideos();
  const videos = nicho
    ? todos.filter((v) => (v.categoria?.trim() || BUCKET_SEM_NICHO) === nicho)
    : todos;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/painel/virais"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar aos nichos
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Flame className="size-6 text-orange-400" />
          {nicho || "Todos os cortes"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {videos.length.toLocaleString("pt-BR")} cortes
          {nicho ? ` no nicho ${nicho}` : ""}. Clique pra assistir e baixe o que quiser.
        </p>
      </div>

      <ViraisGaleria videos={videos} isAdmin={user.role === "admin"} />
    </div>
  );
}
