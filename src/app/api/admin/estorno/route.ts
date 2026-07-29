import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lancar } from "@/lib/creditos";
import { criarNotificacao } from "@/lib/notificacoes";

export const runtime = "nodejs";

/**
 * Estorno manual (admin): devolve pro dono do job TODOS os créditos que foram
 * debitados nele. Idempotente: se já teve estorno desse job, recusa (não duplica).
 * Usado no Diagnóstico pra ressarcir vídeo que saiu ruim/errado.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ erro: "Só admin." }, { status: 403 });

  let body: { jobId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }
  const jobId = String(body.jobId ?? "").trim();
  if (!jobId) return NextResponse.json({ erro: "Job inválido." }, { status: 400 });

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, produto: true },
  });
  if (!job) return NextResponse.json({ erro: "Vídeo não encontrado." }, { status: 404 });

  // quanto foi debitado nesse job
  const debitos = await prisma.creditoTransacao.findMany({
    where: { jobId, tipo: { in: ["debito_geracao", "debito_processamento"] } },
    select: { valor: true },
  });
  const total = debitos.reduce((s, t) => s + Math.abs(t.valor), 0);
  if (total <= 0) {
    return NextResponse.json({ erro: "Esse vídeo não teve créditos cobrados." }, { status: 409 });
  }

  // não estorna 2x o mesmo job
  const jaTem = await prisma.creditoTransacao.findFirst({
    where: { jobId, tipo: "estorno" },
    select: { id: true },
  });
  if (jaTem) {
    return NextResponse.json({ erro: "Esse vídeo já foi estornado." }, { status: 409 });
  }

  await lancar(job.userId, total, "estorno", {
    descricao: `Estorno do vídeo "${job.produto}" (admin)`,
    jobId,
  });
  await criarNotificacao({
    userId: job.userId,
    titulo: "Créditos devolvidos! 💚",
    mensagem: `Devolvemos ${total} créditos do vídeo "${job.produto}".`,
    link: "/painel/extrato",
  }).catch(() => {});

  return NextResponse.json({ ok: true, creditos: total });
}
