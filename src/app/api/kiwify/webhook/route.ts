import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buscarVenda,
  creditosDoPacote,
  kiwifyConfigurada,
  orderIdDoPayload,
  vendaEstaPaga,
  vendaEstornada,
} from "@/lib/kiwify";
import { debitarClamp, existeTransacaoOrder, lancar } from "@/lib/creditos";
import { enviarCompraMeta } from "@/lib/meta-capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook da Kiwify. Só os PACOTES DE CRÉDITO ("Editor automatico N") creditam;
 * o plano de entrada (R$ 19,90) e outros produtos são ignorados (o acesso vem do
 * cadastro, que já dá 1.000 créditos de boas-vindas).
 *
 * A gente confirma o pedido NA API da Kiwify (valor + status reais) antes de
 * creditar - ninguém forja crédito. Idempotente por pedido. Sempre responde 200
 * (senão a Kiwify reenvia pra sempre), menos em erro transitório (500 = reenvia).
 */
export async function POST(req: Request) {
  if (!kiwifyConfigurada()) {
    return NextResponse.json({ erro: "Kiwify não configurada" }, { status: 503 });
  }

  // Segurança: NÃO confiamos na assinatura do webhook (algoritmo varia). A garantia
  // é confirmar o pedido na API da Kiwify abaixo - só credita se o pedido existir,
  // estiver pago e for da SUA conta. Um webhook forjado não passa por essa checagem.
  const raw = await req.text();

  let body: unknown = {};
  try {
    body = JSON.parse(raw);
  } catch {
    // alguns eventos podem vir sem JSON válido; segue e tenta extrair o id
  }
  const orderId = orderIdDoPayload(body);
  if (!orderId) return NextResponse.json({ ok: true, ignorado: "sem order_id" });

  // FONTE DA VERDADE: confirma o pedido direto na Kiwify (à prova de forja).
  let sale;
  try {
    sale = await buscarVenda(orderId);
  } catch (e) {
    // erro transitório na API da Kiwify: 500 faz a Kiwify reenviar depois
    console.error("[kiwify] falha ao verificar pedido", orderId, e);
    return NextResponse.json({ erro: "erro ao verificar pedido" }, { status: 500 });
  }
  if (!sale) return NextResponse.json({ ok: true, ignorado: "pedido não encontrado" });

  const email = (sale.customer?.email || "").trim().toLowerCase();

  // QUALQUER compra aprovada (entrada R$19,90, pacote, etc.) libera o cadastro desse
  // e-mail (allowlist anti-farm). Independe de creditar ou não.
  if (vendaEstaPaga(sale) && email) {
    await prisma.acessoPago.upsert({
      where: { email },
      create: { email, kiwifyOrderId: orderId, produto: sale.product?.name ?? null },
      update: {},
    });
  }

  // Atribuição Meta Ads: compra confirmada -> evento Purchase via CAPI (dados
  // hasheados; a Meta liga a venda à campanha). Nunca quebra o fluxo: erro só loga.
  // Reenvios do webhook não duplicam (event_id = orderId).
  if (vendaEstaPaga(sale)) {
    await enviarCompraMeta({
      orderId,
      email,
      telefone: sale.customer?.mobile,
      nome: sale.customer?.full_name,
      valorCentavos: sale.payment?.charge_amount ?? sale.net_amount ?? 0,
      produto: sale.product?.name,
    });
  }

  const creditos = creditosDoPacote(sale);
  // não é pacote de crédito (plano de entrada R$19,90, Copa 2026, etc.) -> só liberou o acesso
  if (creditos <= 0) {
    return NextResponse.json({ ok: true, ignorado: "não é pacote (acesso liberado)" });
  }

  const desc = `Compra Kiwify: ${sale.product?.name || "créditos"}`;

  // ---- PAGAMENTO APROVADO -> credita ----
  if (vendaEstaPaga(sale)) {
    if (await existeTransacaoOrder(orderId, "compra")) {
      return NextResponse.json({ ok: true, jaProcessado: true });
    }
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

    if (user) {
      await lancar(user.id, creditos, "compra", { descricao: desc, kiwifyOrderId: orderId });
      return NextResponse.json({ ok: true, creditado: creditos, userId: user.id });
    }
    // comprou o pacote antes de ter conta: guarda pra aplicar no cadastro (mesmo e-mail)
    if (email) {
      await prisma.creditoPendente.upsert({
        where: { kiwifyOrderId: orderId },
        create: {
          email,
          valorCentavos: creditos,
          kiwifyOrderId: orderId,
          assinaturaDias: 0, // acesso vem do cadastro; nada de assinatura aqui
          descricao: desc,
        },
        update: {},
      });
      return NextResponse.json({ ok: true, pendente: true, email });
    }
    return NextResponse.json({ ok: true, ignorado: "sem e-mail do cliente" });
  }

  // ---- REEMBOLSO / CHARGEBACK -> estorna os créditos daquele pacote ----
  if (vendaEstornada(sale)) {
    if (await existeTransacaoOrder(orderId, "estorno")) {
      return NextResponse.json({ ok: true, jaEstornado: true });
    }
    const compra = await prisma.creditoTransacao.findFirst({
      where: { kiwifyOrderId: orderId, tipo: "compra" },
    });
    if (compra) {
      await debitarClamp(compra.userId, compra.valor, "estorno", {
        descricao: "Estorno de compra Kiwify (reembolso/chargeback)",
        kiwifyOrderId: orderId,
      });
      return NextResponse.json({ ok: true, estornado: true });
    }
    // ainda estava pendente (nunca aplicado): invalida o pendente
    await prisma.creditoPendente.updateMany({
      where: { kiwifyOrderId: orderId, aplicado: false },
      data: { aplicado: true, descricao: "cancelado por estorno" },
    });
    return NextResponse.json({ ok: true, pendenteCancelado: true });
  }

  return NextResponse.json({ ok: true, ignorado: `status ${sale.status}` });
}
