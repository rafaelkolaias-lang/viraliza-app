import "server-only";

import {
  kiwifyConfigurada,
  listarVendas,
  valorVenda,
  valorLiquido,
  vendaEstaPaga,
  type VendaLista,
} from "@/lib/kiwify";

/** Painel financeiro: vendas reais da Kiwify (o plano de entrada e os pacotes). */

const DIAS = 30;
const DIA_MS = 86_400_000;

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
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export type DiaVenda = {
  chave: string;
  label: string;
  vendas: number;
  receitaCentavos: number; // bruto pago pelos clientes
};

export type CompradorHoje = {
  nome: string;
  email: string;
  hora: string;
  status: string; // "paid" | "waiting_payment" | "refunded" | ...
  pago: boolean;
  valorCentavos: number;
};

export type PainelFinancas = {
  configurada: boolean;
  erro?: string;
  desde: string; // marco zero (ex: "02/07/2026") - antes disso não conta
  hoje: { vendas: number; pagas: number; receitaCentavos: number };
  periodo: {
    dias: number;
    vendasPagas: number;
    receitaCentavos: number; // bruto
    receitaLiquidaCentavos: number; // o que cai pra você
    clientes: number; // e-mails distintos que pagaram
    ticketCentavos: number; // ticket médio bruto
  };
  grafico: DiaVenda[];
  compradoresHoje: CompradorHoje[];
};

function nomeDe(v: VendaLista) {
  return v.customer?.name || v.customer?.full_name || "Sem nome";
}

export async function getPainelFinancas(): Promise<PainelFinancas> {
  const desdeLabel = fmtDesde.format(new Date(DESDE_MS));
  const vazio: PainelFinancas = {
    configurada: kiwifyConfigurada(),
    desde: desdeLabel,
    hoje: { vendas: 0, pagas: 0, receitaCentavos: 0 },
    periodo: {
      dias: DIAS,
      vendasPagas: 0,
      receitaCentavos: 0,
      receitaLiquidaCentavos: 0,
      clientes: 0,
      ticketCentavos: 0,
    },
    grafico: [],
    compradoresHoje: [],
  };
  if (!kiwifyConfigurada()) return { ...vazio, erro: "Kiwify não configurada." };

  const agora = Date.now();
  const inicioISO = new Date(agora - (DIAS - 1) * DIA_MS).toISOString();
  const fimISO = new Date(agora + 60_000).toISOString(); // um tiquinho no futuro

  let vendas: VendaLista[];
  try {
    vendas = await listarVendas(inicioISO, fimISO);
  } catch (e) {
    console.error("[financas] falha ao listar vendas", e);
    return { ...vazio, erro: "Não consegui buscar as vendas na Kiwify agora." };
  }

  // buckets por dia: começa no marco zero (nunca mostra dia antes do corte), até
  // no máximo DIAS dias. Enquanto o marco for recente, mostra só os dias já corridos.
  const diasDesde = Math.floor((agora - DESDE_MS) / DIA_MS);
  const nDias = Math.min(DIAS, Math.max(1, diasDesde + 1));
  const buckets = new Map<string, { vendas: number; receitaCentavos: number }>();
  for (let i = 0; i < nDias; i++) {
    const d = new Date(agora - (nDias - 1 - i) * DIA_MS);
    buckets.set(fmtChave.format(d), { vendas: 0, receitaCentavos: 0 });
  }

  const hojeChave = fmtChave.format(new Date(agora));
  const clientesPagos = new Set<string>();
  let periodoReceita = 0;
  let periodoLiquido = 0;
  let periodoPagas = 0;
  const compradoresHoje: CompradorHoje[] = [];
  const hoje = { vendas: 0, pagas: 0, receitaCentavos: 0 };

  for (const v of vendas) {
    const criado = v.created_at ? new Date(v.created_at) : null;
    if (!criado) continue;
    // MARCO ZERO: ignora tudo que é anterior ao corte (histórico de teste não conta)
    if (criado.getTime() < DESDE_MS) continue;
    const chave = fmtChave.format(criado);
    const pago = vendaEstaPaga(v);
    const bruto = valorVenda(v);

    // só vendas pagas contam pra receita/gráfico
    if (pago) {
      const b = buckets.get(chave);
      if (b) {
        b.vendas++;
        b.receitaCentavos += bruto;
      }
      periodoReceita += bruto;
      periodoLiquido += valorLiquido(v);
      periodoPagas++;
      const email = (v.customer?.email || "").toLowerCase();
      if (email) clientesPagos.add(email);
    }

    // "entraram hoje": toda venda de hoje (paga ou aguardando), pra você acompanhar
    if (chave === hojeChave) {
      hoje.vendas++;
      if (pago) {
        hoje.pagas++;
        hoje.receitaCentavos += bruto;
      }
      compradoresHoje.push({
        nome: nomeDe(v),
        email: v.customer?.email || "?",
        hora: criado ? fmtHora.format(criado) : "",
        status: v.status,
        pago,
        valorCentavos: bruto,
      });
    }
  }

  compradoresHoje.sort((a, b) => b.hora.localeCompare(a.hora));

  const grafico: DiaVenda[] = [...buckets.entries()].map(([chave, v]) => ({
    chave,
    label: fmtLabel.format(new Date(chave + "T12:00:00")),
    vendas: v.vendas,
    receitaCentavos: v.receitaCentavos,
  }));

  return {
    configurada: true,
    desde: desdeLabel,
    hoje,
    periodo: {
      dias: nDias,
      vendasPagas: periodoPagas,
      receitaCentavos: periodoReceita,
      receitaLiquidaCentavos: periodoLiquido,
      clientes: clientesPagos.size,
      ticketCentavos: periodoPagas > 0 ? Math.round(periodoReceita / periodoPagas) : 0,
    },
    grafico,
    compradoresHoje,
  };
}
