"use client";

import { useMemo, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { midiaMovimento } from "@/lib/lab-midia";
import {
  categoriasDaCena,
  movimentosParaEstilo,
  type CategoriaMovimento,
  type CenaDaImagem,
  type Movimento,
} from "@/lib/movimentos";

/**
 * Biblioteca de movimentos do Lab: cards com vídeo de exemplo em loop, filtrados
 * por categoria. Os que combinam com o estilo de câmera escolhido vêm primeiro e
 * ganham selo. É opcional: sem escolher nada o vídeo sai normal.
 *
 * A lista depende do que EXISTE na imagem base (`cena`), não do estilo marcado lá
 * atrás: sem pessoa no quadro só rola POV/câmera, e com pessoa o POV nem aparece.
 */

function CardMovimento({
  m,
  ativo,
  recomendado,
  onEscolher,
}: {
  m: Movimento;
  ativo: boolean;
  recomendado: boolean;
  onEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativo}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card/60 text-left transition-all",
        ativo
          ? "border-primary ring-2 ring-primary/40"
          : "border-border/60 hover:border-primary/40 hover:bg-card",
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
        <video
          src={midiaMovimento(m.chave).video}
          poster={midiaMovimento(m.chave).poster}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="size-full object-cover"
        />
        {recomendado && !ativo && (
          <span className="absolute left-1 top-1 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
            Combina
          </span>
        )}
        {ativo && (
          <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow">
            <Check className="size-3" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <p className="text-xs font-semibold">{m.label}</p>
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {m.descricao}
        </p>
      </div>
    </button>
  );
}

export function LabMovimentos({
  estilo,
  cena,
  escolhido,
  onEscolher,
}: {
  estilo?: string | null;
  /** o que existe na imagem base: define quais movimentos são possíveis */
  cena: CenaDaImagem;
  escolhido: string | null;
  onEscolher: (chave: string | null) => void;
}) {
  // as categorias saem da MESMA lista que os cards: sem isso a barra oferece
  // uma aba que abre vazia quando o estilo filtra tudo daquela categoria
  const categorias = useMemo(() => categoriasDaCena(cena, estilo), [cena, estilo]);
  const lista = useMemo(() => movimentosParaEstilo(estilo, cena), [estilo, cena]);
  // abre já na categoria que combina com o estilo escolhido (POV abre em POV,
  // espelho abre em espelho); nas outras, começa na primeira disponível
  const preferida: CategoriaMovimento =
    estilo === "maos" ? "pov" : estilo === "espelho" ? "espelho" : estilo === "selfie" ? "selfie" : "movimentos";
  const inicial = categorias.some((c) => c.chave === preferida)
    ? preferida
    : (categorias[0]?.chave ?? "movimentos");
  const [cat, setCat] = useState<CategoriaMovimento>(inicial);
  const catAtual = categorias.some((c) => c.chave === cat) ? cat : inicial;
  const filtrada = lista.filter((m) => m.categoria === catAtual);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Escolha como a pessoa e a câmera se mexem no vídeo. É opcional: sem escolher,
        a IA anima do jeito dela.
      </p>

      {!cena.temPessoa && (
        <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {cena.temMaos
            ? "Sua imagem é POV (só as mãos aparecem), então a lista traz os movimentos de mão e de câmera. Movimento de corpo não entra: não tem pessoa no quadro pra mexer."
            : "Sua imagem mostra o produto parado, sem ninguém no quadro. Como não tem mão nem corpo pra animar, quem se move é a câmera."}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {categorias.map((c) => (
          <button
            key={c.chave}
            type="button"
            onClick={() => setCat(c.chave)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              catAtual === c.chave
                ? "border-primary bg-primary/12 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
        {escolhido && (
          <button
            type="button"
            onClick={() => onEscolher(null)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-foreground"
          >
            <X className="size-3.5" />
            Sem movimento
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {filtrada.map((m) => (
          <CardMovimento
            key={m.chave}
            m={m}
            ativo={escolhido === m.chave}
            recomendado={!!estilo && !!m.estilos?.includes(estilo)}
            onEscolher={() => onEscolher(escolhido === m.chave ? null : m.chave)}
          />
        ))}
      </div>

      {filtrada.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum movimento nessa categoria.
        </p>
      )}

      {escolhido && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Esse movimento entra no prompt do vídeo, junto com a fala e o cenário.
        </p>
      )}
    </div>
  );
}
