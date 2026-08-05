"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Dock do Viraliza Lab: barra flutuante embaixo da tela que troca de FERRAMENTA
 * (funil guiado, vídeo livre, gerador de prompt).
 *
 * Não confundir com a trilha do topo: lá é onde você está DENTRO do funil, aqui é
 * qual ferramenta está aberta. Por isso ela fica fixa no rodapé, longe da trilha.
 * No celular vira só ícone; o nome aparece no hover (e sempre pro item ativo).
 *
 * Serve nos dois modos: item com `href` vira link e NAVEGA (é assim no Labs, onde
 * cada ferramenta tem rota própria); item sem `href` chama `onTrocar` e troca de
 * aba sem sair da página (é assim no Indique e Ganhe).
 */

export type ItemDock = {
  chave: string;
  label: string;
  Icone: LucideIcon;
  descricao: string;
  /** quando existe, o item leva pra essa tela em vez de trocar de aba */
  href?: string;
  /** só acende no endereço EXATO. Serve pro item cuja rota é começo das outras
   *  (o "Criar criativo" é `/painel/lab`, prefixo de todas as telas do Labs). */
  exato?: boolean;
};

export function LabDock({
  itens,
  atual,
  onTrocar,
}: {
  itens: ItemDock[];
  /** item aceso. Vazio acende nenhum: é o caso das telas do grupo que não são
   *  ferramenta nenhuma, como a de apresentação do Labs. */
  atual?: string;
  /** só nos itens sem `href`, que trocam de aba dentro da mesma tela */
  onTrocar?: (chave: string) => void;
}) {
  return (
    // No celular a barra sobe: lá embaixo ela encostava na boia do suporte, que
    // ocupa a faixa dos 3rem aos 6,5rem do rodapé. No desktop não há conflito
    // (a barra é centralizada e a boia fica bem na direita), então volta ao pé.
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center px-4 sm:bottom-6">
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border/70 bg-background/80 p-1.5 shadow-2xl backdrop-blur-xl">
        {itens.map((i) => {
          const ativo = atual === i.chave;
          const classe = cn(
            "group relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
            ativo
              ? "bg-primary/15 text-primary shadow-[0_0_20px_-4px_var(--color-primary)]"
              : "text-muted-foreground hover:bg-card hover:text-foreground",
          );
          const conteudo = (
            <>
              <i.Icone
                className={cn(
                  "size-5 shrink-0 transition-transform group-hover:scale-110",
                  ativo && "drop-shadow-[0_0_6px_var(--color-primary)]",
                )}
              />
              {/* o nome só ocupa espaço no item ativo (e no hover, em tela grande) */}
              <span className={cn("hidden whitespace-nowrap sm:inline", !ativo && "sm:hidden")}>
                {i.label}
              </span>
              {/* balãozinho com o nome quando passa o mouse nos inativos */}
              {!ativo && (
                <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/70 bg-background/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur group-hover:block">
                  {i.label}
                </span>
              )}
              {ativo && (
                <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
              )}
            </>
          );

          return i.href ? (
            <Link
              key={i.chave}
              href={i.href}
              aria-current={ativo ? "page" : undefined}
              title={`${i.label}: ${i.descricao}`}
              className={classe}
            >
              {conteudo}
            </Link>
          ) : (
            <button
              key={i.chave}
              type="button"
              onClick={() => onTrocar?.(i.chave)}
              aria-pressed={ativo}
              title={`${i.label}: ${i.descricao}`}
              className={classe}
            >
              {conteudo}
            </button>
          );
        })}
      </div>
    </div>
  );
}
