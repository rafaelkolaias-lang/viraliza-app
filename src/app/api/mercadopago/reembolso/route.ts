import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { mercadoPagoConfigurado } from "@/lib/mercadopago";
import { comprasReembolsaveis, pedirReembolso } from "@/lib/reembolso-cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista as compras que ainda dá pra reembolsar (com o valor já calculado). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mercadoPagoConfigurado()) return NextResponse.json({ ok: true, compras: [] });

  const compras = await comprasReembolsaveis(user.id);
  return NextResponse.json({ ok: true, compras });
}

/** Executa o reembolso de UMA compra, pedido pelo próprio cliente. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Indisponível no momento." }, { status: 503 });
  }

  let orderId = "";
  try {
    const body = (await req.json()) as { orderId?: string };
    orderId = String(body.orderId ?? "");
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!orderId.startsWith("mp-")) {
    return NextResponse.json({ erro: "Compra inválida." }, { status: 400 });
  }

  try {
    const r = await pedirReembolso(user.id, orderId);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 409 });
    return NextResponse.json(r);
  } catch (e) {
    console.error("[reembolso] falha", user.id, orderId, e);
    return NextResponse.json(
      { erro: "Não consegui processar agora. Fale com a gente no chat." },
      { status: 502 },
    );
  }
}
