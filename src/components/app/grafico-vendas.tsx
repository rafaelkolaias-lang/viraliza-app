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
  reembolsosAssinatura: number;
  reembolsoAssinaturaCentavos: number;
  reembolsosCredito: number;
  reembolsoCreditoCentavos: number;
};

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** modos de visualização: unificado (padrão), separado por tipo, ou um tipo só */
type Modo = "total" | "separado" | "assinatura" | "credito";

const MODOS: { v: Modo; label: string }[] = [
  { v: "total", label: "Total" },
  { v: "separado", label: "Separado" },
  { v: "assinatura", label: "Assinaturas" },
  { v: "credito", label: "Créditos" },
];

/**
 * Uma linha desenhável do gráfico. As classes ficam escritas por extenso
 * (Tailwind não gera CSS de classe montada em string).
 *
 * `tracejada` é o que separa os DOIS reembolsos sem inventar uma quarta cor.
 * Motivo (13/08/2026): a cor tem que dizer o TIPO (verde = assinatura, violeta =
 * crédito) e o vermelho tem que continuar dizendo "saiu dinheiro". Uma segunda
 * cor quente pro reembolso de crédito (laranja, âmbar, rosa) não passa no teste
 * de daltonismo ao lado do vermelho - em deuteranopia as duas viram a mesma
 * linha. Então o vermelho é um só e o traço separa os dois, com a legenda e o
 * balãozinho do dia dizendo qual é qual.
 */
type Serie = {
  id: string;
  label: string;
  get: (d: DiaVendaGrafico) => number;
  qtd: (d: DiaVendaGrafico) => number;
  stroke: string;
  width: number;
  dot: string;
  tracejada?: boolean;
};

/* As três cores passaram no validador de paleta (6 checagens, incluindo
 * separação em deuteranopia/tritanopia) contra o fundo do card, que é
 * `oklch(0.2 0.006 250)`. O verde é o 600 e não o 500 de propósito: o 500 fica
 * claro demais pro fundo e rouba a atenção das outras linhas. Mexeu na cor,
 * rode o validador de novo antes de subir. */
