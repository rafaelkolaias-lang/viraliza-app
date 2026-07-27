import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { criarSugestao, mudarStatusSugestao } from "@/lib/sugestoes";

export const runtime = "nodejs";

/** Usuário manda uma sugestão/melhoria. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { texto?: string; tipo?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const texto = String(body.texto ?? "").trim();
  if (texto.length < 3) {
    return NextResponse.json({ erro: "Escreva sua sugestão." }, { status: 400 });
  }

  const sugestao = await criarSugestao(user.id, texto, String(body.tipo ?? "sugestao"));
  return NextResponse.json({ ok: true, sugestao });
}

/** Admin muda o status de uma sugestão. */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 });
  }

  let body: { id?: string; status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ erro: "Sugestão inválida." }, { status: 400 });

  await mudarStatusSugestao(String(body.id), String(body.status ?? "lida"));
  return NextResponse.json({ ok: true });
}
