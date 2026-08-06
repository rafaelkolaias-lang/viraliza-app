import "server-only";

import { prisma } from "@/lib/prisma";
import { debitarClamp, existeTransacaoOrder, lancar } from "@/lib/creditos";
import { reembolsarPagamento } from "@/lib/mercadopago";

/**
 * Reembolso que o próprio cliente pede, sem passar pelo suporte.
 *
 * POR QUE NÃO É SEMPRE 100%: o produto é crédito de IA, e cada crédito gasto já
 * virou custo pago pra OpenAI, ElevenLabs e afins. Devolver o valor cheio de
 * quem já consumiu faria a plataforma bancar a conta da IA de graça. Então
 * devolve-se o que sobrou, com um redutor pra quem quase esgotou o pacote.
 *
 * A RÉGUA (definida com o dono em 06/ago/2026):
 *   não usou nada          -> 100% do valor
 *   usou até 80%           -> proporcional ao que sobrou
 *   usou mais de 80%       -> proporcional ao que sobrou, MENOS 30%
 *
 * Só vale pra PACOTE DE CRÉDITO comprado pelo Mercado Pago, dentro de 7 dias.
 * Assinatura não entra: pra sair dela a pessoa cancela a renovação e usa até o
 * fim do mês que já pagou.
 */

export const JANELA_REEMBOLSO_DIAS = 7;
const USO_ALTO = 0.8; // acima disso entra o redutor
const REDUTOR = 0.3; // 30% a menos do que seria devolvido
const DIA_MS = 86_400_000;

export type CompraReembolsavel = {
  orderId: string; // "mp-<paymentId>"
  paymentId: string;
  descricao: string;
  compradoEm: Date;
  creditosComprados: number;
  /** quantos daquele pacote ainda estão no saldo */
  creditosNaoUsados: number;
  /** 0 a 1 */
  fracaoUsada: number;
  /** o que a pessoa recebe de volta, em centavos */
  devolveCentavos: number;
  /** true = entrou o redutor de 30% (usou mais de 80%) */
  comRedutor: boolean;
  diasRestantes: number;
};

/**
 * Quanto devolver por uma compra.
 *
 * O saldo é um número só (crédito não tem "etiqueta" de qual compra veio),
 * então usamos a regra do mais antigo sai primeiro: o que sobrou daquela compra
 * é `min(saldo atual, créditos daquela compra)`. Na prática é a conta justa,
 * porque quem gasta consome primeiro o que já tinha.
 */
export function calcularDevolucao(creditosComprados: number, saldoAtual: number) {
  const naoUsados = Math.max(0, Math.min(saldoAtual, creditosComprados));
  const usados = creditosComprados - naoUsados;
  const fracaoUsada = creditosComprados > 0 ? usados / creditosComprados : 0;

  // 1 crédito = 1 centavo, então o valor devolvido é o próprio nº de créditos
  let devolve = naoUsados;
  const comRedutor = fracaoUsada > USO_ALTO;
  if (comRedutor) devolve = Math.floor(devolve * (1 - REDUTOR));

  return { naoUsados, usados, fracaoUsada, devolveCentavos: devolve, comRedutor };
}

/** Compras que ainda dá pra reembolsar (Mercado Pago, dentro da janela). */
export async function comprasReembolsaveis(userId: string): Promise<CompraReembolsavel[]> {
  const desde = new Date(Date.now() - JANELA_REEMBOLSO_DIAS * DIA_MS);
  const [compras, conta] = await Promise.all([
    prisma.creditoTransacao.findMany({
      where: {
        userId,
        tipo: "compra",
        valor: { gt: 0 },
        criadoEm: { gte: desde },
        // só as do Mercado Pago: reembolso de compra antiga é pela Cakto
        kiwifyOrderId: { startsWith: "mp-" },
      },
      orderBy: { criadoEm: "desc" },
      select: { valor: true, criadoEm: true, descricao: true, kiwifyOrderId: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { saldoCentavos: true } }),
  ]);

  const saldo = conta?.saldoCentavos ?? 0;
  const out: CompraReembolsavel[] = [];

  for (const c of compras) {
    const orderId = c.kiwifyOrderId;
    if (!orderId) continue;
    // já reembolsada? (o estorno grava com o mesmo orderId)
    if (await existeTransacaoOrder(orderId, "estorno")) continue;

    const calc = calcularDevolucao(c.valor, saldo);
    const diasRestantes = Math.max(
      0,
      Math.ceil((c.criadoEm.getTime() + JANELA_REEMBOLSO_DIAS * DIA_MS - Date.now()) / DIA_MS),
    );
    out.push({
      orderId,
      paymentId: orderId.replace(/^mp-/, ""),
      descricao: c.descricao ?? "Pacote de créditos",
      compradoEm: c.criadoEm,
      creditosComprados: c.valor,
      creditosNaoUsados: calc.naoUsados,
      fracaoUsada: calc.fracaoUsada,
      devolveCentavos: calc.devolveCentavos,
      comRedutor: calc.comRedutor,
      diasRestantes,
    });
  }
  return out;
}

export type ResultadoReembolso =
  | { ok: true; devolvidoCentavos: number; creditosRemovidos: number }
  | { ok: false; erro: string };

/**
 * Executa o reembolso: manda o dinheiro de volta pelo Mercado Pago e tira os
 * créditos correspondentes do saldo.
 *
 * A ORDEM IMPORTA. O dinheiro vai primeiro: se o MP recusar (sem saldo na
 * conta, prazo vencido), ninguém perde crédito à toa. Se o débito falhasse
 * depois de devolver, a pessoa ficaria com dinheiro e crédito, então o débito
 * usa `debitarClamp`, que nunca deixa o saldo negativo e não lança exceção.
 */
export async function pedirReembolso(
  userId: string,
  orderId: string,
): Promise<ResultadoReembolso> {
  const elegiveis = await comprasReembolsaveis(userId);
  const compra = elegiveis.find((c) => c.orderId === orderId);
  if (!compra) {
    return { ok: false, erro: "Essa compra não está mais na janela de reembolso." };
  }
  if (compra.devolveCentavos <= 0) {
    return {
      ok: false,
      erro: "Você já usou os créditos dessa compra, então não há valor a devolver.",
    };
  }

  // marcador ANTES de chamar o MP: dois cliques rápidos não devolvem duas vezes
  if (await existeTransacaoOrder(orderId, "estorno")) {
    return { ok: false, erro: "Esse reembolso já foi processado." };
  }

  const r = await reembolsarPagamento(compra.paymentId, compra.devolveCentavos / 100);
  if (!r.ok) {
    return {
      ok: false,
      erro: "O Mercado Pago não conseguiu processar agora. Fale com a gente no chat.",
    };
  }

  // tira do saldo só o que foi pago de volta em crédito (o não usado)
  const removidos = await debitarClamp(userId, compra.creditosNaoUsados, "estorno", {
    descricao: `Reembolso pedido por você: ${compra.descricao}`,
    kiwifyOrderId: orderId,
  });
  if (removidos === 0) {
    // deixa o marcador de idempotência mesmo sem saldo a debitar
    await lancar(userId, 0, "estorno", {
      descricao: `Reembolso pedido por você: ${compra.descricao}`,
      kiwifyOrderId: orderId,
    });
  }

  console.log(
    `[reembolso] ${userId} pediu de volta ${compra.devolveCentavos} centavos do pedido ${orderId}`,
  );
  return {
    ok: true,
    devolvidoCentavos: compra.devolveCentavos,
    creditosRemovidos: removidos,
  };
}
