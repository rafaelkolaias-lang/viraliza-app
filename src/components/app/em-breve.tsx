import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

/**
 * Tela de "EM BREVE": a seção já existe no menu, o conteúdo ainda não.
 *
 * Ela mostra o que vem por aí em vez de só avisar que está vazio. A pessoa sai
 * sabendo o que esperar, e a gente já ocupa o lugar no menu antes de lançar.
 */
export function EmBreve({
  etiqueta,
  titulo,
  destaque,
  descricao,
  Icone,
  itens = [],
  rodape,
}: {
  etiqueta: string;
  titulo: string;
  /** parte do título que sai na cor da marca */
  destaque?: string;
  descricao: string;
  Icone: LucideIcon;
  itens?: { titulo: string; texto: string }[];
  rodape?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/50 px-6 py-14 text-center shadow-[0_0_60px_-30px_var(--color-primary)] sm:px-10 sm:py-20">
        {/* brilho de fundo, só enfeite */}
        <span className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative flex flex-col items-center gap-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary sm:text-xs">
            <Sparkles className="size-3.5" />
            {etiqueta}
          </span>

          <span className="grid size-20 place-items-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_40px_-12px_var(--color-primary)]">
            <Icone className="size-10" />
          </span>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {titulo} {destaque && <span className="text-primary">{destaque}</span>}
          </h1>

          {/* o "EM BREVE" gigante: é o recado da tela */}
          <p className="bg-gradient-to-b from-primary to-primary/40 bg-clip-text text-5xl font-black tracking-[0.18em] text-transparent drop-shadow-[0_0_28px_var(--color-primary)] sm:text-7xl">
            EM BREVE
          </p>

          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">{descricao}</p>
        </div>
      </section>

      {itens.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {itens.map((i) => (
            <div
              key={i.titulo}
              className="rounded-2xl border border-border/60 bg-card/40 p-4 text-left"
            >
              <p className="text-sm font-semibold">{i.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{i.texto}</p>
            </div>
          ))}
        </div>
      )}

      {rodape && (
        <p className="mt-5 text-center text-xs text-muted-foreground">{rodape}</p>
      )}
    </div>
  );
}
