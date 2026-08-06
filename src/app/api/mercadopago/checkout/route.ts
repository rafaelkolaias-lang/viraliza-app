import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { criarCheckoutCreditos, mercadoPagoConfigurado } from "@/lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cria o checkout do Mercado Pago pro pacote de créditos escolhido e devolve o
 * link (init_point). Só valores da tabela: o preço NUNCA vem do cliente.
 */
const VALORES_PERMITIDOS = new Set([20, 50, 100]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Pagamento indisponível no momento." }, { status: 503 });
  }

  let valor = 0;
  try {
    const body = (await req.json()) as { valor?: number };
    valor = Number(body.valor);
  } catch {
    // body inválido cai na validação abaixo
  }
  if (!VALORES_PERMITIDOS.has(valor)) {
    return NextResponse.json({ erro: "Pacote inválido." }, { status: 400 });
  }

  try {
    const { url } = await criarCheckoutCreditos({
      userId: user.id,
      email: user.email,
      valorReais: valor,
    });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("[mp] falha ao criar checkout", user.id, valor, e);
    return NextResponse.json(
      { erro: "Não consegui abrir o pagamento. Tente de novo." },
      { status: 502 },
    );
  }
}
