import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Carteira de crédito (produção) + assinatura (biblioteca) - modelo "2 em 1".
 * O crédito é guardado SEMPRE em CENTAVOS de R$ (Int), pra não ter erro de float.
 */

// Crédito mensal de brinde da assinatura. Oferta atual: 2.000 créditos = R$ 20,00/mês
// (~20 a 30 vídeos), generoso de propósito pra atrair assinantes no lançamento.
// ⚠️ VALOR PROVISÓRIO - calibrar com o preço real do Gemini/ElevenLabs + o worker
//    (ver lembrete em reminder.md).
export const CREDITO_MENSAL_CENTAVOS = 2000;

export type TipoTransacao =
  | "compra"
  | "debito_geracao"
  | "debito_processamento"
  | "bonus_assinatura"
  | "ajuste_admin";

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

/** Aplica um delta no saldo e registra no extrato - atômico (1 transação). */
export async function lancar(
  userId: string,
  valorCentavos: number, // + entrada, − saída
  tipo: TipoTransacao,
  opts: { descricao?: string; jobId?: string } = {},
) {
  return prisma.$transaction(async (tx) => {
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
      },
    });
    return saldoApos;
  });
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
  opts: { descricao?: string; jobId?: string } = {},
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

/** Garante o crédito mensal da assinatura (bônus). Idempotente por mês. */
export async function garantirCreditoMensal(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { assinante: true, assinaturaAte: true, creditoMensalEm: true },
  });
  if (!u?.assinante) return;
  if (u.assinaturaAte && u.assinaturaAte.getTime() < Date.now()) return; // vencida

  const agora = new Date();
  const ultimo = u.creditoMensalEm;
  const mesmoMes =
    !!ultimo &&
    ultimo.getFullYear() === agora.getFullYear() &&
    ultimo.getMonth() === agora.getMonth();
  if (mesmoMes) return; // já recebeu este mês

  await prisma.$transaction(async (tx) => {
    const cur = await tx.user.findUnique({
      where: { id: userId },
      select: { saldoCentavos: true },
    });
    const saldoApos = (cur?.saldoCentavos ?? 0) + CREDITO_MENSAL_CENTAVOS;
    await tx.user.update({
      where: { id: userId },
      data: { saldoCentavos: saldoApos, creditoMensalEm: agora },
    });
    await tx.creditoTransacao.create({
      data: {
        userId,
        tipo: "bonus_assinatura",
        valor: CREDITO_MENSAL_CENTAVOS,
        saldoApos,
        descricao: "Crédito mensal da assinatura",
      },
    });
  });
}
