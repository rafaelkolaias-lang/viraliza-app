import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { minhasImagens } from "@/lib/galeria-servidor";
import { reconciliarPedidosImagem } from "@/lib/lab-pedido-imagem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Galeria "Minhas imagens": listar, favoritar e excluir. */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  // resgata a imagem de quem saiu da tela no meio da fila: ela ficou pronta no
  // robô e é aqui, na galeria, que a pessoa vem procurar por ela
  await reconciliarPedidosImagem(user).catch(() => {});
  return NextResponse.json({ ok: true, imagens: await minhasImagens(user.id) });
}

/** Liga/desliga a favorita (o coraçãozinho do card). */
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { id?: string; favorita?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const r = await prisma.imagemGerada.updateMany({
    where: { id: String(body.id ?? ""), userId: user.id },
    data: { favorita: !!body.favorita },
  });
  if (!r.count) return NextResponse.json({ erro: "Imagem não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id") ?? "";
  // só apaga o registro: o arquivo no serverrk fica, porque a mesma imagem pode
  // já ter virado vídeo e estar aparecendo em "Meus vídeos"
  const r = await prisma.imagemGerada.deleteMany({ where: { id, userId: user.id } });
  if (!r.count) return NextResponse.json({ erro: "Imagem não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
