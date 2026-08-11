import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Carteira de crédito (produção) + assinatura (biblioteca) - modelo "2 em 1".
 * O crédito é guardado SEMPRE em CENTAVOS de R$ (Int), pra não ter erro de float.
 */

// Crédito da assinatura de R$ 98,90: 4.000 créditos (R$ 40,00) por PAGAMENTO
// APROVADO, e só. Um na entrada, um em cada renovação, nunca dois no mesmo ciclo.
// Fora isso a pessoa pode somar +300 na tarefa do Instagram (ver bonus_instagram).
//
// Vale só pro plano NOVO. Assinatura antiga (Cakto, R$ 24,90) não recebe crédito
// mensal nenhum: mantém o acesso que comprou, mas o brinde recorrente acabou em
// 06/ago/2026, porque dava R$ 20/mês pra sempre por uma compra única.
//
// ⚠️ VALOR PROVISÓRIO - calibrar com o preço real do Gemini/ElevenLabs + o worker
//    (ver lembrete em reminder.md).
export const CREDITO_MENSAL_CENTAVOS = 4000;

/**
 * Piso pra uma cobrança contar como "oferta de hoje".
 *
 * ⚠️ SEMPRE que o preço da oferta baixar, CONFERIR ESTE PISO. Uma oferta abaixo
 * dele é vendida normalmente e a pessoa não recebe crédito nenhum, porque o
 * `creditoDaCobranca` devolve 0. Foi o que quase aconteceu em 08/ago/2026, ao
 * baixar a oferta principal pra R$ 39,90 com o piso ainda em R$ 50.
 *
 * E o valor comparado NÃO é o preço da oferta: é o `amount` da Cakto, que vem
 * com R$ 0,99 de taxa somados (R$ 39,90 chega aqui como 4089).
 *
 * Ofertas VIVAS na Cakto: R$ 39,90 (a principal de hoje), R$ 68,00 e R$ 98,90
 * mensais, e R$ 158,90 único/vitalício. As MORTAS são R$ 24,90 (chega como
 * 2589) e R$ 19,90 (2089). R$ 30,00 cai no vão entre as duas faixas, com folga
 * dos dois lados.
 */
export const PISO_OFERTA_CENTAVOS = Number(process.env.PISO_OFERTA_CENTAVOS || 3000);

/**
 * Quanto de crédito uma cobrança APROVADA vale.
 *
 * Quem decide não é o gateway, é o VALOR PAGO. A Cakto NÃO é legado: vende as
 * mesmas ofertas de hoje e é por onde os afiliados divulgam, então separar por
 * gateway puniria a venda do afiliado. E não é proporcional ao preço: decisão do
 * Lucas em 06/ago é que TODA oferta viva entrega os mesmos 4.000, seja a de
 * R$ 68 ou a de R$ 158,90. Só a oferta velha de R$ 24,90/19,90 fica fora, que é
 * a outra regra dele ("quem pagou antes do Mercado Pago não ganha crédito
 * mensal").
 */
export function creditoDaCobranca(centavosPagos: number | null | undefined): number {
  // sem valor conhecido, assume oferta atual: hoje é o que todo mundo paga, e
  // errar pra menos significa entregar menos do que a pessoa comprou
  if (centavosPagos == null) return CREDITO_MENSAL_CENTAVOS;
  return centavosPagos >= PISO_OFERTA_CENTAVOS ? CREDITO_MENSAL_CENTAVOS : 0;
}

// Quanto tempo cada pagamento (entrada + cada renovação paga) libera a biblioteca.
// A assinatura NÃO é mais permanente: se a cobrança mensal não for repaga, ela vence
// e a biblioteca trava (o crédito comprado continua valendo). São 30 dias do ciclo +
// 3 de folga, pra uma renovação que chega um pouco atrasada não cortar quem pagou.
export const DIAS_ASSINATURA = 33;