const S_TOTAL: Serie = {
  id: "total",
  label: "Você recebe",
  get: (d) => d.receitaLiquidaCentavos,
  qtd: (d) => d.vendas,
  stroke: "stroke-emerald-600",
  width: 1.5,
  dot: "border-emerald-600 group-hover/dia:bg-emerald-600",
};
const S_ASSINATURA: Serie = {
  id: "assinatura",
  label: "Assinaturas",
  get: (d) => d.receitaLiquidaAssinaturaCentavos,
  qtd: (d) => d.vendasAssinatura,
  stroke: "stroke-emerald-600",
  width: 1.5,
  dot: "border-emerald-600 group-hover/dia:bg-emerald-600",
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
const S_REEMBOLSO_ASSINATURA: Serie = {
  id: "reembolso-assinatura",
  label: "Reemb. assinaturas",
  get: (d) => d.reembolsoAssinaturaCentavos,
  qtd: (d) => d.reembolsosAssinatura,
  stroke: "stroke-red-500",
  width: 1,
  dot: "border-red-500 group-hover/dia:bg-red-500",
};
const S_REEMBOLSO_CREDITO: Serie = {
  id: "reembolso-credito",
  label: "Reemb. créditos",
  get: (d) => d.reembolsoCreditoCentavos,
  qtd: (d) => d.reembolsosCredito,
  stroke: "stroke-red-500",
  width: 1,
  dot: "border-red-500 group-hover/dia:bg-red-500",
  tracejada: true,
};

/** legenda do cabeçalho: barrinha colorida de cada série visível */
const COR_LEGENDA: Record<string, string> = {
  total: "bg-emerald-600",
  assinatura: "bg-emerald-600",
  credito: "bg-violet-500",
  reembolso: "bg-red-500",
  "reembolso-assinatura": "bg-red-500",
  "reembolso-credito": "bg-red-500",
};

const SERIES_DO_MODO: Record<Modo, Serie[]> = {
  // padrão: as 4 linhas, 2 do que entra e 2 do que voltou
  separado: [S_ASSINATURA, S_CREDITO, S_REEMBOLSO_ASSINATURA, S_REEMBOLSO_CREDITO],
  total: [S_TOTAL, S_REEMBOLSO],
  // filtrado por tipo: só o reembolso DAQUELE tipo entra
  assinatura: [S_ASSINATURA, S_REEMBOLSO_ASSINATURA],
  credito: [S_CREDITO, S_REEMBOLSO_CREDITO],
};

/** Gráfico de LINHAS por dia (SVG puro, sem lib). A cor diz o TIPO (verde =
 *  assinatura, violeta = crédito, vermelho = dinheiro que voltou) e o traço diz
 *  qual dos dois reembolsos é (cheio = assinatura, tracejado = crédito).
 *
 *  Abre no "Total" (dono, 13/08/2026), com as duas linhas somadas. O
 *  "Separado" mostra as 4: o que entrou de assinatura, o que entrou de crédito
 *  e o reembolso de cada um. Eixo Y em R$ na direita, bolinhas nos pontos e
 *  tooltip animado no hover com o detalhamento de cada dia (o balãozinho traz
 *  os 4 números em qualquer modo). */
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
      {/* CABEÇALHO EM DUAS FAIXAS, e isso é de propósito: o seletor fica preso
          à faixa do título e a legenda mora numa faixa só dela, embaixo. Antes
          os dois dividiam a mesma linha, então trocar de modo mudava a
          quantidade de itens da legenda, a legenda mudava de largura e os
          botões PULAVAM de lugar embaixo do dedo de quem tinha acabado de
          clicar. Botão que se move sozinho não volta pra mesma linha. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" />
          Vendas por dia
        </h2>
        {/* seletor de modo (total x separado x um tipo só) */}
        <div className="flex shrink-0 gap-1 rounded-lg border border-border p-1">
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

      {/* totais das séries visíveis */}
      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {series.map((s) => {
          const total = dias.reduce((acc, d) => acc + s.get(d), 0);
          const qtd = dias.reduce((acc, d) => acc + s.qtd(d), 0);
          return (
            <span key={s.id} className="flex items-center gap-1.5">
              {/* barrinha da legenda: tracejada quando a linha é tracejada,
                  senão as duas de reembolso ficariam idênticas aqui */}
              {s.tracejada ? (
                <span className="inline-flex w-4 shrink-0 items-center gap-[2px]">
                  <span className={`h-0.5 flex-1 rounded ${COR_LEGENDA[s.id]}`} />
                  <span className={`h-0.5 flex-1 rounded ${COR_LEGENDA[s.id]}`} />
                </span>
              ) : (
                <span className={`inline-block h-0.5 w-4 rounded ${COR_LEGENDA[s.id]}`} />
              )}
              {s.label} {brl(total)} ({qtd})
            </span>
          );
        })}
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
                strokeDasharray={s.tracejada ? "4 3" : undefined}
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

                {/* tooltip animado: detalhamento do dia. Sempre com os 4
                    números, mesmo quando o modo esconde alguma linha - é aqui
                    que se responde "esse reembolso foi de quê?". A cor mora na
                    bolinha, não no texto: número em cor de série fica difícil de
                    ler em cima do popover. */}
                <div className="pointer-events-none absolute left-1/2 top-1 z-10 w-max -translate-x-1/2 translate-y-1 space-y-0.5 rounded-lg border border-border bg-popover px-3 py-2 text-xs opacity-0 shadow-lg transition-all duration-150 group-hover/dia:translate-y-0 group-hover/dia:opacity-100">
                  <p className="mb-1 font-semibold text-foreground">
                    {d.label} · {brl(d.receitaLiquidaCentavos)} · {d.vendas} venda
                    {d.vendas === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-600" />
                    Assinaturas{" "}
                    <b className="font-medium text-foreground">
                      {brl(d.receitaLiquidaAssinaturaCentavos)}
                    </b>{" "}
                    · {d.vendasAssinatura} venda{d.vendasAssinatura === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block size-1.5 rounded-full bg-violet-500" />
                    Créditos{" "}
                    <b className="font-medium text-foreground">
                      {brl(d.receitaLiquidaCreditoCentavos)}
                    </b>{" "}
                    · {d.vendasCredito} venda{d.vendasCredito === 1 ? "" : "s"}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block size-1.5 rounded-full bg-red-500" />
                    Reemb. assinaturas{" "}
                    <b className="font-medium text-foreground">
                      −{brl(d.reembolsoAssinaturaCentavos)}
                    </b>{" "}
                    · {d.reembolsosAssinatura}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-flex w-1.5 shrink-0 items-center">
                      <span className="h-px w-full bg-red-500" />
                    </span>
                    Reemb. créditos{" "}
                    <b className="font-medium text-foreground">
                      −{brl(d.reembolsoCreditoCentavos)}
                    </b>{" "}
                    · {d.reembolsosCredito}
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
