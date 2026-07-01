"use client";

import { useMemo, useState } from "react";
import {
  Coins,
  Receipt,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Wallet,
  TrendingDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Tx = {
  id: string;
  tipo: string;
  valor: number; // centavos = créditos; + entrada, - saída
  saldoApos: number;
  descricao: string;
  criadoEm: string; // ISO
};

const TIPO_LABEL: Record<string, string> = {
  compra: "Compra de créditos",
  debito_geracao: "Geração (IA)",
  debito_processamento: "Processamento",
  bonus_assinatura: "Bônus da assinatura",
  ajuste_admin: "Ajuste",
};

const PERIODOS = [
  { v: 7, label: "7 dias" },
  { v: 30, label: "30 dias" },
  { v: 90, label: "90 dias" },
  { v: 0, label: "Tudo" },
];

const FILTROS = [
  { v: "tudo", label: "Tudo" },
  { v: "gastos", label: "Gastos" },
  { v: "compras", label: "Entradas" },
];

const DIA_MS = 86_400_000;

function fmtCred(n: number) {
  return n.toLocaleString("pt-BR");
}

// timeZone fixo: senão o SSR (servidor, ex. UTC) formata diferente do cliente
// (BRT) e dá hydration mismatch. America/Sao_Paulo iguala os dois.
const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        ativo
          ? "bg-primary/15 text-primary"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ExtratoDetalhado({
  saldoCentavos,
  transacoes,
  agoraMs,
}: {
  saldoCentavos: number;
  transacoes: Tx[];
  agoraMs: number;
}) {
  const [periodo, setPeriodo] = useState(30);
  const [filtro, setFiltro] = useState("tudo");
  const [busca, setBusca] = useState("");

  // recorte por período (independente do tipo/busca, pra os totais ficarem estáveis)
  const noPeriodo = useMemo(() => {
    if (periodo === 0) return transacoes;
    const corte = agoraMs - periodo * DIA_MS;
    return transacoes.filter((t) => new Date(t.criadoEm).getTime() >= corte);
  }, [transacoes, periodo, agoraMs]);

  const totalGasto = useMemo(
    () =>
      noPeriodo.filter((t) => t.valor < 0).reduce((s, t) => s + Math.abs(t.valor), 0),
    [noPeriodo],
  );
  const totalEntrada = useMemo(
    () => noPeriodo.filter((t) => t.valor > 0).reduce((s, t) => s + t.valor, 0),
    [noPeriodo],
  );

  // gráfico: gasto por dia nos últimos 14 dias
  const barras = useMemo(() => {
    const dias = 14;
    const arr = Array.from({ length: dias }, () => 0);
    for (const t of transacoes) {
      if (t.valor >= 0) continue;
      const di = Math.floor((agoraMs - new Date(t.criadoEm).getTime()) / DIA_MS);
      if (di >= 0 && di < dias) arr[dias - 1 - di] += Math.abs(t.valor);
    }
    const max = Math.max(...arr, 1);
    return arr.map((v) => ({ v, pct: Math.round((v / max) * 100) }));
  }, [transacoes, agoraMs]);

  // lista filtrada (período + tipo + busca)
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return noPeriodo.filter((t) => {
      if (filtro === "gastos" && t.valor >= 0) return false;
      if (filtro === "compras" && t.valor <= 0) return false;
      if (!q) return true;
      const txt = `${TIPO_LABEL[t.tipo] ?? t.tipo} ${t.descricao}`.toLowerCase();
      return txt.includes(q);
    });
  }, [noPeriodo, filtro, busca]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Receipt className="size-6 text-primary" />
          Extrato da conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo que entrou e saiu de créditos, com gráfico de gasto e busca.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Cartao
          icon={Wallet}
          rotulo="Saldo atual"
          valor={`${fmtCred(saldoCentavos)} créditos`}
          cor="text-primary"
        />
        <Cartao
          icon={TrendingDown}
          rotulo="Gasto no período"
          valor={`${fmtCred(totalGasto)} créditos`}
          cor="text-foreground"
        />
        <Cartao
          icon={ArrowUpRight}
          rotulo="Entradas no período"
          valor={`${fmtCred(totalEntrada)} créditos`}
          cor="text-primary"
        />
      </div>

      {/* Gráfico de gasto (14 dias) */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-primary" />
          Gasto nos últimos 14 dias
        </h2>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {barras.map((b, i) => (
            <div
              key={i}
              className="flex-1"
              title={`${fmtCred(b.v)} créditos`}
            >
              <div
                className={cn(
                  "w-full rounded-t bg-primary/70 transition-all",
                  b.v === 0 && "bg-muted",
                )}
                style={{ height: `${Math.max(b.pct, 3)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>14 dias atrás</span>
          <span>hoje</span>
        </div>
      </section>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODOS.map((p) => (
            <Chip key={p.v} ativo={periodo === p.v} onClick={() => setPeriodo(p.v)}>
              {p.label}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {FILTROS.map((f) => (
            <Chip key={f.v} ativo={filtro === f.v} onClick={() => setFiltro(f.v)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no extrato..."
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista */}
      <section className="rounded-2xl border border-border bg-card">
        {lista.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma movimentação com esses filtros.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lista.map((t) => {
              const entrada = t.valor >= 0;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-lg",
                      entrada
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {entrada ? (
                      <ArrowUpRight className="size-4" />
                    ) : (
                      <ArrowDownRight className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {TIPO_LABEL[t.tipo] ?? t.tipo}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.descricao ? `${t.descricao} · ` : ""}
                      {fmtData.format(new Date(t.criadoEm))}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        entrada ? "text-primary" : "text-foreground",
                      )}
                    >
                      {entrada ? "+" : "−"}
                      {fmtCred(Math.abs(t.valor))}
                    </p>
                    <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                      <Coins className="size-3" />
                      {fmtCred(t.saldoApos)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Cartao({
  icon: Icon,
  rotulo,
  valor,
  cor,
}: {
  icon: typeof Wallet;
  rotulo: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4", cor)} />
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {rotulo}
        </p>
      </div>
      <p className={cn("mt-2 text-xl font-bold tracking-tight", cor)}>{valor}</p>
    </div>
  );
}
