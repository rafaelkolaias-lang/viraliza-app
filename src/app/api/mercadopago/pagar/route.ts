import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import {
  criarPagamento,
  mercadoPagoConfigurado,
  type FormDataBrick,
} from "@/lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pagamento do pacote SEM sair do site. Recebe o `formData` do Payment Brick
 * (cartão de crédito, débito, pré-pago, Pix ou boleto) e cria o pagamento.
 *
 * O valor NUNCA vem solto do cliente: só aceita os pacotes da tabela, e o
 * crédito em si é sempre trabalho do webhook (um caminho só pra creditar).
 */
const VALORES_PERMITIDOS = new Set([20, 50, 100]);

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Pagamento indisponível no momento." }, { status: 503 });
  }

  let body: { valor?: number; form?: FormDataBrick } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const valor = Number(body.valor);
  if (!VALORES_PERMITIDOS.has(valor)) {
    return NextResponse.json({ erro: "Pacote inválido." }, { status: 400 });
  }
  if (!body.form?.payment_method_id) {
    return NextResponse.json({ erro: "Escolha uma forma de pagamento." }, { status: 400 });
  }

  try {
    const r = await criarPagamento({
      userId: user.id,
      email: user.email,
      valorReais: valor,
      form: body.form,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[mp] falha ao criar pagamento", user.id, valor, e);
    return NextResponse.json(
      { erro: "Não consegui iniciar o pagamento. Tente de novo." },
      { status: 502 },
    );
  }
}
