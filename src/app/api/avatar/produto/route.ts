import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { montarPromptProduto } from "@/lib/produto-shot";

export const runtime = "nodejs";

/**
 * Recebe o avatar escolhido + as fotos do produto + como ele aparece, e monta o
 * prompt da foto "avatar com o produto" NO SERVIDOR. Por enquanto NÃO gera a
 * imagem: só monta/registra o prompt (o motor com o GPT vem depois). Admin recebe
 * o prompt de volta pra ver/copiar.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }

  let body: {
    apresentacao?: string;
    gerarClose?: boolean;
    produtoNome?: string;
    qtdFotos?: number;
    duracao?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  if (!body.apresentacao) {
    return NextResponse.json({ erro: "Escolha como o produto aparece." }, { status: 400 });
  }

  const prompt = montarPromptProduto({
    apresentacao: String(body.apresentacao),
    gerarClose: body.gerarClose !== false,
    produtoNome: body.produtoNome,
    duracaoSeg: Number(body.duracao) || 6,
  });

  console.log("[avatar-produto] prompt montado para", user.id, prompt);

  return NextResponse.json({
    ok: true,
    ...(user.role === "admin" ? { prompt } : {}),
  });
}
