import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Worker reporta a FASE atual do render (ex: "Escrevendo a copy",
 * "Renderizando 1/2", "Subindo o vídeo"). Só atualiza enquanto o job está em
 * produção - não "ressuscita" um job já pronto/erro/cancelado.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  // o worker manda form-encoded (data=). Lê formData; cai pra JSON por garantia.
  let bruto = "";
  try {
    const form = await req.formData();
    bruto = String(form.get("etapa") ?? "");
  } catch {
    const j = (await req.json().catch(() => ({}))) as { etapa?: string };
    bruto = String(j.etapa ?? "");
  }
  const etapa = bruto.slice(0, 120) || null;

  const r = await prisma.job.updateMany({
    where: { id, status: { in: ["renderizando", "processando"] } },
    data: { etapa },
  });

  return NextResponse.json({ ok: true, atualizado: r.count });
}
