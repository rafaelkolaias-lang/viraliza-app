import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { criarLinkApoio, pagamentoConfirmado } from "@/lib/infinitepay";
import { VALOR_MAXIMO, VALOR_MINIMO } from "@/lib/apoios-const";

/**
 * Apoio ao projeto: doação por Pix, sem contrapartida nenhuma.
 *
 * Nada aqui mexe em crédito, plano ou permissão. É de propósito: se desse
 * crédito em troca deixaria de ser doação e viraria venda, com outra regra
 * fiscal e outro texto na tela.
 */

export { VALOR_MINIMO, VALOR_MAXIMO, VALORES_SUGERIDOS } from "@/lib/apoios-const";

export type ApoioItem = {
  id: string;
  valorCentavos: number;
  status: string;
  criadoEm: string;
  pagoEm?: string | null;
  apoiador?: { nome: string; email: string }; // só o admin recebe
};

/** Arredonda e valida o valor que veio da tela. Devolve null se não presta. */
export function normalizarValor(v: unknown): number | null {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  if (n < VALOR_MINIMO || n > VALOR_MAXIMO) return null;
  return n;
}

/**
 * Abre um apoio: grava como "aguardando" e devolve o link de pagamento. Se a
 * InfinitePay não responder, a linha é apagada em vez de ficar de lixo no banco.
 */
export async function abrirApoio(opts: {
  userId: string;
  valorCentavos: number;
  nome?: string | null;
  email?: string | null;
}): Promise<{ url: string } | { erro: string }> {
  const orderNsu = `apoio-${randomUUID()}`;

  const apoio = await prisma.apoio.create({
    data: {
      userId: opts.userId,
      valorCentavos: opts.valorCentavos,
      orderNsu,
    },
    select: { id: true },
  });

  const link = await criarLinkApoio({
    orderNsu,
    valorCentavos: opts.valorCentavos,
    nome: opts.nome,
    email: opts.email,
  });

  if (!link) {
    await prisma.apoio.delete({ where: { id: apoio.id } }).catch(() => {});
    return { erro: "Não consegui abrir o pagamento agora. Tente de novo em instantes." };
  }

  await prisma.apoio
    .update({ where: { id: apoio.id }, data: { linkUrl: link.url } })
    .catch(() => {});

  return { url: link.url };
}

/**
 * Confirma um apoio a partir do aviso do webhook.
 *
 * O webhook da InfinitePay não é assinado, então ele NÃO decide nada: só diz
 * qual pedido olhar. Quem confirma é o payment_check. E o apoio já pago não é
 * mexido de novo, pra reenvio do webhook não duplicar nada.
 */
export async function confirmarApoio(opts: {
  orderNsu: string;
  transactionNsu?: string | null;
  slug?: string | null;
}): Promise<"pago" | "ignorado" | "nao_confirmado"> {
  const apoio = await prisma.apoio.findUnique({
    where: { orderNsu: opts.orderNsu },
    select: { id: true, status: true },
  });
  if (!apoio) return "ignorado"; // pedido que não é nosso
  if (apoio.status === "pago") return "ignorado"; // já contabilizado

  const ok = await pagamentoConfirmado(opts);
  if (!ok) return "nao_confirmado";

  await prisma.apoio.update({
    where: { id: apoio.id },
    data: {
      status: "pago",
      pagoEm: new Date(),
      transactionNsu: opts.transactionNsu || undefined,
      slug: opts.slug || undefined,
    },
  });
  return "pago";
}

/** Os apoios pagos de uma pessoa (o histórico dela). */
export async function meusApoios(userId: string): Promise<ApoioItem[]> {
  const rows = await prisma.apoio.findMany({
    where: { userId, status: "pago" },
    orderBy: { pagoEm: "desc" },
    take: 50,
    select: { id: true, valorCentavos: true, status: true, criadoEm: true, pagoEm: true },
  });
  return rows.map((a) => ({
    ...a,
    criadoEm: a.criadoEm.toISOString(),
    pagoEm: a.pagoEm?.toISOString() ?? null,
  }));
}

/** Todos os apoios pagos, com quem apoiou (admin). */
export async function todosApoios(limite = 200): Promise<ApoioItem[]> {
  const rows = await prisma.apoio.findMany({
    where: { status: "pago" },
    orderBy: { pagoEm: "desc" },
    take: limite,
    select: {
      id: true,
      valorCentavos: true,
      status: true,
      criadoEm: true,
      pagoEm: true,
      user: { select: { nome: true, email: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    valorCentavos: a.valorCentavos,
    status: a.status,
    criadoEm: a.criadoEm.toISOString(),
    pagoEm: a.pagoEm?.toISOString() ?? null,
    apoiador: { nome: a.user.nome, email: a.user.email },
  }));
}
