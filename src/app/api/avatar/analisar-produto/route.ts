import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { analisarProduto, geminiConfigurado } from "@/lib/gemini-vision";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Recebe 1 a 3 fotos do produto (data URLs) e usa o Gemini pra descobrir o que é
 * (nome, tipo, descrição fiel em inglês e sugestão de apresentação). Serve pra
 * montar um prompt de vídeo bem melhor.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }
  if (!geminiConfigurado()) {
    return NextResponse.json({ erro: "IA de visão não configurada." }, { status: 503 });
  }

  let body: { imagens?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const imagens = (body.imagens ?? [])
    .slice(0, 3)
    .map((dataUrl) => {
      const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl));
      return m ? { mime: m[1], base64: m[2] } : null;
    })
    .filter((x): x is { mime: string; base64: string } => !!x);

  if (!imagens.length) {
    return NextResponse.json({ erro: "Envie ao menos 1 foto." }, { status: 400 });
  }

  const analise = await analisarProduto(imagens);
  if (!analise) {
    return NextResponse.json({ erro: "Não consegui analisar agora. Tente de novo." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, analise });
}
