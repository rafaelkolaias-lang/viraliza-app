import type { Metadata } from "next";
import { Film } from "lucide-react";
import { CategoriaCard } from "@/components/hub/categoria-card";
import { getCategorias, getTotalAcervo } from "@/lib/acervo";
import { requireAssinatura } from "@/lib/dal";

export const metadata: Metadata = { title: "Acervo de cortes" };
export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

export default async function AcervoPage() {
  await requireAssinatura();
  const [categorias, total] = await Promise.all([
    getCategorias(),
    getTotalAcervo(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Film className="size-6 text-primary" />
          Acervo de cortes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          +{fmt(total)} cortes em {categorias.length} categorias - filmes,
          séries, desenhos, memes e mais. Clique numa categoria pra ver os
          vídeos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {categorias.map((c) => (
          <CategoriaCard
            key={c.slug}
            href={`/painel/acervo/${c.slug}`}
            titulo={c.nome}
            subtitulo={`${fmt(c.count)} vídeos`}
            capa={c.cover || "/capas/acervo.png"}
          />
        ))}
      </div>
    </div>
  );
}
