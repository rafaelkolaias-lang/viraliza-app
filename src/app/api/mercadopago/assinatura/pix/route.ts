import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { criarAssinaturaPix, mercadoPagoConfigurado } from "@/lib/mercadopago";
import { cpfValido } from "@/lib/cpf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALOR_REAIS = parseFloat(process.env.MP_ASSINATURA_REAIS || "98.90");

/**
 * Renovação da assinatura no Pix, pra quem já tem conta (é o outro caminho que o
 * e-mail de "faltam 3 dias" oferece, junto do cartão).
 *
 * Paga UM mês: o Pix não recorre, então a próxima renovação também é na mão. Quem
 * não quiser lembrar disso usa o cartão, que renova sozinho.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Pagamento indisponível no momento." }, { status: 503 });
  }

  let cpf = "";
  try {
    const body = (await req.json()) as { cpf?: string };
    cpf = String(body.cpf ?? "");
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (!cpfValido(cpf)) return NextResponse.json({ erro: "CPF inválido." }, { status: 400 });

  try {
    const p = await criarAssinaturaPix({
      userId: user.id,
      email: user.email,
      // o Pix exige nome e sobrenome do pagador; conta sem sobrenome ganha um
      // genérico em vez de ser barrada pelo Mercado Pago
      nome: user.nome?.trim() || "Cliente Viraliza",
      cpf,
      valorReais: VALOR_REAIS,
    });
    return NextResponse.json({
      ok: true,
      paymentId: p.paymentId,
      status: p.status,
      qrCode: p.qrCode,
      qrCodeBase64: p.qrCodeBase64,
    });
  } catch (e) {
    console.error("[mp] falha no Pix da renovação", user.id, e);
    return NextResponse.json(
      { erro: "Não consegui gerar o Pix. Tente de novo em instantes." },
      { status: 502 },
    );
  }
}
