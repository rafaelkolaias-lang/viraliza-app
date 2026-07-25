import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { decidirBonusIg } from "@/lib/bonus-instagram";

export const runtime = "nodejs";

// Admin aprova (credita 300) ou recusa um pedido de bônus do Instagram.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  let body: { id?: string; acao?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corpo inválido
  }
  if (!body.id) {
    return NextResponse.json({ erro: "Pedido não informado." }, { status: 400 });
  }
  const r = await decidirBonusIg(String(body.id), body.acao === "aprovar");
  if (!r.ok) {
    return NextResponse.json({ erro: r.erro }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
