import "server-only";

import {
  kiwifyConfigurada,
  listarVendas,
  valorVenda,
  valorLiquido as liquidoKiwify,
  vendaEstaPaga,
  vendaEstornada,
  type VendaLista,
} from "@/lib/kiwify";
import {
  caktoConfigurada,
  listarPedidos,
  valorPedido,
  valorLiquido as liquidoCakto,
  pedidoEstaPago,
  pedidoEstornado,
  type PedidoLista,
} from "@/lib/cakto";
import {
  listarVendasMP,
  mercadoPagoConfigurado,
  type VendaMP,
} from "@/lib/mercadopago";
import { getPainelGastos, type PainelGastos } from "@/lib/gastos-api";
import { getGastoAnuncios, type GastoAnuncios } from "@/lib/meta-ads";

/** Painel financeiro: vendas reais da Cakto (atual) + Kiwify (histórico), somadas,
 *  + o GASTO com as APIs pagas (OpenAI real, Gemini/Veo/Eleven estimados, Grok médio). */

/** Venda normalizada, agnóstica de gateway - já com pago/estornada e valores em centavos. */
type VendaNorm = {
  created_at?: string;
  updated_at?: string;
  status: string;
  pago: boolean;
  estornada: boolean;
  brutoCentavos: number;
  liquidoCentavos: number;
  nome: string;
  email: string;
};

function deCakto(p: PedidoLista): VendaNorm {
  return {
    created_at: p.created_at,
    updated_at: p.updated_at,
    status: p.status,
    pago: pedidoEstaPago({ id: p.id, status: p.status }),
    estornada: pedidoEstornado({ id: p.id, status: p.status }),
    brutoCentavos: valorPedido(p),
    liquidoCentavos: liquidoCakto(p),
    nome: p.customer?.name || p.customer?.full_name || "Sem nome",
    email: p.customer?.email || "",
  };
}

function deKiwify(v: VendaLista): VendaNorm {
  return {
    created_at: v.created_at,
    updated_at: v.updated_at,
    status: v.status,
    pago: vendaEstaPaga({ id: v.id, status: v.status }),
    estornada: vendaEstornada({ id: v.id, status: v.status }),
    brutoCentavos: valorVenda(v),
    liquidoCentavos: liquidoKiwify(v),
    nome: v.customer?.name || v.customer?.full_name || "Sem nome",
    email: v.customer?.email || "",
  };
}

/** Uma venda do Mercado Pago no formato comum do painel. */
function deMercadoPago(v: VendaMP): VendaNorm {
  const PAGO = new Set(["approved", "authorized"]);
  const ESTORNO = new Set(["refunded", "charged_back"]);
  return {
    created_at: v.criadoEm,
    updated_at: v.atualizadoEm,
    status: v.status,
    pago: PAGO.has(v.status),
    estornada: ESTORNO.has(v.status),
    brutoCentavos: v.brutoCentavos,
    liquidoCentavos: v.liquidoCentavos,
    nome: v.nome,
    email: v.email,
  };
}

/** Busca as vendas do período em TODOS os gateways configurados e junta. */
async function listarTodasVendas(inicioISO: string, fimISO: string): Promise<VendaNorm[]> {
  const out: VendaNorm[] = [];
  const erros: string[] = [];
  if (caktoConfigurada()) {
    try {
      const ck = await listarPedidos(inicioISO, fimISO);
      out.push(...ck.map(deCakto));
    } catch (e) {
      console.error("[financas] falha ao listar pedidos Cakto", e);
      erros.push("Cakto");
    }
  }
  if (kiwifyConfigurada()) {
    try {
      const kw = await listarVendas(inicioISO, fimISO);
      out.push(...kw.map(deKiwify));
    } catch (e) {
      console.error("[financas] falha ao listar vendas Kiwify", e);
      erros.push("Kiwify");
    }
  }
  // Mercado Pago: é por onde entra toda venda nova desde 06/ago. Sem esta parte
  // o painel mostrava faturamento só da Cakto e a assinatura nova não aparecia.
  if (mercadoPagoConfigurado()) {
    try {
      const mp = await listarVendasMP(inicioISO, fimISO);
      out.push(...mp.map(deMercadoPago));
    } catch (e) {
      console.error("[financas] falha ao listar vendas Mercado Pago", e);
      erros.push("Mercado Pago");
    }
  }
  // se TODOS os gateways configurados falharam, propaga o erro
  if (erros.length > 0 && out.length === 0) {
    throw new Error(`Falha ao buscar vendas: ${erros.join(", ")}`);
  }
  return out;
}

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

