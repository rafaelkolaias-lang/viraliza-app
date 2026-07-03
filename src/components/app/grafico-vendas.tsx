import { TrendingUp } from "lucide-react";
import type { DiaVenda } from "@/lib/financas";

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Gráfico de LINHAS por dia (SVG puro, sem lib): verde = vendas (receita),
 *  vermelho = reembolsos. Tooltip por dia no hover (title). */
export function GraficoVendas({ dias }: { dias: DiaVenda[] }) {
  const max = Math.max(
    1,
    ...dias.map((d) => Math.max(d.receitaCentavos, d.reembolsoCentavos)),
  );
  const totalReceita = dias.reduce((s, d) => s + d.receitaCentavos, 0);
  const totalVendas = dias.reduce((s, d) => s + d.vendas, 0);
  const totalReembolso = dias.reduce((s, d) => s + d.reembolsoCentavos, 0);

  // pontos numa viewBox 0..100 x 0..100 (y invertido: 100 = zero)
  const n = dias.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 92 - 4; // 4% de folga em cima/embaixo
  const linha = (get: (d: DiaVenda) => number) =>
    dias.map((d, i) => `${x(i).toFixed(2)},${y(get(d)).toFixed(2)}`).join(" ");

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" />
          Vendas por dia
        </h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-emerald-500" />
            Vendas {brl(totalReceita)} ({totalVendas})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-red-500" />
            Reembolsos {brl(totalReembolso)}
          </span>
        </div>
      </div>

      <div className="relative mt-5 h-44">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          {/* linhas-guia horizontais */}
          {[25, 50, 75].map((gy) => (
            <line
              key={gy}
              x1="0"
              y1={gy}
              x2="100"
              y2={gy}
              className="stroke-border"
              strokeWidth="0.3"
              strokeDasharray="1.5 1.5"
            />
          ))}
          {/* reembolsos (vermelho) - desenhada primeiro pra verde ficar por cima */}
          <polyline
            points={linha((d) => d.reembolsoCentavos)}
            fill="none"
            className="stroke-red-500"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* vendas (verde) */}
          <polyline
            points={linha((d) => d.receitaCentavos)}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        {/* colunas invisíveis por dia: tooltip + marcador no hover */}
        <div className="absolute inset-0 flex">
          {dias.map((d) => (
            <div
              key={d.chave}
              className="group/dia relative flex-1 border-transparent hover:bg-foreground/[0.04]"
              title={`${d.label}: ${brl(d.receitaCentavos)} em ${d.vendas} venda${d.vendas === 1 ? "" : "s"}${
                d.reembolsos
                  ? ` · ${brl(d.reembolsoCentavos)} em ${d.reembolsos} reembolso${d.reembolsos === 1 ? "" : "s"}`
                  : ""
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-1 flex">
        {dias.map((d) => (
          <span
            key={d.chave}
            className="flex-1 text-center text-[8px] text-muted-foreground sm:text-[9px]"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
