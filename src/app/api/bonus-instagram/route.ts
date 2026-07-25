import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { pedirBonusIg } from "@/lib/bonus-instagram";

export const runtime = "nodejs";

// A pessoa envia o @ dela pra pedir o bônus de créditos. Vira um pedido pendente
// que o admin aprova depois (a Meta não deixa verificar seguir/curtir por API).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }
  let body: { instagram?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corpo inválido: trata como @ vazio (a validação abaixo devolve o erro)
  }
  const r = await pedirBonusIg(user.id, String(body.instagram ?? ""));
  if (!r.ok) {
    return NextResponse.json({ erro: r.erro }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
