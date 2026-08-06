import "server-only";

import { prisma } from "@/lib/prisma";
import { existeTransacaoOrder, lancar } from "@/lib/creditos";
import { JANELA_GARANTIA_DIAS, NIVEIS, nivelValido } from "@/lib/niveis";

/**
 * Quarentena de crédito comprado (antifraude de reembolso).
 *
 * Toda compra de PACOTE passa por aqui: conforme o nível da conta, só uma parte
 * cai no saldo na hora; o resto vira uma CreditoLiberacao que destrava sozinha
 * no 8º dia da compra (garantia da Cakto/Kiwify já expirada). Se o pedido for
 * reembolsado antes, a liberação é cancelada - o crédito preso nunca entrou,
 * então não tem como "gastar tudo e pedir o dinheiro de volta".
 *
 * Regras por nível (ver NIVEIS em niveis.ts):
 * - bronze: até R$20 comprados na janela de 8 dias liberam integral; acima disso
 *   libera 50%; teto de R$50 liberados na janela.
 * - prata: mesma mecânica, teto de R$100.
 * - ouro: 75% na hora de qualquer valor, sem teto.
 *
 * O saldo do usuário SÓ contém crédito liberado - todas as travas de gasto que
 * já existem continuam funcionando sem mudança.
 */

const DIA_MS = 86_400_000;

export type ResultadoCompra = {
  liberadoCentavos: number;
  presoCentavos: number;
  saldoApos: number;
  dividaQuitada: number;
};

/**
 * Credita uma compra de crédito. INTEGRAL, na hora.
 *
 * Até 06/ago/2026 isto passava por uma quarentena: contas novas recebiam só uma
 * parte na hora e o resto no 8º dia, pra travar o golpe de comprar crédito,
 * queimar tudo e pedir reembolso dentro da garantia. Com a entrada do Mercado
 * Pago o modelo mudou: quem paga recebe tudo na hora, sem retenção. Não sobrou
 * nenhum crédito preso na virada (a tabela estava zerada), então ninguém perdeu
 * nada.
 *
 * Os NÍVEIS continuam existindo, mas agora só limitam QUANTIDADE DE VÍDEO por
 * dia e simultâneos. Não seguram mais dinheiro.
 *
 * A assinatura da função e o retorno ficaram como estavam pra não espalhar
 * mudança pelos chamadores; `presoCentavos` agora é sempre 0.
 */
export async function creditarCompra(
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

  // o lancar já abate o saldo devedor de reembolso com qualquer entrada e
  // devolve o saldo final líquido
  const dividaAntes = u.dividaCentavos;
  const saldoApos = await lancar(userId, valor, "compra", {
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

  return { liberadoCentavos: valor, presoCentavos: 0, saldoApos, dividaQuitada };
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
    await creditarCompra(userId, p.valorCentavos, {
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
