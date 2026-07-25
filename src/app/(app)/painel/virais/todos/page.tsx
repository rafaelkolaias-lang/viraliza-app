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
  searchParams: Promise<{ nicho?: string; page?: string; r?: string }>;
}) {
  const user = await requireAssinatura();
  const sp = await searchParams;
  const nicho = (sp.nicho ?? "").trim();
  const pagina = Math.max(1, Number(sp.page) || 1);

  // semente de rotação: vem na URL pra manter o MESMO giro ao paginar. Se entrar
  // sem ela (link novo), gera uma nova -> cada visita mostra uma fatia diferente.
  const rSeed = Number(sp.r);
  const rotacaoSeed =
    Number.isFinite(rSeed) && rSeed > 0 ? rSeed : Math.floor(Math.random() * 1_000_000_000) + 1;

  const { itens, total } = await getViralVideosPagina({
    nicho: nicho || undefined,
    pagina,
    porPagina: POR_PAGINA,
    rotacaoSeed,
  });

  const params = new URLSearchParams();
  if (nicho) params.set("nicho", nicho);
  params.set("r", String(rotacaoSeed));
  const baseHref = `/painel/virais/todos?${params.toString()}`;

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
