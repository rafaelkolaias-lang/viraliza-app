import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assinaturaWebhookValida,
  buscarAssinatura,
  buscarPagamento,
  mercadoPagoConfigurado,
} from "@/lib/mercadopago";
import { ativarAssinaturaMP, processarPagamentoMP } from "@/lib/mercadopago-processa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago. A notificação só AVISA ("recurso X mudou"); a
 * verdade vem de buscar o recurso na API antes de qualquer efeito - webhook
 * forjado não credita nada. Todo o processamento mora em mercadopago-processa
 * (compartilhado com a consulta de status da tela) e é idempotente.
 *
 * Responde 200 rápido (o MP espera até 22s e reenvia a cada 15min sem
 * confirmação); 500 só em erro transitório, pra ele reenviar depois.
 */
export async function POST(req: Request) {
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ ok: false, erro: "MP não configurado" }, { status: 503 });
  }

  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const tipo = url.searchParams.get("type") || url.searchParams.get("topic") || "";

  // corpo é redundante com a query, mas cobre o caso de vir só nele
  let body: { type?: string; data?: { id?: string | number } } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // sem JSON válido: segue com o que veio na query
  }
  const recursoId = String(dataId ?? body.data?.id ?? "");
  const tipoFinal = (tipo || body.type || "").toLowerCase();

  // assinatura HMAC do MP (quando o secret está configurado, exige que bata)
  if (
    !assinaturaWebhookValida({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
    })
  ) {
    return NextResponse.json({ ok: true, ignorado: "assinatura inválida" });
  }

  // ---- ASSINATURA vinculada/cancelada (topic subscription_preapproval) ----
  // Só liga o acesso; crédito e extensão vêm da cobrança (topic payment).
  if (tipoFinal.includes("subscription_preapproval") && !tipoFinal.includes("plan")) {
    if (!recursoId) return NextResponse.json({ ok: true, ignorado: "sem id" });
    let ass;
    try {
      ass = await buscarAssinatura(recursoId);
    } catch (e) {
      console.error("[mp] falha ao verificar assinatura", recursoId, e);
      return NextResponse.json({ ok: false, erro: "erro ao verificar" }, { status: 500 });
    }
    if (!ass) return NextResponse.json({ ok: true, ignorado: "assinatura não encontrada" });
    const user =
      (ass.userId ? await prisma.user.findUnique({ where: { id: ass.userId } }) : null) ??
      (ass.email ? await prisma.user.findUnique({ where: { email: ass.email } }) : null);
    if (!user) return NextResponse.json({ ok: true, ignorado: "sem usuário" });
    if (ass.status === "authorized") {
      await ativarAssinaturaMP(user.id);
      return NextResponse.json({ ok: true, assinaturaAtiva: true, userId: user.id });
    }
    // cancelada/pausada: NÃO derruba na hora; vale até o fim do mês já pago
    return NextResponse.json({ ok: true, statusAssinatura: ass.status });
  }

  // faturas da recorrência chegam também como subscription_authorized_payment;
  // o crédito sai pelo topic payment, então aqui é só confirmar o recebimento
  if (tipoFinal.includes("subscription_authorized_payment")) {
    return NextResponse.json({ ok: true, ignorado: "fatura (credita via payment)" });
  }

  // merchant_order e afins: confirma e ignora
  if (!tipoFinal.includes("payment") || !recursoId) {
    return NextResponse.json({ ok: true, ignorado: `tipo ${tipoFinal || "?"}` });
  }

  // FONTE DA VERDADE: o pagamento na API do MP.
  let p;
  try {
    p = await buscarPagamento(recursoId);
  } catch (e) {
    console.error("[mp] falha ao verificar pagamento", recursoId, e);
    return NextResponse.json({ ok: false, erro: "erro ao verificar" }, { status: 500 });
  }
  if (!p) return NextResponse.json({ ok: true, ignorado: "pagamento não encontrado" });

  try {
    const r = await processarPagamentoMP(p);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[mp] falha ao processar pagamento", recursoId, e);
    return NextResponse.json({ ok: false, erro: "erro ao processar" }, { status: 500 });
  }
}