// MARCO ZERO das finanças: só conta venda a partir daqui. Pra mudar o corte, é
// só ajustar esta data. Passou pra 29/06/2026 a pedido (pega mais dias atrás).
const DESDE_ISO = "2026-06-29T00:00:00-03:00"; // 29/06/2026 00:00 (horário de Brasília)
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
  receitaCentavos: number; // bruto pago pelos clientes
  receitaLiquidaCentavos: number; // LÍQUIDO recebido (após taxa) - linha verde
  reembolsos: number;
  reembolsoCentavos: number; // perdido em reembolso/chargeback (linha vermelha)
};

export type VendaLinha = {
  nome: string;
  email: string;
  quando: string; // "03/07 16:35"
  status: string; // "paid" | "waiting_payment" | "refunded" | ...
  pago: boolean;
  valorCentavos: number; // bruto (o que o cliente pagou)
  valorLiquidoCentavos: number; // LÍQUIDO (o que você recebe)
};

export type PainelFinancas = {
  configurada: boolean;
  erro?: string;
  desde: string; // marco zero (ex: "02/07/2026") - antes disso não conta
  dias: number; // filtro escolhido (1 = hoje, 0 = tudo)
  hoje: {
    vendas: number;
    pagas: number;
    receitaCentavos: number; // bruto
    receitaLiquidaCentavos: number; // LÍQUIDO recebido hoje
  };
  periodo: {
    dias: number; // dias efetivamente exibidos no gráfico
    vendasPagas: number;
    receitaCentavos: number; // bruto (tudo que entrou pago, mesmo que reembolsado depois)
    receitaLiquidaCentavos: number; // LÍQUIDO recebido (após a taxa da processadora)
    reembolsos: number;
    reembolsoCentavos: number; // perda bruta: o que saiu em reembolso/chargeback
    reembolsoLiquidoCentavos: number; // perda líquida (o líquido das vendas estornadas)
    receitaFinalCentavos: number; // bruto − reembolsos
    receitaFinalLiquidaCentavos: number; // LÍQUIDO − reembolsos (o que sobra pra você)
    clientes: number; // e-mails distintos que pagaram
    ticketCentavos: number; // ticket médio bruto
    ticketLiquidoCentavos: number; // ticket médio LÍQUIDO
  };
  grafico: DiaVenda[];
  vendasPeriodo: VendaLinha[]; // lista de vendas DO PERÍODO filtrado (mais recentes primeiro)
  /** gasto com APIs no MESMO período do filtro (por API e por usuário) */
  gastos: PainelGastos;
  /** gasto com anúncios na Meta no MESMO período (custo de tráfego) */
  anuncios: GastoAnuncios;
  /** o que sobra de verdade: líquido − reembolsos − APIs */
  lucroRealCentavos: number;
};

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

  // busca com 1 dia de margem pra trás (o "dia" é no fuso de SP, o instante ISO não)
  const inicioMs = Math.max(DESDE_MS, agora - nDias * DIA_MS);
  const fimMs = agora + 60_000; // um tiquinho no futuro

  // gasto com APIs do MESMO período: roda em paralelo com a busca de vendas
  // (getPainelGastos nunca rejeita: no pior caso volta zerado)
  const gastosPromise = getPainelGastos(inicioMs, fimMs);
  // gasto com anúncios da Meta no mesmo período (também nunca rejeita)
  const anunciosPromise = getGastoAnuncios(nDias);

  const desdeLabel = fmtDesde.format(new Date(DESDE_MS));
  const vazio: PainelFinancas = {
    configurada: caktoConfigurada() || kiwifyConfigurada() || mercadoPagoConfigurado(),
    desde: desdeLabel,
    dias: filtro,
    hoje: { vendas: 0, pagas: 0, receitaCentavos: 0, receitaLiquidaCentavos: 0 },
    periodo: {
      dias: nDias,
      vendasPagas: 0,
      receitaCentavos: 0,
      receitaLiquidaCentavos: 0,
      reembolsos: 0,
      reembolsoCentavos: 0,
      reembolsoLiquidoCentavos: 0,
      receitaFinalCentavos: 0,
      receitaFinalLiquidaCentavos: 0,
      clientes: 0,
      ticketCentavos: 0,
      ticketLiquidoCentavos: 0,
    },
    grafico: [],
    vendasPeriodo: [],
    gastos: {
      registroDesde: null,
      openaiConfigurada: false,
      porApi: [],
      totalCentavos: 0,
      porUsuario: [],
      sistemaCentavos: 0,
    },
    anuncios: { configurado: false, centavos: 0, moeda: null, erro: null, janela: null },
    lucroRealCentavos: 0,
  };
  if (!caktoConfigurada() && !kiwifyConfigurada() && !mercadoPagoConfigurado()) {
    const [gastos, anuncios] = await Promise.all([gastosPromise, anunciosPromise]);
    return {
      ...vazio,
      gastos,
      anuncios,
      lucroRealCentavos: -gastos.totalCentavos,
      erro: "Nenhum gateway de pagamento configurado.",
    };
  }

  const inicioISO = new Date(inicioMs).toISOString();
  const fimISO = new Date(fimMs).toISOString();

  let vendas: VendaNorm[];
  try {
    vendas = await listarTodasVendas(inicioISO, fimISO);
  } catch (e) {
    console.error("[financas] falha ao listar vendas", e);
    const [gastos, anuncios] = await Promise.all([gastosPromise, anunciosPromise]);
    return {
      ...vazio,
      gastos,
      anuncios,
      lucroRealCentavos: -gastos.totalCentavos,
      erro: "Não consegui buscar as vendas agora.",
    };
  }

  // buckets por dia (só os dias visíveis do filtro)
  const buckets = new Map<
    string,
    {
      vendas: number;
      receitaCentavos: number;
      receitaLiquidaCentavos: number;
      reembolsos: number;
      reembolsoCentavos: number;
    }
  >();
  for (let i = 0; i < nDias; i++) {
    const d = new Date(agora - (nDias - 1 - i) * DIA_MS);
    buckets.set(fmtChave.format(d), {
      vendas: 0,
      receitaCentavos: 0,
      receitaLiquidaCentavos: 0,
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
  let periodoReembolsoLiquido = 0;
  const vendasPeriodo: (VendaLinha & { ts: number })[] = [];
  const hoje = { vendas: 0, pagas: 0, receitaCentavos: 0, receitaLiquidaCentavos: 0 };

  for (const v of vendas) {
    const criado = v.created_at ? new Date(v.created_at) : null;
    if (!criado) continue;
    // MARCO ZERO: ignora tudo que é anterior ao corte (histórico de teste não conta)
    if (criado.getTime() < DESDE_MS) continue;
    const chave = fmtChave.format(criado);
    const noPeriodo = buckets.has(chave);
    const pago = v.pago;
    const estornada = v.estornada;
    const bruto = v.brutoCentavos;

    // vendas pagas contam pra receita/linha verde. Venda depois reembolsada
    // TAMBÉM conta como venda no dia em que entrou (o dinheiro entrou) - a
    // perda aparece na linha vermelha no dia do reembolso.
    if ((pago || estornada) && noPeriodo) {
      const b = buckets.get(chave)!;
      b.vendas++;
      b.receitaCentavos += bruto;
      b.receitaLiquidaCentavos += v.liquidoCentavos;
      periodoReceita += bruto;
      periodoLiquido += v.liquidoCentavos;
      periodoPagas++;
      const email = v.email.toLowerCase();
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
        periodoReembolsoLiquido += v.liquidoCentavos;
      }
    }

    // cards fixos de HOJE (independem do filtro)
    if (chave === hojeChave) {
      hoje.vendas++;
      if (pago) {
        hoje.pagas++;
        hoje.receitaCentavos += bruto;
        hoje.receitaLiquidaCentavos += v.liquidoCentavos;
      }
    }

    // lista do período: toda venda (paga, aguardando, estornada) dos dias exibidos
    if (noPeriodo) {
      vendasPeriodo.push({
        nome: v.nome,
        email: v.email || "?",
        quando: fmtQuando.format(criado),
        status: v.status,
        pago,
        valorCentavos: bruto,
        valorLiquidoCentavos: v.liquidoCentavos,
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
    receitaLiquidaCentavos: v.receitaLiquidaCentavos,
    reembolsos: v.reembolsos,
    reembolsoCentavos: v.reembolsoCentavos,
  }));

  const [gastos, anuncios] = await Promise.all([gastosPromise, anunciosPromise]);
  const receitaFinalLiquida = periodoLiquido - periodoReembolsoLiquido;

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
      reembolsoLiquidoCentavos: periodoReembolsoLiquido,
      receitaFinalCentavos: periodoReceita - periodoReembolsoCentavos,
      receitaFinalLiquidaCentavos: receitaFinalLiquida,
      clientes: clientesPagos.size,
      ticketCentavos: periodoPagas > 0 ? Math.round(periodoReceita / periodoPagas) : 0,
      ticketLiquidoCentavos: periodoPagas > 0 ? Math.round(periodoLiquido / periodoPagas) : 0,
    },
    gastos,
    anuncios,
    lucroRealCentavos: receitaFinalLiquida - gastos.totalCentavos,
    grafico,
    // teto de 100 linhas pra tabela não explodir no "Tudo"
    vendasPeriodo: vendasPeriodo
      .slice(0, 100)
      .map(({ nome, email, quando, status, pago, valorCentavos, valorLiquidoCentavos }) => ({
        nome, email, quando, status, pago, valorCentavos, valorLiquidoCentavos,
      })),
  };
}
