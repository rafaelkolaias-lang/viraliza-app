import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { ProdutosGaleria } from "@/components/app/produtos-galeria";
import { getProdutosPagina } from "@/lib/produtos";
import { requireAssinatura } from "@/lib/dal";

export const metadata: Metadata = { title: "Produtos virais" };
export const dynamic = "force-dynamic";

const POR_PAGINA = 30;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireAssinatura();
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.page) || 1);

  const { itens, total } = await getProdutosPagina({ pagina, porPagina: POR_PAGINA });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShoppingBag className="size-6 text-primary" />
          Produtos virais
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total.toLocaleString("pt-BR")} produtos que estão bombando - com a imagem e
          o link. Copie o link e vá direto pro produto.
        </p>
      </div>

      <ProdutosGaleria
        itens={itens}
        total={total}
        pagina={pagina}
        porPagina={POR_PAGINA}
        baseHref="/painel/produtos"
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
