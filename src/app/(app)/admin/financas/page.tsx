import type { Metadata } from "next";
import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Wallet,
  Receipt,
  AlertTriangle,
  Undo2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/app/stat-card";
import { GraficoVendas } from "@/components/app/grafico-vendas";
import { getPainelFinancas, PERIODOS_FINANCAS, DIAS_PADRAO } from "@/lib/financas";

export const metadata: Metadata = { title: "Admin · Finanças" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

const brl = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function statusLabel(s: string, pago: boolean) {
  if (pago) return { txt: "Pago", cls: "bg-emerald-500/15 text-emerald-600" };
  if (s === "waiting_payment")
    return { txt: "Aguardando", cls: "bg-amber-500/15 text-amber-600" };
  if (s === "refunded" || s.includes("charge"))
    return { txt: "Estornado", cls: "bg-red-500/15 text-red-600" };
  return { txt: s, cls: "bg-muted text-muted-foreground" };
}

export default async function FinancasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const sp = await searchParams;
  const pedido = Number(sp?.dias);
  const dias = PERIODOS_FINANCAS.some((p) => p.v === pedido) ? pedido : DIAS_PADRAO;
  const f = await getPainelFinancas(dias);

  const labelPeriodo =
    PERIODOS_FINANCAS.find((p) => p.v === dias)?.label ?? `${dias} dias`;
  const tituloLista =
    dias === 1 ? "Entraram hoje" : dias === 0 ? "Todas as vendas" : `Vendas · últimos ${f.periodo.dias} dias`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanças</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendas reais da Kiwify (plano de entrada + pacotes). Atualiza a cada abertura.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Contabilizando a partir de <b className="text-foreground">{f.desde}</b> (o histórico de
            teste anterior não entra nos números).
          </p>
        </div>
        {/* filtro de período: TODOS os números da página seguem ele */}
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {PERIODOS_FINANCAS.map((p) => (
            <Link
              key={p.v}
              href={`?dias=${p.v}`}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                dias === p.v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {f.erro && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          {f.erro}
        </div>
      )}

      {/* Cards - todos do PERÍODO selecionado (+ os 2 primeiros fixos de hoje) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Receita hoje" value={brl(f.hoje.receitaCentavos)} icon={DollarSign} />
        <StatCard label="Vendas hoje" value={f.hoje.pagas} icon={ShoppingCart} />
        <StatCard label={`Receita · ${labelPeriodo}`} value={brl(f.periodo.receitaCentavos)} icon={Wallet} />
        <StatCard label={`Vendas · ${labelPeriodo}`} value={f.periodo.vendasPagas} icon={Receipt} />
        <StatCard label="Reembolsos" value={`− ${brl(f.periodo.reembolsoCentavos)}`} icon={Undo2} />
        <StatCard label="Receita − reembolsos" value={brl(f.periodo.receitaFinalCentavos)} icon={Wallet} />
        <StatCard label="Clientes" value={f.periodo.clientes} icon={Users} />
        <StatCard label="Ticket médio" value={brl(f.periodo.ticketCentavos)} icon={DollarSign} />
      </div>

      {/* Gráfico */}
      <GraficoVendas dias={f.grafico} />

      <p className="text-[11px] text-muted-foreground">
        No período: <b className="text-red-500">{f.periodo.reembolsos} reembolso{f.periodo.reembolsos === 1 ? "" : "s"}</b>{" "}
        (−{brl(f.periodo.reembolsoCentavos)}). Receita líquida após a taxa da Kiwify:{" "}
        <b className="text-foreground">{brl(f.periodo.receitaLiquidaCentavos)}</b>.
      </p>

      {/* Vendas do período */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          {tituloLista} ({f.vendasPeriodo.length})
        </h2>
        {f.vendasPeriodo.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-center">
            <ShoppingCart className="size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhuma venda no período</p>
            <p className="text-sm text-muted-foreground">Assim que alguém comprar, aparece aqui.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Quando</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {f.vendasPeriodo.map((c, i) => {
                  const st = statusLabel(c.status, c.pago);
                  return (
                    <TableRow key={`${c.email}-${i}`}>
                      <TableCell>
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {c.quando}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.txt}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {brl(c.valorCentavos)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
