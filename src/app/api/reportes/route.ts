import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lancar } from "@/lib/creditos";
import { criarNotificacao } from "@/lib/notificacoes";

export const runtime = "nodejs";

/**
 * Reporte de problema num vídeo gerado. POST = usuário reporta (motivo) e o
 * pedido cai pro admin; PATCH = admin decide (reembolsar credita de volta os
 * créditos gastos no vídeo, recusar só encerra). O usuário é avisado no sininho.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { jobId?: string; motivo?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const jobId = String(body.jobId ?? "").trim();
  const motivo = String(body.motivo ?? "").trim();
  if (!jobId) return NextResponse.json({ erro: "Vídeo inválido." }, { status: 400 });
  if (motivo.length < 5) {
    return NextResponse.json({ erro: "Conte rapidinho o que deu errado (mínimo 5 letras)." }, { status: 400 });
  }

  // o job precisa ser do próprio usuário
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId: user.id },
    select: { id: true, produto: true },
  });
  if (!job) return NextResponse.json({ erro: "Vídeo não encontrado." }, { status: 404 });

  // 1 reporte por vídeo (não duplica pedido)
  const jaTem = await prisma.reporteVideo.findFirst({
    where: { jobId, userId: user.id },
    select: { id: true, status: true },
  });
  if (jaTem) {
    return NextResponse.json(
      { erro: "Você já reportou esse vídeo. A gente está analisando. 🙂" },
      { status: 409 },
    );
  }

  // créditos gastos nesse vídeo (o que seria reembolsado)
  const txs = await prisma.creditoTransacao.findMany({
    where: { jobId, userId: user.id, tipo: { in: ["debito_geracao", "debito_processamento"] } },
    select: { valor: true },
  });
  const creditos = txs.reduce((s, t) => s + Math.abs(t.valor), 0);

  await prisma.reporteVideo.create({
    data: {
      userId: user.id,
      jobId,
      produto: job.produto.slice(0, 255),
      motivo: motivo.slice(0, 2000),
      creditos,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ erro: "Só admin." }, { status: 403 });

  let body: { id?: string; acao?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const acao = body.acao === "reembolsar" ? "reembolsar" : body.acao === "recusar" ? "recusar" : null;
  if (!id || !acao) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const rep = await prisma.reporteVideo.findUnique({ where: { id } });
  if (!rep) return NextResponse.json({ erro: "Reporte não encontrado." }, { status: 404 });
  if (rep.status !== "novo") {
    return NextResponse.json({ erro: "Esse reporte já foi decidido." }, { status: 409 });
  }

  if (acao === "reembolsar") {
    if (rep.creditos > 0) {
      await lancar(rep.userId, rep.creditos, "estorno", {
        descricao: `Reembolso do vídeo "${rep.produto}" (problema reportado)`,
        jobId: rep.jobId,
      });
    }
    await prisma.reporteVideo.update({
      where: { id },
      data: { status: "reembolsado", decididoEm: new Date() },
    });
    await criarNotificacao({
      userId: rep.userId,
      titulo: "Créditos devolvidos! 💚",
      mensagem: `Analisamos o problema do vídeo "${rep.produto}" e devolvemos ${rep.creditos} créditos pra você.`,
      link: "/painel/extrato",
    }).catch(() => {});
  } else {
    await prisma.reporteVideo.update({
      where: { id },
      data: { status: "recusado", decididoEm: new Date() },
    });
    await criarNotificacao({
      userId: rep.userId,
      titulo: "Sobre o problema reportado",
      mensagem: `Analisamos o vídeo "${rep.produto}" e dessa vez não rolou o reembolso. Qualquer dúvida, fala com a gente nas Sugestões.`,
      link: "/painel/sugestoes",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
