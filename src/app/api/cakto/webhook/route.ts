import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buscarPedido,
  caktoConfigurada,
  creditosDoPacote,
  eventoDoPayload,
  orderIdDoPayload,
  pedidoEstaPago,
  pedidoEstornado,
  webhookSecretValido,
} from "@/lib/cakto";
import { existeTransacaoOrder, lancar } from "@/lib/creditos";
import { enviarCompraMeta, enviarReembolsoMeta } from "@/lib/meta-capi";
import { aplicarReembolsoAceito, restaurarSuspensao } from "@/lib/reembolsos";
import { enviarBoasVindas, enviarCreditosConfirmados } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook da Cakto. MESMA lógica da Kiwify: só os PACOTES DE CRÉDITO
 * ("Editor automatico N") creditam; o plano de entrada (R$ 19,90) e outros
 * produtos só liberam o cadastro. O acesso vem do cadastro, que já dá 1.000
 * créditos de boas-vindas.
 *
 * Segurança: a Cakto manda um "secret" no corpo (validado quando configurado),
 * mas a garantia real é confirmar o pedido NA API da Cakto (valor + status reais)
 * antes de creditar - um webhook forjado não passa. Idempotente por pedido.
 * Sempre responde 200 (senão a Cakto reenvia pra sempre), menos em erro
 * transitório (500 = reenvia). Precisa responder em até 5s.
 */
export async function POST(req: Request) {
  if (!caktoConfigurada()) {
    return NextResponse.json({ ok: false, erro: "Cakto não configurada" }, { status: 503 });
  }

  const raw = await req.text();
  let body: unknown = {};
  try {
    body = JSON.parse(raw);
  } catch {
    // alguns eventos podem vir sem JSON válido; segue e tenta extrair o id
  }

  // Se o secret do webhook estiver configurado, exige que bata (camada extra).
  if (!webhookSecretValido(body)) {
    return NextResponse.json({ ok: true, ignorado: "secret inválido" });
  }

  const evento = eventoDoPayload(body);
  const orderId = orderIdDoPayload(body);
  if (!orderId) return NextResponse.json({ ok: true, ignorado: "sem id do pedido" });

  // FONTE DA VERDADE: confirma o pedido direto na Cakto (à prova de forja).
  let pedido;
  try {
    pedido = await buscarPedido(orderId);
  } catch (e) {
    // erro transitório na API da Cakto: 500 faz a Cakto reenviar depois
    console.error("[cakto] falha ao verificar pedido", orderId, evento, e);
    return NextResponse.json({ ok: false, erro: "erro ao verificar pedido" }, { status: 500 });
  }
  if (!pedido) return NextResponse.json({ ok: true, ignorado: "pedido não encontrado" });

  const email = (pedido.customer?.email || "").trim().toLowerCase();

  // ---- REEMBOLSO / CHARGEBACK -> aplica a perda (entrada: brinde+assinatura;
  // pacote: só os créditos dele; chargeback: bloqueia login). Idempotente. ----
  if (pedidoEstornado(pedido)) {
    const r = await aplicarReembolsoAceito(pedido, orderId);
    await enviarReembolsoMeta({
      orderId,
      email,
      telefone: pedido.customer?.mobile,
      nome: pedido.customer?.full_name,
      // valor LÍQUIDO (o que você recebe, ex. R$22,41), não o bruto que o cliente pagou
      valorCentavos: pedido.net_amount ?? pedido.payment?.charge_amount ?? 0,
      produto: pedido.product?.name,
    });
    return NextResponse.json({ ok: true, reembolso: r });
  }

  // QUALQUER compra aprovada (entrada R$19,90, pacote, etc.) libera o cadastro desse
  // e-mail (allowlist anti-farm). É isto que deixa a pessoa se cadastrar com o mesmo
  // e-mail da compra. Independe de creditar ou não.
  if (pedidoEstaPago(pedido) && email) {
    // 1ª vez que vemos este e-mail pagar? (define se manda o e-mail de boas-vindas)
    const jaTinhaAcesso = await prisma.acessoPago.findUnique({ where: { email } });
    await prisma.acessoPago.upsert({
      where: { email },
      create: { email, kiwifyOrderId: orderId, produto: pedido.product?.name ?? null },
      update: {},
    });
    // se havia reembolso solicitado e o pedido voltou a "pago", devolve o congelado
    await restaurarSuspensao(orderId);
    // primeira compra deste e-mail -> e-mail de boas-vindas (onboarding).
    // Nunca quebra o webhook: erro só loga.
    if (!jaTinhaAcesso) {
      try {
        await enviarBoasVindas({
          para: email,
          nome: pedido.customer?.full_name,
          produto: pedido.product?.name,
        });
      } catch (e) {
        console.error("[cakto] falha ao enviar boas-vindas", orderId, e);
      }
    }
  }

  // Atribuição Meta Ads: compra confirmada -> evento Purchase via CAPI. Nunca
  // quebra o fluxo: erro só loga. Reenvios do webhook não duplicam (event_id = orderId).
  if (pedidoEstaPago(pedido)) {
    await enviarCompraMeta({
      orderId,
      email,
      telefone: pedido.customer?.mobile,
      nome: pedido.customer?.full_name,
      // valor LÍQUIDO (o que você recebe, ex. R$22,41), não o bruto que o cliente pagou
      valorCentavos: pedido.net_amount ?? pedido.payment?.charge_amount ?? 0,
      produto: pedido.product?.name,
    });
  }

  const creditos = creditosDoPacote(pedido);
  // não é pacote de crédito (plano de entrada R$19,90, etc.) -> só liberou o acesso
  if (creditos <= 0) {
    return NextResponse.json({ ok: true, ignorado: "não é pacote (acesso liberado)" });
  }

  const desc = `Compra Cakto: ${pedido.product?.name || "créditos"}`;

  // ---- PAGAMENTO APROVADO -> credita ----
  if (pedidoEstaPago(pedido)) {
    if (await existeTransacaoOrder(orderId, "compra")) {
      return NextResponse.json({ ok: true, jaProcessado: true });
    }
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

    if (user) {
      const saldoApos = await lancar(user.id, creditos, "compra", {
        descricao: desc,
        kiwifyOrderId: orderId,
      });
      // cliente que JÁ tem conta comprou pacote -> e-mail de créditos (toda compra).
      // Idempotente por pedido: o guard existeTransacaoOrder acima não deixa reenviar.
      try {
        await enviarCreditosConfirmados({
          para: email,
          nome: pedido.customer?.full_name,
          creditos,
          saldoApos,
          produto: pedido.product?.name,
        });
      } catch (e) {
        console.error("[cakto] falha ao enviar e-mail de créditos", orderId, e);
      }
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

  return NextResponse.json({ ok: true, ignorado: `status ${pedido.status}` });
}
