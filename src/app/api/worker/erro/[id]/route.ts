import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";
import { notificarJobErro } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Worker falhou ao renderizar: marca o job como "erro" com a mensagem. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { erro?: string };

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ erro: "job não existe" }, { status: 404 });

  await prisma.job.update({
    where: { id },
    data: {
      status: "erro",
      erro: (body.erro ?? "Falha no render").slice(0, 500),
      etapa: null,
    },
  });
  await notificarJobErro(job).catch(() => {});

  return NextResponse.json({ ok: true });
}
