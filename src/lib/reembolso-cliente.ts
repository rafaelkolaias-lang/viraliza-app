import "server-only";

import { prisma } from "@/lib/prisma";
import { debitarClamp, existeTransacaoOrder, lancar } from "@/lib/creditos";
import {
  buscarPagamento,
  cancelarAssinatura,
  reembolsarPagamento,
} from "@/lib/mercadopago";

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
 * VALE PRA PACOTE E PRA ASSINATURA, ambos pelo Mercado Pago e dentro de 7 dias.
 * A assinatura entra porque compra online tem direito de arrependimento (CDC
 * art. 49) e isso não se contrata contra; negar empurra a pessoa pra disputa no
 * cartão, que custa o valor MAIS a taxa de chargeback. Passados os 7 dias a
 * assinatura só se cancela, e o mês já pago vale até o fim.
 *
 * PACOTE E ASSINATURA CONTAM DIFERENTE. No pacote, 1 crédito = 1 centavo pago,
 * então o que sobrou de crédito já É o valor a devolver. Na assinatura não:
 * R$ 98,90 dão 4.000 créditos, então a fração não usada é medida em crédito e
 * aplicada sobre o DINHEIRO. Sem isso, quem não usou nada receberia R$ 40 de
 * volta em vez dos R$ 98,90 que pagou.
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
  /** true = é a assinatura mensal (reembolsar também encerra o acesso) */
  ehAssinatura: boolean;
  /** quanto foi pago de verdade, em centavos */
  pagoCentavos: number;
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
        // "compra" = pacote de crédito; "bonus_assinatura" com pedido = a
        // mensalidade paga (a de valor 0 é marcador de oferta antiga e cai fora)
        tipo: { in: ["compra", "bonus_assinatura"] },
        valor: { gt: 0 },
        criadoEm: { gte: desde },
        // só as do Mercado Pago: reembolso de compra antiga é pela Cakto
        kiwifyOrderId: { startsWith: "mp-" },
      },
      orderBy: { criadoEm: "desc" },
      select: { tipo: true, valor: true, criadoEm: true, descricao: true, kiwifyOrderId: true },
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

    const ehAssinatura = c.tipo === "bonus_assinatura";
    const paymentId = orderId.replace(/^mp-/, "");
    const calc = calcularDevolucao(c.valor, saldo);

    // Quanto entrou de dinheiro. No pacote é o próprio número de créditos; na
    // assinatura tem que vir do Mercado Pago, porque crédito e preço não são a
    // mesma escala. Se a consulta falhar, a linha some da lista em vez de
    // oferecer um valor chutado.
    let pagoCentavos = c.valor;
    if (ehAssinatura) {
      try {
        const pag = await buscarPagamento(paymentId);
        if (!pag || pag.valorCentavos <= 0) continue;
        pagoCentavos = pag.valorCentavos;
      } catch {
        continue;
      }
    }

    // a fração não usada é medida em CRÉDITO e aplicada sobre o dinheiro pago
    const devolveCentavos = ehAssinatura
      ? Math.floor(pagoCentavos * (calc.devolveCentavos / Math.max(1, c.valor)))
      : calc.devolveCentavos;

    const diasRestantes = Math.max(
      0,
      Math.ceil((c.criadoEm.getTime() + JANELA_REEMBOLSO_DIAS * DIA_MS - Date.now()) / DIA_MS),
    );
    out.push({
      orderId,
      paymentId,
      descricao: c.descricao ?? (ehAssinatura ? "Assinatura Viraliza" : "Pacote de créditos"),
      compradoEm: c.criadoEm,
      creditosComprados: c.valor,
      creditosNaoUsados: calc.naoUsados,
      fracaoUsada: calc.fracaoUsada,
      devolveCentavos,
      comRedutor: calc.comRedutor,
      diasRestantes,
      ehAssinatura,
      pagoCentavos,
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

  // Assinatura devolvida = a pessoa desistiu do serviço: encerra o acesso e
  // desliga a cobrança. Sem cancelar no MP ela receberia o dinheiro de volta e
  // seria cobrada de novo no mês seguinte, que é o pior desfecho possível.
  if (compra.ehAssinatura) {
    const conta = await prisma.user.findUnique({
      where: { id: userId },
      select: { mpAssinaturaId: true },
    });
    if (conta?.mpAssinaturaId) {
      try {
        await cancelarAssinatura(conta.mpAssinaturaId);
      } catch (e) {
        // o dinheiro já voltou; a recorrência a gente derruba no suporte
        console.error("[reembolso] falha ao cancelar assinatura no MP", userId, e);
      }
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        assinante: false,
        assinaturaAte: null,
        mpAssinaturaId: null,
        assinaturaPix: false,
        mpAssinaturaCanceladaEm: new Date(),
      },
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
