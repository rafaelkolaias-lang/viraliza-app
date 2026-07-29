import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { criarSugestao, mudarStatusSugestao, responderSugestao } from "@/lib/sugestoes";
import { creditar } from "@/lib/creditos";
import { criarNotificacao } from "@/lib/notificacoes";

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

/** Admin muda o status OU responde (com créditos de recompensa opcionais). */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 403 });
  }

  let body: { id?: string; status?: string; resposta?: string; creditos?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ erro: "Sugestão inválida." }, { status: 400 });
  const id = String(body.id);

  // responder: salva a resposta, dá os créditos (se tiver) e avisa no sininho
  const resposta = String(body.resposta ?? "").trim();
  if (resposta) {
    const creditos = Math.min(100_000, Math.max(0, Math.round(Number(body.creditos) || 0)));
    const s = await responderSugestao(id, resposta, creditos);
    if (creditos > 0) {
      await creditar(s.userId, creditos, "ajuste_admin", "Recompensa pela sua sugestão 💚");
    }
    await criarNotificacao({
      userId: s.userId,
      titulo: creditos > 0 ? `Sua sugestão rendeu ${creditos} créditos! 🎉` : "Respondemos sua sugestão!",
      mensagem: resposta.slice(0, 500),
      link: "/painel/sugestoes",
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  await mudarStatusSugestao(id, String(body.status ?? "lida"));
  return NextResponse.json({ ok: true });
}
