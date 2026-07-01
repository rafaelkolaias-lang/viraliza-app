import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function temArquivo(id: string, sub: string) {
  try {
    const arqs = await fs.readdir(path.join(pastaEntrada(id), sub));
    return arqs.length > 0;
  } catch {
    return false;
  }
}

/**
 * Finaliza um job que estava "recebendo": confere que os arquivos chegaram e
 * joga na fila ("na_fila") pro worker pegar. Só o dono (ou admin).
 */
export async function POST(
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
    return NextResponse.json({ erro: "Job não encontrado." }, { status: 404 });
  }
  if (job.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  if (job.status !== "recebendo") {
    return NextResponse.json({ erro: "Job já finalizado." }, { status: 409 });
  }

  const temVideo = await temArquivo(id, "videos");
  const temImagem = await temArquivo(id, "imagens");
  if (!temVideo && !temImagem) {
    return NextResponse.json(
      { erro: "Nenhum vídeo ou imagem foi enviado." },
      { status: 400 },
    );
  }

  await prisma.job.update({
    where: { id },
    data: { status: "na_fila", erro: null },
  });
  return NextResponse.json({ ok: true, id });
}
