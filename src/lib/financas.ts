import "server-only";

import {
  kiwifyConfigurada,
  listarVendas,
  valorVenda,
  valorLiquido,
  vendaEstaPaga,
  vendaEstornada,
  type VendaLista,
} from "@/lib/kiwify";

/** Painel financeiro: vendas reais da Kiwify (o plano de entrada e os pacotes). */

const DIA_MS = 86_400_000;

// Opções do filtro de período. v = nº de dias (1 = hoje, 0 = tudo desde o marco zero).
export const PERIODOS_FINANCAS = [
  { v: 1, label: "Hoje" },
  { v: 7, label: "7 dias" },
  { v: 14, label: "14 dias" },
  { v: 30, label: "30 dias" },
  { v: 0, label: "Tudo" },
] as const;
export const DIAS_PADRAO = 7;
const MAX_DIAS_GRAFICO = 90; // teto de buckets do "Tudo" (sanidade)

// MARCO ZERO das finanças: só conta venda a partir daqui. O histórico de
// teste/lançamento (01/07/2026 e antes) NÃO entra nos números. A partir de
// 02/07/2026 as vendas são reais. Pra mudar o corte, é só ajustar esta data.
const DESDE_ISO = "2026-07-02T00:00:00-03:00"; // 02/07/2026 00:00 (horário de Brasília)
const DESDE_MS = new Date(DESDE_ISO).getTime();
const fmtDesde = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// datas no fuso de São Paulo (pra o "dia" bater com o Brasil)
const fmtChave = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // -> "2026-07-01"
const fmtLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});
const fmtQuando = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export type DiaVenda = {
  chave: string;
  label: string;
  vendas: number;
  receitaCentavos: number; // bruto pago pelos clientes (linha verde)
  reembolsos: number;
  reembolsoCentavos: number; // perdido em reembolso/chargeback (linha vermelha)
};

export type VendaLinha = {
  nome: string;
  email: string;
  quando: string; // "03/07 16:35"
  status: string; // "paid" | "waiting_payment" | "refunded" | ...
  pago: boolean;
  valorCentavos: number;
};

export type PainelFinancas = {
  configurada: boolean;
  erro?: string;
  desde: string; // marco zero (ex: "02/07/2026") - antes disso não conta
  dias: number; // filtro escolhido (1 = hoje, 0 = tudo)
  hoje: { vendas: number; pagas: number; receitaCentavos: number };
  periodo: {
    dias: number; // dias efetivamente exibidos no gráfico
    vendasPagas: number;
    receitaCentavos: number; // bruto (tudo que entrou pago, mesmo que reembolsado depois)
    receitaLiquidaCentavos: number; // após a taxa da Kiwify
    reembolsos: number;
    reembolsoCentavos: number; // perda: o que saiu em reembolso/chargeback
    receitaFinalCentavos: number; // bruto − reembolsos (o número que importa)
    clientes: number; // e-mails distintos que pagaram
    ticketCentavos: number; // ticket médio bruto
  };
  grafico: DiaVenda[];
  vendasPeriodo: VendaLinha[]; // lista de vendas DO PERÍODO filtrado (mais recentes primeiro)
};

function nomeDe(v: VendaLista) {
  return v.customer?.name || v.customer?.full_name || "Sem nome";
}

