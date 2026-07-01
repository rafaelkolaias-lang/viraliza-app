"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { ProdutoCard } from "@/components/app/produto-card";
import { Paginacao } from "@/components/app/paginacao";
import { excluirProduto } from "@/app/actions/produtos";
import type { ViralProduto } from "@/lib/types";

/** Grade de produtos paginada NO SERVIDOR (só a fatia da página atual). */
export function ProdutosGaleria({
  itens,
  total,
  pagina,
  porPagina,
  baseHref,
  isAdmin = false,
}: {
  itens: ViralProduto[];
  total: number;
  pagina: number;
  porPagina: number;
  baseHref: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [excluindo, startExcluir] = useTransition();
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  function irPara(p: number) {
    const sep = baseHref.includes("?") ? "&" : "?";
    router.push(`${baseHref}${sep}page=${p}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluir(p: ViralProduto) {
    if (!confirm(`Excluir "${p.titulo}"? Isso some pra todos os usuários.`)) return;
    startExcluir(async () => {
      const res = await excluirProduto(p.id);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      toast.success("Produto excluído.");
      router.refresh();
    });
  }

  if (total === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
        <ShoppingBag className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nenhum produto ainda</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Assim que o bot do Telegram baixar produtos novos, eles aparecem aqui
          automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {itens.map((p) => (
          <ProdutoCard
            key={p.id}
            produto={p}
            isAdmin={isAdmin}
            onExcluir={() => excluir(p)}
            excluindo={excluindo}
          />
        ))}
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={irPara} />
    </div>
  );
}
