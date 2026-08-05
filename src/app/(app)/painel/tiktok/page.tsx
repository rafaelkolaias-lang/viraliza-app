import type { Metadata } from "next";
import { Music2 } from "lucide-react";
import { guardaBiblioteca } from "@/lib/dal";
import { BibliotecaBloqueada } from "@/components/app/biblioteca-bloqueada";
import {
  buscarProdutosTiktok,
  categoriasTiktok,
  imagemProdutoTiktok,
  totalProdutosTiktok,
  type OrdemTiktok,
} from "@/lib/produtos-tiktok";
import { TiktokProdutos } from "@/components/app/tiktok-produtos";

export const metadata: Metadata = { title: "Produtos TikTok" };
export const dynamic = "force-dynamic";

const ORDENS_OK = ["rank", "vendas", "crescimento", "comissao", "preco"];

/**
 * Produtos do TikTok Shop: o mesmo papel da aba Shopee, com o acervo do Radar.
 * A filtragem toda roda no servidor e só a página atual desce pro navegador (24
 * de 382), então a tela abre leve mesmo no celular.
 */
export default async function TiktokPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    ordem?: string;
    alta?: string;
    page?: string;
  }>;
}) {
  const { liberado } = await guardaBiblioteca();
  if (!liberado) return <BibliotecaBloqueada />;
  const sp = await searchParams;

  const ordem = (ORDENS_OK.includes(sp.ordem ?? "") ? sp.ordem : "rank") as OrdemTiktok;
  const filtros = {
    busca: sp.q ?? "",
    categoria: sp.cat ?? "",
    ordem,
    soAlta: sp.alta === "1",
  };

  const { itens, total, pagina, paginas } = buscarProdutosTiktok({
    ...filtros,
    pagina: Math.max(1, Number(sp.page) || 1),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Music2 className="size-6 text-primary" />
          Produtos TikTok
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os {totalProdutosTiktok()} produtos que mais vendem no TikTok Shop, com vendas,
          faturamento e os anúncios que já estão rodando.
        </p>
      </div>

      <TiktokProdutos
        itens={itens.map((p) => ({ ...p, imagemUrl: imagemProdutoTiktok(p.imagem) }))}
        total={total}
        pagina={pagina}
        paginas={paginas}
        categorias={categoriasTiktok()}
        base="/painel/tiktok"
        filtros={filtros}
      />
    </div>
  );
}