export type TipoTransacao =
  | "compra"
  | "debito_geracao"
  | "debito_processamento"
  | "bonus_assinatura"
  | "bonus_instagram" // +300 por seguir o Instagram (liberado pelo admin)
  | "ajuste_admin"
  | "estorno"
  | "suspensao_reembolso" // reembolso SOLICITADO: congela (zera) o saldo até a decisão
  | "reversao_suspensao" // reembolso cancelado/decidido: devolve o que foi congelado
  | "liberacao_garantia" // crédito comprado que estava em quarentena e destravou (8º dia)
  | "quitacao_divida"; // abate do saldo devedor deixado por um reembolso com crédito já gasto

/** Já existe uma transação desse tipo pra esse pedido Kiwify? (idempotência). */
export async function existeTransacaoOrder(
  kiwifyOrderId: string,
  tipo: TipoTransacao,
): Promise<boolean> {
  const t = await prisma.creditoTransacao.findFirst({
    where: { kiwifyOrderId, tipo },
    select: { id: true },
  });
  return !!t;
}

const DIA_MS = 86_400_000;

/** Estende a assinatura a partir do maior entre agora e o vencimento atual. */
export async function estenderAssinatura(userId: string, dias: number) {
  if (dias <= 0) return;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { assinaturaAte: true },
  });
  const atual = u?.assinaturaAte?.getTime() ?? 0;
  const base = atual > Date.now() ? atual : Date.now();
  await prisma.user.update({
    where: { id: userId },
    data: { assinante: true, assinaturaAte: new Date(base + dias * DIA_MS) },
  });
}

// aplicarCreditosPendentes mudou de casa: agora vive em liberacao-creditos.ts,
// porque compra de pacote passa pela quarentena do nível da conta.

export function brl(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Nº de créditos exibido ao usuário. 1 crédito = R$ 0,01, então o saldo em
 *  centavos é o próprio número de créditos (R$ 1,00 = 100 créditos). */
export function fmtCreditos(centavos: number) {
  return Math.round(centavos).toLocaleString("pt-BR");
}

export type Carteira = {
  saldoCentavos: number;
  assinante: boolean;
  assinaturaAte: Date | null;
};

/** Total de créditos que JÁ ENTRARAM (compras + bônus + ajustes). Base da barrinha
 *  "% ainda não gasto" = saldo / totalEntradas. */
export async function totalEntradas(userId: string): Promise<number> {
  const r = await prisma.creditoTransacao.aggregate({
    where: { userId, valor: { gt: 0 } },
    _sum: { valor: true },
  });
  return r._sum.valor ?? 0;
}

/** Tem crédito pra produzir? (qualquer saldo positivo). */
export async function temSaldo(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { saldoCentavos: true },
  });
  return (u?.saldoCentavos ?? 0) > 0;
}

export async function getCarteira(userId: string): Promise<Carteira> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { saldoCentavos: true, assinante: true, assinaturaAte: true },
  });
  return {
    saldoCentavos: u?.saldoCentavos ?? 0,
    assinante: u?.assinante ?? false,
    assinaturaAte: u?.assinaturaAte ?? null,
  };
}

/** Aplica um delta no saldo e registra no extrato - atômico (1 transação).
 *  TODA entrada (valor > 0) quita o saldo devedor de reembolso primeiro:
 *  compra, brinde mensal, bônus, liberação de quarentena, ajuste do admin.
 *  Retorna o saldo final (já descontada a quitação, se houve). */
export async function lancar(
  userId: string,
  valorCentavos: number, // + entrada, − saída
  tipo: TipoTransacao,
  opts: { descricao?: string; jobId?: string; kiwifyOrderId?: string } = {},
) {
  const saldoApos = await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { saldoCentavos: true },
    });
    if (!u) throw new Error("Usuário não encontrado.");
    const saldoApos = u.saldoCentavos + valorCentavos;
    if (saldoApos < 0) throw new Error("Saldo insuficiente.");
    await tx.user.update({
      where: { id: userId },
      data: { saldoCentavos: saldoApos },
    });
    await tx.creditoTransacao.create({
      data: {
        userId,
        tipo,
        valor: valorCentavos,
        saldoApos,
        descricao: opts.descricao,
        jobId: opts.jobId,
        kiwifyOrderId: opts.kiwifyOrderId,
      },
    });
    return saldoApos;
  });

  if (valorCentavos > 0 && tipo !== "quitacao_divida") {
    const pago = await quitarDivida(userId);
    return saldoApos - pago;
  }
  return saldoApos;
}

