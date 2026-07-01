"use client";

/* eslint-disable @next/next/no-img-element */
import { ShoppingBag, ExternalLink, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/components/app/copy-link-button";
import { imagemProduto, vendidosLabel } from "@/lib/utils";
import type { ViralProduto } from "@/lib/types";

export function ProdutoCard({
  produto,
  isAdmin = false,
  onExcluir,
  excluindo = false,
}: {
  produto: ViralProduto;
  isAdmin?: boolean;
  onExcluir?: () => void;
  excluindo?: boolean;
}) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      {/* Imagem do produto */}
      <div className="relative aspect-square bg-gradient-to-b from-primary/10 via-card to-muted">
        {produto.driveId || produto.arquivo ? (
          <img
            src={imagemProduto(produto)}
            alt={produto.titulo}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <ShoppingBag className="size-8 text-primary/70" />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <ShoppingBag className="size-3" />
          Produto
        </span>
      </div>

      {/* Info */}
      <div className="space-y-3 p-3">
        <div>
          <p className="line-clamp-2 text-sm font-medium">{produto.titulo}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <TrendingUp className="size-3" />
            {vendidosLabel(produto.id)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {produto.link ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 justify-start px-2 text-primary"
                render={
                  <a href={produto.link} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ExternalLink className="size-4" />
                Ver produto
              </Button>
              <CopyLinkButton link={produto.link} />
            </>
          ) : (
            <p className="px-2 text-xs text-muted-foreground">Sem link no anúncio</p>
          )}

          {isAdmin && onExcluir && (
            <Button
              variant="ghost"
              size="sm"
              disabled={excluindo}
              onClick={onExcluir}
              className="h-8 justify-start px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              {excluindo ? "Excluindo..." : "Excluir"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
