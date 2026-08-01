import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Andamento do vídeo do Lab: a tela pergunta de tempos em tempos até virar
 * "pronto" (ou "erro"). Só o dono do job enxerga (admin também, pra suporte).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      userId: true,
      status: true,
      etapa: true,
      erro: true,
      saidas: true,
      midias: true,
      criadoEm: true,
    },
  });
  if (!job) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  if (job.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }

  let videoUrl: string | null = null;
  let thumbUrl: string | null = null;
  try {
    const saidas = job.saidas ? (JSON.parse(job.saidas) as string[]) : [];
    videoUrl = saidas[0] ?? null;
    const midias = job.midias
      ? (JSON.parse(job.midias) as { arquivo?: string; thumb?: string }[])
      : [];
    thumbUrl = midias[0]?.thumb ?? null;
  } catch {
    // job sem saída legível: a tela trata como ainda gerando
  }

  return NextResponse.json({
    ok: true,
    status: job.status,
    etapa: job.etapa,
    erro: job.erro,
    videoUrl,
    thumbUrl,
    desde: job.criadoEm,
  });
}
