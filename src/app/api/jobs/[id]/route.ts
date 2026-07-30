import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * "Exclui" um job (vídeo/cortes): some da conta do usuário, mas a linha FICA no
 * banco como status "excluido" (com quem/quando) pro admin auditar em
 * /admin/excluidos. Os arquivos de ENTRADA locais são apagados (libera disco);
 * a saída hospedada (serverrk/Drive) fica, então o admin ainda consegue assistir.
 * Créditos NÃO voltam ao excluir (reembolso é só via reporte/estorno do admin).
 */
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

  // apaga só a mídia de ENTRADA local (a saída fica pra auditoria do admin)
  await fs.rm(pastaEntrada(id), { recursive: true, force: true }).catch(() => {});

  await prisma.job.update({
    where: { id },
    data: {
      status: "excluido",
      etapa: null,
      excluidoEm: new Date(),
      excluidoPor: user.email,
    },
  });
  return NextResponse.json({ ok: true });
}
