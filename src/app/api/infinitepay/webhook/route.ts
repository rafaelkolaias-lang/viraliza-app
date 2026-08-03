import { NextResponse } from "next/server";
import { confirmarApoio } from "@/lib/apoios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook da InfinitePay (apoios).
 *
 * ATENÇÃO: este webhook NÃO é assinado. Qualquer um na internet pode mandar um
 * POST aqui dizendo "fulano pagou R$ 500". Por isso ele não decide nada: o
 * único papel dele é dizer QUAL pedido olhar. Quem confirma o dinheiro é o
 * payment_check, chamado dentro de confirmarApoio.
 *
 * Sempre responde 200: webhook que recebe erro entra em fila de reenvio e vira
 * ruído. O que importa fica no log.
 */
export async function POST(req: Request) {
  let body: {
    order_nsu?: string;
    transaction_nsu?: string;
    invoice_slug?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const orderNsu = String(body.order_nsu || "");
  if (!orderNsu) return NextResponse.json({ ok: true });

  try {
    const r = await confirmarApoio({
      orderNsu,
      transactionNsu: body.transaction_nsu,
      slug: body.invoice_slug,
    });
    if (r === "pago") console.log("[infinitepay] apoio confirmado", orderNsu);
    if (r === "nao_confirmado") {
      // aviso chegou mas a InfinitePay não confirmou: ou é forjado, ou o
      // pagamento ainda não liquidou. Fica "aguardando" e o reenvio resolve.
      console.warn("[infinitepay] aviso sem confirmação no payment_check", orderNsu);
    }
  } catch (e) {
    console.error("[infinitepay] erro ao processar webhook", orderNsu, e);
  }

  return NextResponse.json({ ok: true });
}
