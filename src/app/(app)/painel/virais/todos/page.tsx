import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { getViralVideosPagina } from "@/lib/virais";
import { requireAssinatura } from "@/lib/dal";
import { ViraisGaleria } from "@/components/app/virais-galeria";

export const metadata: Metadata = { title: "Cortes Shopee" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 30;

/** Grade paginada NO SERVIDOR (opcionalmente de um nicho). */
export default async function ViraisTodosPage({
  searchParams,
}: {
  searchParams: Promise<{ nicho?: string; page?: string }>;
}) {
  const user = await requireAssinatura();
  const sp = await searchParams;
  const nicho = (sp.nicho ?? "").trim();
  const pagina = Math.max(1, Number(sp.page) || 1);

  const { itens, total } = await getViralVideosPagina({
    nicho: nicho || undefined,
    pagina,
    porPagina: POR_PAGINA,
  });

  const baseHref = `/painel/virais/todos${nicho ? `?nicho=${encodeURIComponent(nicho)}` : ""}`;

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
          {total.toLocaleString("pt-BR")} cortes
          {nicho ? ` no nicho ${nicho}` : ""}. Clique pra assistir e baixe o que quiser.
        </p>
      </div>

      <ViraisGaleria
        itens={itens}
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        baseHref={baseHref}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
