import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { abrirApoio, normalizarValor } from "@/lib/apoios";
import { infinitepayConfigurada } from "@/lib/infinitepay";

export const runtime = "nodejs";

/** Abre um apoio e devolve o link de pagamento da InfinitePay. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!infinitepayConfigurada()) {
    return NextResponse.json({ erro: "O apoio está fora do ar por enquanto." }, { status: 503 });
  }

  let body: { valorCentavos?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const valor = normalizarValor(body.valorCentavos);
  if (valor === null) {
    return NextResponse.json({ erro: "Escolha um valor entre R$ 2 e R$ 5.000." }, { status: 400 });
  }

  const r = await abrirApoio({
    userId: user.id,
    valorCentavos: valor,
    nome: user.nome,
    email: user.email,
  });
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: 502 });

  return NextResponse.json({ ok: true, url: r.url });
}
