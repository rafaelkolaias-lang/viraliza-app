import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { ProdutosGaleria } from "@/components/app/produtos-galeria";
import { getViralProdutos } from "@/lib/produtos";
import { getCurrentUser, requireAssinatura } from "@/lib/dal";

export const metadata: Metadata = { title: "Produtos virais" };

// sempre lê fresco (pra aparecer o que o bot acabou de subir)
export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  await requireAssinatura();
  const produtos = await getViralProdutos();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShoppingBag className="size-6 text-primary" />
          Produtos virais
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produtos que estão bombando - com a imagem e o link. Copie o link e vá
          direto pro produto.
        </p>
      </div>

      <ProdutosGaleria produtos={produtos} isAdmin={isAdmin} />
    </div>
  );
}
