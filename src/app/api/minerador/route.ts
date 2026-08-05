import { NextResponse } from "next/server";
import { assinaturaAtiva, getCurrentUser } from "@/lib/dal";
import { interpretarPedido, buscarVideos } from "@/lib/minerador";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minerador de produtos. Recebe o texto do afiliado, o LLM próprio mapeia pros
 *  nichos e devolve os vídeos virais do acervo.
 *
 *  Exige ASSINATURA: o que sai daqui são os mesmos vídeos da biblioteca (Virais),
 *  com link que toca e baixa. Sem esta trava, quem perdeu a assinatura (reembolso,
 *  chargeback ou corte do admin) continuava consumindo o acervo por esta porta. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await assinaturaAtiva(user))) {
    return NextResponse.json(
      { erro: "O Minerador faz parte da biblioteca e é exclusivo pra assinantes." },
      { status: 403 },
    );
  }

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
