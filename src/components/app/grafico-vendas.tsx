import { TrendingUp } from "lucide-react";
import type { DiaVenda } from "@/lib/financas";

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Barras de receita por dia (CSS puro). Altura = receita do dia. */
export function GraficoVendas({ dias }: { dias: DiaVenda[] }) {
  const max = Math.max(1, ...dias.map((d) => d.receitaCentavos));
  const totalReceita = dias.reduce((s, d) => s + d.receitaCentavos, 0);
  const totalVendas = dias.reduce((s, d) => s + d.vendas, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" />
          Vendas por dia
        </h2>
        <span className="text-xs text-muted-foreground">
          {brl(totalReceita)} · {totalVendas} venda{totalVendas === 1 ? "" : "s"} nos últimos {dias.length} dias
        </span>
      </div>

      <div className="mt-5 flex h-44 items-end gap-1 sm:gap-1.5">
        {dias.map((d) => (
          <div
            key={d.chave}
            className="group/bar flex h-full flex-1 flex-col items-center justify-end gap-1"
            title={`${d.label}: ${brl(d.receitaCentavos)} (${d.vendas} venda${d.vendas === 1 ? "" : "s"})`}
          >
            <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover/bar:opacity-100">
              {d.vendas || ""}
            </span>
            <div
              className="w-full rounded-t bg-primary/80 transition-colors group-hover/bar:bg-primary"
              style={{ height: `${(d.receitaCentavos / max) * 100}%` }}
            />
            <span className="text-[8px] text-muted-foreground sm:text-[9px]">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