export async function getPainelFinancas(diasFiltro?: number): Promise<PainelFinancas> {
  const valido = PERIODOS_FINANCAS.some((p) => p.v === diasFiltro);
  const filtro = valido ? (diasFiltro as number) : DIAS_PADRAO;

  const agora = Date.now();
  const diasDesdeMarco = Math.floor((agora - DESDE_MS) / DIA_MS) + 1;
  // nº de dias exibidos: "Tudo" = desde o marco zero (com teto); nunca antes do marco
  const nDias = Math.min(
    filtro === 0 ? diasDesdeMarco : filtro,
    diasDesdeMarco,
    MAX_DIAS_GRAFICO,
  );

  const desdeLabel = fmtDesde.format(new Date(DESDE_MS));
  const vazio: PainelFinancas = {
    configurada: kiwifyConfigurada(),
    desde: desdeLabel,
    dias: filtro,
    hoje: { vendas: 0, pagas: 0, receitaCentavos: 0 },
    periodo: {
      dias: nDias,
      vendasPagas: 0,
      receitaCentavos: 0,
      receitaLiquidaCentavos: 0,
      reembolsos: 0,
      reembolsoCentavos: 0,
      receitaFinalCentavos: 0,
      clientes: 0,
      ticketCentavos: 0,
    },
    grafico: [],
    vendasPeriodo: [],
  };
  if (!kiwifyConfigurada()) return { ...vazio, erro: "Kiwify não configurada." };

  // busca com 1 dia de margem pra trás (o "dia" é no fuso de SP, o instante ISO não)
  const inicioMs = Math.max(DESDE_MS, agora - nDias * DIA_MS);
  const inicioISO = new Date(inicioMs).toISOString();
  const fimISO = new Date(agora + 60_000).toISOString(); // um tiquinho no futuro

  let vendas: VendaLista[];
  try {
    vendas = await listarVendas(inicioISO, fimISO);
  } catch (e) {
    console.error("[financas] falha ao listar vendas", e);
    return { ...vazio, erro: "Não consegui buscar as vendas na Kiwify agora." };
  }

  // buckets por dia (só os dias visíveis do filtro)
  const buckets = new Map<
    string,
    { vendas: number; receitaCentavos: number; reembolsos: number; reembolsoCentavos: number }
  >();
  for (let i = 0; i < nDias; i++) {
    const d = new Date(agora - (nDias - 1 - i) * DIA_MS);
    buckets.set(fmtChave.format(d), {
      vendas: 0,
      receitaCentavos: 0,
      reembolsos: 0,
      reembolsoCentavos: 0,
    });
  }

  const hojeChave = fmtChave.format(new Date(agora));
  const clientesPagos = new Set<string>();
  let periodoReceita = 0;
  let periodoLiquido = 0;
  let periodoPagas = 0;
  let periodoReembolsos = 0;
  let periodoReembolsoCentavos = 0;
  const vendasPeriodo: (VendaLinha & { ts: number })[] = [];
  const hoje = { vendas: 0, pagas: 0, receitaCentavos: 0 };

  for (const v of vendas) {
    const criado = v.created_at ? new Date(v.created_at) : null;
    if (!criado) continue;
    // MARCO ZERO: ignora tudo que é anterior ao corte (histórico de teste não conta)
    if (criado.getTime() < DESDE_MS) continue;
    const chave = fmtChave.format(criado);
    const noPeriodo = buckets.has(chave);
    const pago = vendaEstaPaga(v);
    const estornada = vendaEstornada(v);
    const bruto = valorVenda(v);

    // vendas pagas contam pra receita/linha verde. Venda depois reembolsada
    // TAMBÉM conta como venda no dia em que entrou (o dinheiro entrou) - a
    // perda aparece na linha vermelha no dia do reembolso.
    if ((pago || estornada) && noPeriodo) {
      const b = buckets.get(chave)!;
      b.vendas++;
      b.receitaCentavos += bruto;
      periodoReceita += bruto;
      periodoLiquido += valorLiquido(v);
      periodoPagas++;
      const email = (v.customer?.email || "").toLowerCase();
      if (email) clientesPagos.add(email);
    }

    // reembolso/chargeback: perda no dia em que o estorno aconteceu
    if (estornada) {
      const quando = v.updated_at ? new Date(v.updated_at) : criado;
      const chaveEstorno = fmtChave.format(quando);
      const b = buckets.get(chaveEstorno) ?? (noPeriodo ? buckets.get(chave) : undefined);
      if (b) {
        b.reembolsos++;
        b.reembolsoCentavos += bruto;
        periodoReembolsos++;
        periodoReembolsoCentavos += bruto;
      }
    }

    // cards fixos de HOJE (independem do filtro)
    if (chave === hojeChave) {
      hoje.vendas++;
      if (pago) {
        hoje.pagas++;
        hoje.receitaCentavos += bruto;
      }
    }

    // lista do período: toda venda (paga, aguardando, estornada) dos dias exibidos
    if (noPeriodo) {
      vendasPeriodo.push({
        nome: nomeDe(v),
        email: v.customer?.email || "?",
        quando: fmtQuando.format(criado),
        status: v.status,
        pago,
        valorCentavos: bruto,
        ts: criado.getTime(),
      });
    }
  }

  vendasPeriodo.sort((a, b) => b.ts - a.ts);

  const grafico: DiaVenda[] = [...buckets.entries()].map(([chave, v]) => ({
    chave,
    label: fmtLabel.format(new Date(chave + "T12:00:00")),
    vendas: v.vendas,
    receitaCentavos: v.receitaCentavos,
    reembolsos: v.reembolsos,
    reembolsoCentavos: v.reembolsoCentavos,
  }));

  return {
    configurada: true,
    desde: desdeLabel,
    dias: filtro,
    hoje,
    periodo: {
      dias: nDias,
      vendasPagas: periodoPagas,
      receitaCentavos: periodoReceita,
      receitaLiquidaCentavos: periodoLiquido,
      reembolsos: periodoReembolsos,
      reembolsoCentavos: periodoReembolsoCentavos,
      receitaFinalCentavos: periodoReceita - periodoReembolsoCentavos,
      clientes: clientesPagos.size,
      ticketCentavos: periodoPagas > 0 ? Math.round(periodoReceita / periodoPagas) : 0,
    },
    grafico,
    // teto de 100 linhas pra tabela não explodir no "Tudo"
    vendasPeriodo: vendasPeriodo
      .slice(0, 100)
      .map(({ nome, email, quando, status, pago, valorCentavos }) => ({
        nome, email, quando, status, pago, valorCentavos,
      })),
  };
}
