import "server-only";

import { prisma } from "@/lib/prisma";
import { existeTransacaoOrder, lancar } from "@/lib/creditos";

/**
 * Crédito comprado - a QUARENTENA FOI DESATIVADA (reforma dos níveis, 08/2026).
 *
 * Antes, parte da compra ficava presa numa CreditoLiberacao até o 8º dia
 * (garantia da Cakto/Kiwify), conforme o nível da conta. Hoje TODA compra cai
 * 100% no saldo na hora, pra qualquer nível.
 *
 * O que continua vivo aqui é o LEGADO: liberações criadas antes da mudança
 * seguem caindo sozinhas na data (aplicarLiberacoesVencidas), reembolso de
 * pedido antigo ainda cancela o que estava preso (cancelarLiberacoesDoPedido)
 * e a UI segue mostrando o "crédito liberando" enquanto existir linha pendente
 * (presoCentavos). Quando o legado zerar, nada disso tem mais efeito.
 */

export type ResultadoCompra = {
  liberadoCentavos: number;
  presoCentavos: number;
  saldoApos: number;
  dividaQuitada: number;
};

export async function creditarCompraComQuarentena(
  userId: string,
  valorCentavos: number,
  opts: { descricao?: string; orderId?: string } = {},
): Promise<ResultadoCompra> {
  const valor = Math.max(0, Math.round(valorCentavos));
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { dividaCentavos: true },
  });
  if (!u) throw new Error("Usuário não encontrado.");

  // libera tudo na hora; o nome da função ficou pelo histórico dos chamadores
  const liberado = valor;

  // registra a compra mesmo com liberado = 0 (é o marcador de idempotência do
  // pedido). O lancar já quita o saldo devedor de reembolso com qualquer entrada
  // e devolve o saldo final líquido.
  const dividaAntes = u.dividaCentavos;
  const saldoApos = await lancar(userId, liberado, "compra", {
    descricao: opts.descricao ?? "Compra de créditos",
    kiwifyOrderId: opts.orderId,
  });

  let dividaQuitada = 0;
  if (dividaAntes > 0) {
    const depois = await prisma.user.findUnique({
      where: { id: userId },
      select: { dividaCentavos: true },
    });
    dividaQuitada = dividaAntes - (depois?.dividaCentavos ?? 0);
  }

  return {
    liberadoCentavos: liberado,
    presoCentavos: 0,
    saldoApos,
    dividaQuitada,
  };
}

/** Total de crédito comprado ainda PRESO na quarentena (pra mostrar na UI). */
export async function presoCentavos(userId: string): Promise<number> {
  const r = await prisma.creditoLiberacao.aggregate({
    where: { userId, aplicado: false, cancelado: false },
    _sum: { valor: true },
  });
  return r._sum.valor ?? 0;
}

/**
 * Varredura periódica: aplica as liberações vencidas (8º dia chegou). Cada linha
 * é "reivindicada" com updateMany condicional, então duas varreduras ao mesmo
 * tempo não creditam em dobro.
 */
export async function aplicarLiberacoesVencidas() {
  const vencidas = await prisma.creditoLiberacao.findMany({
    where: { aplicado: false, cancelado: false, liberaEm: { lte: new Date() } },
    take: 200,
    select: { id: true, userId: true, valor: true, orderId: true },
  });

  for (const l of vencidas) {
    try {
      const claim = await prisma.creditoLiberacao.updateMany({
        where: { id: l.id, aplicado: false, cancelado: false },
        data: { aplicado: true },
      });
      if (claim.count !== 1) continue; // outra varredura pegou

      // o lancar já quita saldo devedor de reembolso com qualquer entrada
      await lancar(l.userId, l.valor, "liberacao_garantia", {
        descricao: "Crédito da compra liberado (garantia encerrada)",
        kiwifyOrderId: l.orderId ?? undefined,
      });
    } catch (e) {
      console.error("[liberacao] falha ao aplicar", l.id, e);
      // devolve a linha pra próxima varredura tentar de novo
      await prisma.creditoLiberacao
        .updateMany({ where: { id: l.id }, data: { aplicado: false } })
        .catch(() => {});
    }
  }
}

/**
 * Reembolso do pedido: cancela o que ainda estava preso (nunca vai entrar).
 * Retorna o total cancelado - conta como "já removido" na hora de debitar.
 */
export async function cancelarLiberacoesDoPedido(orderId: string): Promise<number> {
  const rows = await prisma.creditoLiberacao.findMany({
    where: { orderId, aplicado: false, cancelado: false },
    select: { id: true, valor: true },
  });
  let total = 0;
  for (const r of rows) {
    const claim = await prisma.creditoLiberacao.updateMany({
      where: { id: r.id, aplicado: false, cancelado: false },
      data: { cancelado: true },
    });
    if (claim.count === 1) total += r.valor;
  }
  return total;
}

/**
 * Créditos de compras feitas ANTES do cadastro (mesmo e-mail) - substitui a
 * versão antiga do creditos.ts pra passar pela quarentena. Idempotente.
 */
export async function aplicarCreditosPendentes(userId: string, email: string) {
  const pend = await prisma.creditoPendente.findMany({
    where: { email: email.trim().toLowerCase(), aplicado: false },
  });
  for (const p of pend) {
    if (await existeTransacaoOrder(p.kiwifyOrderId, "compra")) {
      await prisma.creditoPendente.update({
        where: { id: p.id },
        data: { aplicado: true },
      });
      continue;
    }
    await creditarCompraComQuarentena(userId, p.valorCentavos, {
      descricao: p.descricao ?? "Compra de créditos",
      orderId: p.kiwifyOrderId,
    });
    if (p.assinaturaDias > 0) {
      const { estenderAssinatura } = await import("@/lib/creditos");
      await estenderAssinatura(userId, p.assinaturaDias);
    }
    await prisma.creditoPendente.update({
      where: { id: p.id },
      data: { aplicado: true },
    });
  }
}
