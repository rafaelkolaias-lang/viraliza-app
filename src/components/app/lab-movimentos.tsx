"use client";

import { useMemo, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS_MOVIMENTO,
  movimentosParaEstilo,
  type CategoriaMovimento,
  type Movimento,
} from "@/lib/movimentos";

/**
 * Biblioteca de movimentos do Lab: cards com vídeo de exemplo em loop, filtrados
 * por categoria. Os que combinam com o estilo de câmera escolhido vêm primeiro e
 * ganham selo. É opcional: sem escolher nada o vídeo sai normal.
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
          src={`/movimentos/${m.chave}.mp4`}
          poster={`/movimentos/${m.chave}.jpg`}
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
  escolhido,
  onEscolher,
}: {
  estilo?: string | null;
  escolhido: string | null;
  onEscolher: (chave: string | null) => void;
}) {
  // abre já na categoria que combina com o estilo escolhido (POV abre em POV,
  // espelho abre em espelho); nas outras, começa em "Movimentos"
  const inicial: CategoriaMovimento =
    estilo === "maos" ? "pov" : estilo === "espelho" ? "espelho" : estilo === "selfie" ? "selfie" : "movimentos";
  const [cat, setCat] = useState<CategoriaMovimento>(inicial);
  const lista = useMemo(() => movimentosParaEstilo(estilo), [estilo]);
  const filtrada = lista.filter((m) => m.categoria === cat);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Escolha como a pessoa e a câmera se mexem no vídeo. É opcional: sem escolher,
        a IA anima do jeito dela.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIAS_MOVIMENTO.map((c) => (
          <button
            key={c.chave}
            type="button"
            onClick={() => setCat(c.chave)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              cat === c.chave
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
