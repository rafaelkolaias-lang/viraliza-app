import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { CategoriaCard } from "@/components/hub/categoria-card";
import { getTotalVirais } from "@/lib/virais";
import { getTotalProdutos } from "@/lib/produtos";
import { requireAssinatura } from "@/lib/dal";

export const metadata: Metadata = { title: "Shopee" };
export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

export default async function ShopeePage() {
  await requireAssinatura();
  const [totalCortes, totalProdutos] = await Promise.all([
    getTotalVirais(),
    getTotalProdutos(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShoppingBag className="size-6 text-primary" />
          Shopee
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha entre os vídeos virais ou os produtos da Shopee.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <CategoriaCard
          href="/painel/virais"
          titulo="Vídeos Shopee"
          subtitulo={`+${fmt(totalCortes)} vídeos`}
          capa="/capas/shopee.png"
        />
        <CategoriaCard
          href="/painel/produtos"
          titulo="Produtos Shopee"
          subtitulo={`+${fmt(totalProdutos)} produtos`}
          capa="/capas/shopee.png"
        />
      </div>
    </div>
  );
}
