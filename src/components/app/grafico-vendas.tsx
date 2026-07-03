import { TrendingUp } from "lucide-react";
import type { DiaVenda } from "@/lib/financas";

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Gráfico de LINHAS por dia (SVG puro, sem lib): verde = vendas (receita),
 *  vermelho = reembolsos. Eixo Y em R$ na direita, bolinhas nos pontos e
 *  tooltip animado no hover. */
export function GraficoVendas({ dias }: { dias: DiaVenda[] }) {
  const max = Math.max(
    1,
    ...dias.map((d) => Math.max(d.receitaCentavos, d.reembolsoCentavos)),
  );
  const totalReceita = dias.reduce((s, d) => s + d.receitaCentavos, 0);
  const totalVendas = dias.reduce((s, d) => s + d.vendas, 0);
  const totalReembolso = dias.reduce((s, d) => s + d.reembolsoCentavos, 0);

  // Escala "bonita": teto arredondado em 4 divisões (ex: máx R$ 277 -> teto
  // R$ 400 com linhas em 100/200/300/400), pra régua fazer sentido.
  const DIVS = 4;
  const passoBruto = max / DIVS;
  const magnitude = Math.pow(10, Math.floor(Math.log10(passoBruto)));
  const norm = passoBruto / magnitude;
  const passo =
    magnitude * (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10);
  const teto = passo * DIVS;

  const fmtEixo = (centavos: number) =>
    (centavos / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: passo < 100 ? 2 : 0,
    });

  // pontos numa viewBox 0..100 x 0..100 (y invertido: 100 = zero). O x fica no
  // CENTRO da coluna de cada dia, pra bolinha/tooltip alinharem com a linha.
  const n = dias.length;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => 100 - (v / teto) * 90 - 6; // folga em cima/embaixo
  const linha = (get: (d: DiaVenda) => number) =>
    dias.map((d, i) => `${x(i).toFixed(2)},${y(get(d)).toFixed(2)}`).join(" ");

  // régua horizontal: R$ 0 até o teto
  const eixo = Array.from({ length: DIVS + 1 }, (_, i) => ({
    valor: passo * i,
    y: y(passo * i),
  }));

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

      <div className="mt-5 flex">
        {/* área do gráfico */}
        <div className="relative h-48 flex-1">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            {/* régua horizontal (R$) */}
            {eixo.map((e) => (
              <line
                key={e.valor}
                x1="0"
                y1={e.y}
                x2="100"
                y2={e.y}
                className={e.valor === 0 ? "stroke-border" : "stroke-border"}
                strokeWidth={e.valor === 0 ? 0.5 : 0.3}
                strokeDasharray={e.valor === 0 ? undefined : "1.5 1.5"}
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

          {/* uma coluna interativa por dia: bolinhas + guia + tooltip animado */}
          <div className="absolute inset-0 flex">
            {dias.map((d) => {
              const yVenda = y(d.receitaCentavos);
              const yReemb = y(d.reembolsoCentavos);
              return (
                <div key={d.chave} className="group/dia relative flex-1">
                  {/* guia vertical no hover */}
                  <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-foreground/15 group-hover/dia:block" />

                  {/* bolinha: vendas */}
                  <span
                    className="absolute left-1/2 z-[1] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-500 bg-card transition-transform duration-150 group-hover/dia:scale-150 group-hover/dia:bg-emerald-500"
                    style={{ top: `${yVenda}%` }}
                  />
                  {/* bolinha: reembolsos */}
                  <span
                    className="absolute left-1/2 z-[1] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-red-500 bg-card transition-transform duration-150 group-hover/dia:scale-150 group-hover/dia:bg-red-500"
                    style={{ top: `${yReemb}%` }}
                  />

                  {/* tooltip animado */}
                  <div className="pointer-events-none absolute left-1/2 top-1 z-10 w-max -translate-x-1/2 translate-y-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs opacity-0 shadow-lg transition-all duration-150 group-hover/dia:translate-y-0 group-hover/dia:opacity-100">
                    <p className="mb-1 font-semibold text-foreground">{d.label}</p>
                    <p className="flex items-center gap-1.5 text-emerald-500">
                      <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                      {brl(d.receitaCentavos)} · {d.vendas} venda{d.vendas === 1 ? "" : "s"}
                    </p>
                    <p className="flex items-center gap-1.5 text-red-500">
                      <span className="inline-block size-1.5 rounded-full bg-red-500" />
                      −{brl(d.reembolsoCentavos)} · {d.reembolsos} reembolso{d.reembolsos === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* eixo Y (R$) na lateral direita */}
        <div className="relative h-48 w-16 shrink-0">
          {eixo.map((e) => (
            <span
              key={e.valor}
              className="absolute right-0 -translate-y-1/2 pl-1 text-[9px] tabular-nums text-muted-foreground"
              style={{ top: `${e.y}%` }}
            >
              {fmtEixo(e.valor)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-1 flex pr-16">
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
