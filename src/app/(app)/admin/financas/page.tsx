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
  Cpu,
  PiggyBank,
  Megaphone,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/app/stat-card";
import { GraficoVendas } from "@/components/app/grafico-vendas";
import { FinancasUsuarios } from "@/components/app/financas-usuarios";
import { getPainelFinancas, PERIODOS_FINANCAS, DIAS_PADRAO } from "@/lib/financas";
import { elevenSaldo } from "@/lib/diagnostico";

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
  const [f, eleven] = await Promise.all([getPainelFinancas(dias), elevenSaldo()]);

  // cota da ElevenLabs somada entre as chaves (vira legenda do card dela)
  const cotaEleven = (() => {
    const ok = eleven.chaves.filter((c) => c.ok);
    if (!ok.length) return null;
    const usado = ok.reduce((s, c) => s + (c.usado ?? 0), 0);
    const limite = ok.reduce((s, c) => s + (c.limite ?? 0), 0);
    if (!limite) return null;
    return `cota: ${Math.round((usado / limite) * 100)}% de ${limite.toLocaleString("pt-BR")} caracteres`;
  })();

  const labelPeriodo =
    PERIODOS_FINANCAS.find((p) => p.v === dias)?.label ?? `${dias} dias`;

  // card de anúncios: sem chave ou com falha mostra o motivo em vez de um zero
  // mentiroso (zero de verdade é gasto zero, e isso precisa ficar distinguível)
  const a = f.anuncios;
  const anuncioTexto = !a.configurado || a.erro ? "-" : `− ${brl(a.centavos)}`;
  const anuncioLegenda = !a.configurado
    ? "falta META_ADS_TOKEN e META_ADS_ACCOUNT_ID no env"
    : a.erro
      ? a.erro
      : a.moeda && a.moeda !== "BRL"
        ? `atenção: a conta cobra em ${a.moeda}, não em reais`
        : (a.janela ?? undefined);
  const tituloLista =
    dias === 1 ? "Entraram hoje" : dias === 0 ? "Todas as vendas" : `Vendas · últimos ${f.periodo.dias} dias`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finanças</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendas reais da Cakto + Kiwify (plano de entrada + pacotes). Os valores são o{" "}
            <b className="text-foreground">líquido que você recebe</b> (já sem a taxa da
            processadora); o valor pago pelo cliente aparece na legenda.
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

      {/* Cards - LÍQUIDO (o que você recebe) como número principal; bruto na legenda */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Você recebe hoje"
          value={brl(f.hoje.receitaLiquidaCentavos)}
          icon={DollarSign}
          sub={`cliente pagou ${brl(f.hoje.receitaCentavos)}`}
        />
        <StatCard label="Vendas hoje" value={f.hoje.pagas} icon={ShoppingCart} />
        <StatCard
          label={`Você recebe · ${labelPeriodo}`}
          value={brl(f.periodo.receitaLiquidaCentavos)}
          icon={Wallet}
          sub={`clientes pagaram ${brl(f.periodo.receitaCentavos)}`}
        />
        <StatCard label={`Vendas · ${labelPeriodo}`} value={f.periodo.vendasPagas} icon={Receipt} />
        <StatCard
          label="Reembolsos"
          value={`− ${brl(f.periodo.reembolsoLiquidoCentavos)}`}
          icon={Undo2}
          sub={f.periodo.reembolsos > 0 ? `bruto − ${brl(f.periodo.reembolsoCentavos)}` : undefined}
        />
        <StatCard
          label="Líquido − reembolsos"
          value={brl(f.periodo.receitaFinalLiquidaCentavos)}
          icon={Wallet}
          sub={`o que sobra pra você`}
        />
        <StatCard label="Clientes" value={f.periodo.clientes} icon={Users} />
        <StatCard
          label="Ticket médio"
          value={brl(f.periodo.ticketLiquidoCentavos)}
          icon={DollarSign}
          sub={`bruto ${brl(f.periodo.ticketCentavos)}`}
        />
      </div>

      {/* Gráfico */}
      <GraficoVendas dias={f.grafico} />

      <p className="text-[11px] text-muted-foreground">
        No período os clientes pagaram <b className="text-foreground">{brl(f.periodo.receitaCentavos)}</b>{" "}
        (bruto); depois da taxa da processadora você recebe{" "}
        <b className="text-primary">{brl(f.periodo.receitaLiquidaCentavos)}</b> (líquido).{" "}
        {f.periodo.reembolsos > 0 && (
          <>
            <b className="text-red-500">{f.periodo.reembolsos} reembolso{f.periodo.reembolsos === 1 ? "" : "s"}</b>{" "}
            (−{brl(f.periodo.reembolsoLiquidoCentavos)} do seu líquido).
          </>
        )}
      </p>

      {/* ---- Gasto com APIs (o que sai do seu bolso pra plataforma rodar) ---- */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Custos · {labelPeriodo}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            OpenAI vem da <b className="text-foreground">fatura oficial</b>
            {f.gastos.openaiConfigurada ? "" : " (pendente: falta a OPENAI_ADMIN_KEY no env, por enquanto é estimativa)"}
            ; Gemini, Veo e ElevenLabs são estimados pelo consumo medido de cada geração; Grok usa a média
            configurada por vídeo de 10s.
            {f.gastos.registroDesde && (
              <> Registrando o consumo interno desde <b className="text-foreground">{f.gastos.registroDesde}</b>.</>
            )}{" "}
            O gasto com anúncios vem direto da conta de anúncios da Meta e ainda{" "}
            <b className="text-foreground">não entra no Lucro real</b>. A Meta fecha o dia no fuso
            da própria conta de anúncios, então o corte do período pode diferir algumas horas do
            resto da página.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {f.gastos.porApi.map((a) => (
            <Card key={a.api}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{a.label}</p>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      a.real
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.real ? "fatura" : "estimado"}
                  </span>
                </div>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {brl(a.custoCentavos)}
                </p>
                <p className="truncate text-[11px] text-muted-foreground/70">
                  {a.api === "eleven" && cotaEleven ? `${a.detalhe} · ${cotaEleven}` : a.detalhe}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label={`Total em APIs · ${labelPeriodo}`}
            value={`− ${brl(f.gastos.totalCentavos)}`}
            icon={Cpu}
            sub={
              f.gastos.sistemaCentavos > 0
                ? `inclui ${brl(f.gastos.sistemaCentavos)} de rotinas sem usuário`
                : undefined
            }
          />
          <StatCard
            label={`Anúncios · ${labelPeriodo}`}
            value={anuncioTexto}
            icon={Megaphone}
            sub={anuncioLegenda}
          />
          <StatCard
            label="Lucro real"
            value={brl(f.lucroRealCentavos)}
            icon={PiggyBank}
            sub="líquido − reembolsos − APIs (sem anúncios)"
          />
        </div>
      </div>

      {/* ---- Gasto por usuário (custo real x créditos que ele pagou) ---- */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          Gasto por usuário · {labelPeriodo} ({f.gastos.porUsuario.length})
        </h2>
        {f.gastos.porUsuario.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border py-10 text-center">
            <Cpu className="size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhum gasto de API registrado no período</p>
            <p className="text-sm text-muted-foreground">
              As gerações passam a contar a partir de agora (o histórico antigo não tem medição).
            </p>
          </div>
        ) : (
          <FinancasUsuarios linhas={f.gastos.porUsuario} />
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Margem = créditos que o usuário gastou menos o custo real de API que ele gerou.
          Margem <b className="text-red-500">vermelha</b> significa que ele custa mais do que paga
          (admin e demo não pagam créditos, então aparecem negativos por natureza).
        </p>
      </div>

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
                  <TableHead className="text-right">Você recebe</TableHead>
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
                      <TableCell className="text-right">
                        <p className="text-sm font-semibold">
                          {c.pago ? brl(c.valorLiquidoCentavos) : "-"}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">
                          pagou {brl(c.valorCentavos)}
                        </p>
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
