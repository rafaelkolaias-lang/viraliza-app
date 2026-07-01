import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { marcarTodasLidas } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Marca todas as notificações do usuário logado como lidas (zera o sininho). */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }
  await marcarTodasLidas(user.id);
  return NextResponse.json({ ok: true });
}
