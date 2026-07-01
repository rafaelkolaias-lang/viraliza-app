import { ExternalLink, ShoppingBag } from "lucide-react";
import { imagemProduto } from "@/lib/utils";
import type { ViralProduto } from "@/lib/types";

/** Capa de um produto viral (imagem). Hover revela "Ver na Shopee". */
export function CapaProduto({ produto }: { produto: ViralProduto }) {
  const img = imagemProduto(produto);
  return (
    <div className="group relative w-[150px] shrink-0 sm:w-[170px]">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 group-hover:scale-[1.04] group-hover:border-primary/50 group-hover:shadow-lg group-hover:shadow-primary/10">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={produto.titulo}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ShoppingBag className="size-7" />
          </div>
        )}

        {produto.link && (
          <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/85 to-transparent p-2 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            <a
              href={produto.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-xs font-semibold text-primary-foreground"
            >
              <ExternalLink className="size-3.5" />
              Ver na Shopee
            </a>
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-tight">
        {produto.titulo}
      </p>
    </div>
  );
}
