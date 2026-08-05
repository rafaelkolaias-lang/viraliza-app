import Link from "next/link";
import {
  ArrowRight,
  CircleHelp,
  Lightbulb,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { numeroDaSecao } from "@/lib/ajuda-indice";

/**
 * Peças de montar da Central de Ajuda. Escrever uma seção nova é só empilhar
 * esses blocos: nenhum deles tem estado, todos são Server Components.
 *
 * A régua do texto é a pessoa mais perdida da plataforma: nada de "configure o
 * avatar", e sim "clique no botão verde escrito Criar influenciador".
 */

/** Bloco numerado de conteúdo. O número sai do índice, não da mão. */
export function Secao({
  id,
  titulo,
  subtitulo,
  children,
}: {
  id: string;
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 rounded-2xl border border-border bg-card p-5 sm:p-7"
    >
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">
        <span className="text-primary">{numeroDaSecao(id)}.</span> {titulo}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

/** Título pequeno dentro de uma seção. */
export function Titulinho({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

/** Parágrafo padrão da ajuda. */
export function Texto({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

/** Passo numerado do passo a passo. */
export function Passo({
  n,
  titulo,
  Icone,
  children,
}: {
  n: number;
  titulo: string;
  Icone?: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          {Icone && <Icone className="size-3.5 shrink-0 text-primary" />}
          {titulo}
        </p>
        <div className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Caixa de aviso: dica (verde), atenção (âmbar) ou erro comum (vermelho). */
export function Aviso({
  tom = "dica",
  titulo,
  children,
}: {
  tom?: "dica" | "atencao" | "erro";
  titulo: string;
  children: React.ReactNode;
}) {
  const cores = {
    dica: { caixa: "border-primary/40 bg-primary/8", texto: "text-primary", Icone: Lightbulb },
    atencao: {
      caixa: "border-amber-500/40 bg-amber-500/10",
      texto: "text-amber-400",
      Icone: TriangleAlert,
    },
    erro: {
      caixa: "border-destructive/40 bg-destructive/10",
      texto: "text-destructive",
      Icone: CircleHelp,
    },
  }[tom];
  const { Icone } = cores;

  return (
    <div className={`flex gap-3 rounded-xl border p-4 ${cores.caixa}`}>
      <Icone className={`mt-0.5 size-4.5 shrink-0 ${cores.texto}`} />
      <div className="min-w-0 text-sm">
        <p className={`font-semibold ${cores.texto}`}>{titulo}</p>
        <div className="mt-0.5 leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Cartão com ícone: usado nas grades de "o que dá pra fazer aqui". */
export function Cartao({
  Icone,
  titulo,
  children,
}: {
  Icone: typeof UserRound;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <Icone className="size-5 text-primary" />
      <p className="mt-2 text-sm font-semibold">{titulo}</p>
      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/** Linha de destaque (custo, tempo, limite). */
export function Selo({ Icone, children }: { Icone: typeof UserRound; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3.5 py-2.5 text-sm">
      <Icone className="size-4 shrink-0 text-primary" />
      {children}
    </div>
  );
}

/** Atalho verde que leva pra tela de verdade. */
export function Atalho({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_24px_-6px_var(--color-primary)]"
    >
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}

/** Pergunta e resposta (seção de problemas e blocos de dúvida). */
export function Problema({
  pergunta,
  children,
}: {
  pergunta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <p className="text-sm font-semibold">{pergunta}</p>
      <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

/** Tabelinha simples (preços, limites). Rola sozinha no celular. */
export function Tabela({
  colunas,
  linhas,
}: {
  colunas: string[];
  linhas: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-background/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {colunas.map((c) => (
              <th key={c} className="px-4 py-2.5 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((l, i) => (
            <tr key={i}>
              {l.map((celula, j) => (
                <td
                  key={j}
                  className={
                    j === 0
                      ? "px-4 py-2.5 font-medium text-foreground"
                      : "px-4 py-2.5 text-muted-foreground"
                  }
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
