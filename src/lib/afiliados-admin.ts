import "server-only";
import { prisma } from "@/lib/prisma";
import { listarPedidos, type PedidoLista } from "@/lib/cakto";
import { existeTransacaoOrder, lancar } from "@/lib/creditos";

/**
 * Visão do admin sobre o Indique e Ganhe.
 *
 * Junta três coisas que moram em lugares diferentes:
 *  - a VENDA e a comissão, que vivem na Cakto;
 *  - o CADASTRO do comprador, que vive no nosso banco (só conta indicação que
 *    virou gente usando a plataforma);
 *  - o BÔNUS em créditos pro afiliado, que o admin solta na mão.
 *
 * O bônus é idempotente: guarda o refId da venda no campo de pedido da
 * transação, então clicar duas vezes não credita duas.
 */

/** quanto o afiliado ganha de crédito quando a indicação vira cadastro */
export const BONUS_INDICACAO_CENTAVOS = 1000;

export type IndicacaoAdmin = {
  refId: string;
  quando: string;
  status: string;
  /** quem indicou */
  afiliadoEmail: string;
  afiliadoUserId: string | null;
  afiliadoNome: string | null;
  comissaoCentavos: number;
  /** quem comprou */
  compradorEmail: string;
  compradorNome: string;
  /** o comprador chegou a criar conta aqui? */
  cadastrou: boolean;
  /** o bônus em créditos já foi solto pra essa venda? */
  bonificado: boolean;
};

function ehIndicacao(tipo: string) {
  return !!tipo && tipo !== "producer";
}

/** chave de idempotência do bônus (reaproveita o campo de pedido da transação) */
export function chaveBonus(refId: string) {
  return `indicacao-${refId}`;
}

export async function indicacoesParaAdmin(dias = 90): Promise<IndicacaoAdmin[]> {
  const fim = new Date(Date.now() + 60_000).toISOString();
  const ini = new Date(Date.now() - dias * 86_400_000).toISOString();

  let pedidos: PedidoLista[];
  try {
    pedidos = await listarPedidos(ini, fim);
  } catch {
    return [];
  }

  const brutas: {
    p: PedidoLista;
    afiliadoEmail: string;
    comissaoCentavos: number;
  }[] = [];
  for (const p of pedidos) {
    for (const c of p.comissoes ?? []) {
      if (!ehIndicacao(c.tipo)) continue;
      const dono = (p.comissionados ?? []).find((u) => String(u.id ?? "") === (c.userId ?? ""));
      const email = (dono?.email ?? "").trim().toLowerCase();
      if (!email) continue;
      brutas.push({ p, afiliadoEmail: email, comissaoCentavos: c.valorCentavos });
    }
  }
  if (!brutas.length) return [];

  // uma consulta só pros dois lados: quem indicou e quem comprou
  const emails = [
    ...new Set(
      brutas.flatMap((b) => [b.afiliadoEmail, (b.p.customer?.email ?? "").trim().toLowerCase()]),
    ),
  ].filter(Boolean);
  const usuarios = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, nome: true },
  });
  const porEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), u]));

  const bonus = await prisma.creditoTransacao.findMany({
    where: {
      tipo: "ajuste_admin",
      kiwifyOrderId: { in: brutas.map((b) => chaveBonus(b.p.refId ?? b.p.id)) },
    },
    select: { kiwifyOrderId: true },
  });
  const jaBonificado = new Set(bonus.map((b) => b.kiwifyOrderId));

  const lista = brutas.map((b) => {
    const refId = b.p.refId ?? b.p.id;
    const compradorEmail = (b.p.customer?.email ?? "").trim().toLowerCase();
    const afiliado = porEmail.get(b.afiliadoEmail) ?? null;
    return {
      refId,
      quando: b.p.created_at ?? "",
      status: b.p.status,
      afiliadoEmail: b.afiliadoEmail,
      afiliadoUserId: afiliado?.id ?? null,
      afiliadoNome: afiliado?.nome ?? null,
      comissaoCentavos: b.comissaoCentavos,
      compradorEmail,
      compradorNome: b.p.customer?.name ?? b.p.customer?.full_name ?? "",
      cadastrou: porEmail.has(compradorEmail),
      bonificado: jaBonificado.has(chaveBonus(refId)),
    };
  });

  lista.sort((a, b) => (a.quando < b.quando ? 1 : -1));
  return lista;
}

/** Solta o bônus em créditos pro afiliado de UMA venda. */
export async function bonificarIndicacao(
  refId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const todas = await indicacoesParaAdmin(180);
  const i = todas.find((x) => x.refId === refId);
  if (!i) return { ok: false, erro: "Indicação não encontrada." };
  if (i.status !== "paid") return { ok: false, erro: "Essa venda não está paga." };
  if (!i.cadastrou) {
    return { ok: false, erro: "O indicado ainda não criou conta na plataforma." };
  }
  if (!i.afiliadoUserId) {
    return { ok: false, erro: `O afiliado (${i.afiliadoEmail}) não tem conta aqui.` };
  }
  const chave = chaveBonus(refId);
  if (await existeTransacaoOrder(chave, "ajuste_admin")) {
    return { ok: false, erro: "Essa indicação já foi bonificada." };
  }
  await lancar(i.afiliadoUserId, BONUS_INDICACAO_CENTAVOS, "ajuste_admin", {
    descricao: `Bônus de indicação (${i.compradorEmail})`,
    kiwifyOrderId: chave,
  });
  return { ok: true };
}
