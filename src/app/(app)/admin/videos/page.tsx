import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { getVideosAdmin } from "@/lib/admin";
import { AdminVideos } from "@/components/app/admin-videos";

export const metadata: Metadata = { title: "Admin · Vídeos" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

const POR_PAGINA = 30;

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp?.page) || 1);
  const busca = (sp?.q ?? "").slice(0, 120);
  const { itens, total, porPagina } = await getVideosAdmin({
    pagina,
    porPagina: POR_PAGINA,
    busca,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Clapperboard className="size-6 text-primary" />
          Vídeos dos usuários
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {busca ? (
            <>
              {total.toLocaleString("pt-BR")} vídeo{total === 1 ? "" : "s"} em toda a
              plataforma para <b className="text-foreground">{busca}</b>, do mais recente
              pro mais antigo. Clique pra assistir.
            </>
          ) : (
            <>
              Todos os vídeos gerados na plataforma ({total.toLocaleString("pt-BR")}), do
              mais recente pro mais antigo. Clique pra assistir.
            </>
          )}
        </p>
      </div>

      <AdminVideos
        itens={itens}
        total={total}
        pagina={pagina}
        porPagina={porPagina}
        busca={busca}
      />
    </div>
  );
}
