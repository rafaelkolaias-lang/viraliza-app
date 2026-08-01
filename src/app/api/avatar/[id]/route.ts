import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Excluir um avatar DA PESSOA. Só apaga a linha do banco: a imagem hospedada no
 * serverrk fica (vídeos já gerados com ela continuam funcionando). Avatares
 * prontos da plataforma não passam por aqui, não são de ninguém.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const { id } = await params;
  const avatar = await prisma.avatar.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!avatar || avatar.userId !== user.id) {
    return NextResponse.json({ erro: "Avatar não encontrado." }, { status: 404 });
  }

  await prisma.avatar.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
