import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada, pastaSaida } from "@/lib/jobs";

export const runtime = "nodejs";

/** Exclui um job (vídeo/cortes) do usuário - remove os arquivos e a linha no banco. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  }
  // só o dono (ou admin) pode excluir
  if (job.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  // apaga os arquivos (entrada + saída) - ignora se já não existirem
  await Promise.all([
    fs.rm(pastaSaida(id), { recursive: true, force: true }).catch(() => {}),
    fs.rm(pastaEntrada(id), { recursive: true, force: true }).catch(() => {}),
  ]);

  await prisma.job.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
