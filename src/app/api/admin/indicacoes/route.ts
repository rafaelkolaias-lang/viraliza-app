import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { bonificarIndicacao } from "@/lib/afiliados-admin";

export const runtime = "nodejs";

/** Admin solta o bônus em créditos do afiliado de uma venda indicada. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  let body: { refId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corpo inválido
  }
  if (!body.refId) {
    return NextResponse.json({ erro: "Venda não informada." }, { status: 400 });
  }
  const r = await bonificarIndicacao(String(body.refId));
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
  return NextResponse.json({ ok: true });
}
