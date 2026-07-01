import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { listarNotificacoes } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista as notificações do sininho do usuário logado + contagem de não lidas. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ itens: [], naoLidas: 0 }, { status: 401 });
  }
  const dados = await listarNotificacoes(user.id);
  return NextResponse.json(dados);
}
