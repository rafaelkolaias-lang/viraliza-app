import type { LucideIcon } from "lucide-react";

/**
 * Cabeçalho das telas do Viraliza Labs (etiqueta, título e a frase que explica
 * pra que serve). Cada ferramenta virou uma rota própria, e é este componente
 * que mantém as quatro com a mesma cara: antes o cabeçalho era montado dentro do
 * funil e trocava junto com a aba do dock.
 *
 * O `children` é pro que for exclusivo de uma tela ficar logo abaixo (no funil,
 * a trilha das etapas e a barra de progresso).
 */
export function LabCabecalho({
  Icone,
  chamada,
  titulo,
  descricao,
  children,
}: {
  Icone: LucideIcon;
  /** frase curta da etiqueta de cima */
  chamada: string;
  titulo: React.ReactNode;
  descricao: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 pt-2 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary sm:px-4 sm:text-xs">
        <Icone className="size-3.5 shrink-0" />
        {chamada}
      </span>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
          {descricao}
        </p>
      </div>
      {children}
    </div>
  );
}
