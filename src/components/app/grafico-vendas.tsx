"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

/** mesma forma de `DiaVenda` (lib/financas.ts), repetida aqui porque aquele
 *  arquivo é server-only e este componente roda no navegador */
export type DiaVendaGrafico = {
  chave: string;
  label: string;
  vendas: number;
  receitaCentavos: number;
  receitaLiquidaCentavos: number;
  reembolsos: number;
  reembolsoCentavos: number;
  vendasAssinatura: number;
  receitaAssinaturaCentavos: number;
  receitaLiquidaAssinaturaCentavos: number;
  vendasCredito: number;
  receitaCreditoCentavos: number;
  receitaLiquidaCreditoCentavos: number;
};

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** modos de visualização: unificado, separado por tipo, ou um tipo só */
type Modo = "total" | "separado" | "assinatura" | "credito";

const MODOS: { v: Modo; label: string }[] = [
  { v: "total", label: "Total" },
  { v: "separado", label: "Separado" },
  { v: "assinatura", label: "Assinaturas" },
  { v: "credito", label: "Créditos" },
];

/** Uma linha desenhável do gráfico. As classes ficam escritas por extenso
 *  (Tailwind não gera CSS de classe montada em string). */
type Serie = {
  id: string;
  label: string;
  get: (d: DiaVendaGrafico) => number;
  qtd: (d: DiaVendaGrafico) => number;
  stroke: string;
  width: number;
  dot: string;
};

const S_TOTAL: Serie = {
  id: "total",
  label: "Você recebe",
  get: (d) => d.receitaLiquidaCentavos,
  qtd: (d) => d.vendas,
  stroke: "stroke-emerald-500",
  width: 1.5,
  dot: "border-emerald-500 group-hover/dia:bg-emerald-500",
};
const S_ASSINATURA: Serie = {
  id: "assinatura",
  label: "Assinaturas",
  get: (d) => d.receitaLiquidaAssinaturaCentavos,
  qtd: (d) => d.vendasAssinatura,
  stroke: "stroke-emerald-500",
  width: 1.5,
  dot: "border-emerald-500 group-hover/dia:bg-emerald-500",
};
const S_CREDITO: Serie = {
  id: "credito",
  label: "Créditos",
  get: (d) => d.receitaLiquidaCreditoCentavos,
  qtd: (d) => d.vendasCredito,
  stroke: "stroke-violet-500",
  width: 1.5,
  dot: "border-violet-500 group-hover/dia:bg-violet-500",
};
const S_REEMBOLSO: Serie = {
  id: "reembolso",
  label: "Reembolsos",
  get: (d) => d.reembolsoCentavos,
  qtd: (d) => d.reembolsos,
  stroke: "stroke-red-500",
  width: 1,
  dot: "border-red-500 group-hover/dia:bg-red-500",
};

/** legenda do cabeçalho: barrinha colorida de cada série visível */
const COR_LEGENDA: Record<string, string> = {
  total: "bg-emerald-500",
  assinatura: "bg-emerald-500",
  credito: "bg-violet-500",
  reembolso: "bg-red-500",
};

const SERIES_DO_MODO: Record<Modo, Serie[]> = {
  total: [S_TOTAL, S_REEMBOLSO],
  separado: [S_ASSINATURA, S_CREDITO, S_REEMBOLSO],
  assinatura: [S_ASSINATURA, S_REEMBOLSO],
  credito: [S_CREDITO, S_REEMBOLSO],
};

/** Gráfico de LINHAS por dia (SVG puro, sem lib): verde = vendas (receita
 *  líquida), violeta = pacotes de crédito no modo separado, vermelho =
 *  reembolsos. O seletor no cabeçalho alterna entre o total unificado, as duas
 *  linhas separadas (assinatura x crédito) ou um tipo só. Eixo Y em R$ na
 *  direita, bolinhas nos pontos e tooltip animado no hover com o detalhamento
 *  de cada dia. */
export function GraficoVendas({ dias }: { dias: DiaVendaGrafico[] }) {
  const [modo, setModo] = useState<Modo>("total");
  const series = SERIES_DO_MODO[modo];

  const max = Math.max(1, ...dias.flatMap((d) => series.map((s) => s.get(d))));

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
  const linha = (get: (d: DiaVendaGrafico) => number) =>
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
        <div className="flex flex-wrap items-center gap-3">
          {/* totais das séries visíveis */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {series.map((s) => {
              const total = dias.reduce((acc, d) => acc + s.get(d), 0);
              const qtd = dias.reduce((acc, d) => acc + s.qtd(d), 0);
              return (
                <span key={s.id} className="flex items-center gap-1.5">
                  <span className={`inline-block h-0.5 w-4 rounded ${COR_LEGENDA[s.id]}`} />
                  {s.label} {s.id === "reembolso" ? brl(total) : `${brl(total)} (${qtd})`}
                </span>
              );
            })}
          </div>
          {/* seletor de modo (total x separado x um tipo só) */}
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {MODOS.map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setModo(m.v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  modo === m.v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
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
                className="stroke-border"
                strokeWidth={e.valor === 0 ? 0.5 : 0.3}
                strokeDasharray={e.valor === 0 ? undefined : "1.5 1.5"}
              />
            ))}
            {/* séries de trás pra frente, pra linha principal ficar por cima
                (o reembolso é o último do array e é desenhado primeiro) */}
            {[...series].reverse().map((s) => (
              <polyline
                key={s.id}
                points={linha(s.get)}
                fill="none"
                className={s.stroke}
                strokeWidth={s.width}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/* uma coluna interativa por dia: bolinhas + guia + tooltip animado */}
          <div className="absolute inset-0 flex">
            {dias.map((d) => (
              <div key={d.chave} className="group/dia relative flex-1">
                {/* guia vertical no hover */}
                <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-foreground/15 group-hover/dia:block" />

                {/* bolinha de cada série visível */}
                {series.map((s) => (
                  <span
                    key={s.id}
                    className={`absolute left-1/2 z-[1] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card transition-transform duration-150 group-hover/dia:scale-150 ${s.dot}`}
                    style={{ top: `${y(s.get(d))}%` }}
                  />
                ))}

                {/* tooltip animado: detalhamento do dia (sempre com os 2 tipos) */}
                <div className="pointer-events-none absolute left-1/2 top-1 z-10 w-max -translate-x-1/2 translate-y-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs opacity-0 shadow-lg transition-all duration-150 group-hover/dia:translate-y-0 group-hover/dia:opacity-100">
                  <p className="mb-1 font-semibold text-foreground">
                    {d.label} · {brl(d.receitaLiquidaCentavos)} · {d.vendas} venda
                    {d.vendas === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-1.5 text-emerald-500">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                    Assinaturas {brl(d.receitaLiquidaAssinaturaCentavos)} · {d.vendasAssinatura}{" "}
                    venda{d.vendasAssinatura === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-1.5 text-violet-500">
                    <span className="inline-block size-1.5 rounded-full bg-violet-500" />
                    Créditos {brl(d.receitaLiquidaCreditoCentavos)} · {d.vendasCredito} venda
                    {d.vendasCredito === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-1.5 text-red-500">
                    <span className="inline-block size-1.5 rounded-full bg-red-500" />
                    −{brl(d.reembolsoCentavos)} · {d.reembolsos} reembolso
                    {d.reembolsos === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
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
