import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { interpretarPedido, buscarVideos } from "@/lib/minerador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minerador de produtos (liberado pra todo usuário logado). Recebe o texto do
 *  afiliado, o LLM próprio mapeia pros nichos e devolve os vídeos virais do acervo. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let texto = "";
  try {
    const body = (await req.json()) as { texto?: string };
    texto = String(body.texto ?? "").trim();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  if (texto.length < 2) {
    return NextResponse.json({ erro: "Escreva o que você quer garimpar." }, { status: 400 });
  }

  const { nichos, termo, viaIA } = await interpretarPedido(texto);
  if (!nichos.length) {
    return NextResponse.json({ termo, nichos: [], viaIA, videos: [] });
  }
  const videos = await buscarVideos(nichos, 60);
  return NextResponse.json({ termo, nichos, viaIA, videos });
}