/** Abate a dívida de reembolso com o saldo disponível. Retorna o valor quitado. */
export async function quitarDivida(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { dividaCentavos: true },
  });
  const divida = u?.dividaCentavos ?? 0;
  if (divida <= 0) return 0;

  const pago = await debitarClamp(userId, divida, "quitacao_divida", {
    descricao: "Quitação do saldo devedor de reembolso",
  });
  if (pago > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { dividaCentavos: { decrement: pago } },
    });
  }
  return pago;
}

export function creditar(
  userId: string,
  centavos: number,
  tipo: TipoTransacao = "compra",
  descricao?: string,
) {
  return lancar(userId, Math.abs(centavos), tipo, { descricao });
}

export function debitar(
  userId: string,
  centavos: number,
  tipo: TipoTransacao,
  opts: { descricao?: string; jobId?: string } = {},
) {
  return lancar(userId, -Math.abs(centavos), tipo, opts);
}

/** Débito pós-pago que NUNCA deixa o saldo negativo (clampa em 0). Registra no
 *  extrato só o que foi efetivamente debitado. Retorna o valor debitado (centavos). */
export async function debitarClamp(
  userId: string,
  centavos: number,
  tipo: TipoTransacao,
  opts: { descricao?: string; jobId?: string; kiwifyOrderId?: string } = {},
): Promise<number> {
  const alvo = Math.abs(centavos);
  if (alvo <= 0) return 0;
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { saldoCentavos: true },
    });
    if (!u) return 0;
    const valor = Math.min(u.saldoCentavos, alvo); // nunca passa do saldo
    if (valor <= 0) return 0;
    const saldoApos = u.saldoCentavos - valor;
    await tx.user.update({
      where: { id: userId },
      data: { saldoCentavos: saldoApos },
    });
    await tx.creditoTransacao.create({
      data: {
        userId,
        tipo,
        valor: -valor,
        saldoApos,
        descricao: opts.descricao,
        jobId: opts.jobId,
        kiwifyOrderId: opts.kiwifyOrderId,
      },
    });
    return valor;
  });
}

/** Já existe um débito registrado pra esse job? (idempotência) */
export async function jobJaDebitado(jobId: string): Promise<boolean> {
  const t = await prisma.creditoTransacao.findFirst({
    where: {
      jobId,
      tipo: { in: ["debito_geracao", "debito_processamento"] },
    },
    select: { id: true },
  });
  return !!t;
}

export async function listarExtrato(userId: string, limite = 50) {
  return prisma.creditoTransacao.findMany({
    where: { userId },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
}

/*
 * REMOVIDO em 06/ago/2026: `garantirCreditoMensal`.
 *
 * Ela dava crédito no primeiro acesso ao PAINEL, e abrir o painel não é pagar.
 * Enquanto existiu, foi o cano por onde saiu crédito de graça: conta antiga da
 * Cakto entrava, abria a tela e ganhava 2.000 sem ter pago nada naquele mês.
 *
 * Agora existe UMA regra só: crédito de assinatura vem de PAGAMENTO APROVADO.
 *  - entrada do plano novo: 4.000 no cadastro (`criarContaLiberada`);
 *  - cada renovação paga: 4.000 no `processarPagamentoMP`.
 * Quem pagou antes do Mercado Pago mantém o acesso que comprou, mas não recebe
 * crédito mensal (decisão do Lucas, 06/ago: "todos que pagaram antes do Mercado
 * Pago não ganham créditos mensalmente").
 */
