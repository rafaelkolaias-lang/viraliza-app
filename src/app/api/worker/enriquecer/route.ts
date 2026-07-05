import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";
import { TITULOS_GENERICOS } from "@/lib/virais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idSeguro(id: string) {
  return id.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "viral";
}

/**
 * Grava o nome (e nicho) que a LLM de visão identificou pelo frame do vídeo.
 * Trava de segurança: SÓ escreve por cima de um título genérico (sem nome). Se o
 * vídeo já tem nome de verdade, não mexe. Protegido por token do worker.
 */
export async function POST(req: Request) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const id = idSeguro(String(form.get("id") ?? "").trim());
  const titulo = String(form.get("titulo") ?? "").trim().slice(0, 500);
  const categoria = String(form.get("categoria") ?? "").trim().slice(0, 255);
  if (!id || !titulo) {
    return NextResponse.json({ erro: "id e titulo obrigatórios" }, { status: 400 });
  }

  const existente = await prisma.videoShopee.findUnique({
    where: { id },
    select: { titulo: true, categoria: true },
  });
  if (!existente) {
    return NextResponse.json({ erro: "não encontrado" }, { status: 404 });
  }
  // trava: não pisa num nome de verdade (só enriquece o que está genérico)
  if (!TITULOS_GENERICOS.includes(existente.titulo)) {
    return NextResponse.json({ ok: true, pulado: "já tem nome" });
  }

  await prisma.videoShopee.update({
    where: { id },
    data: {
      titulo,
      categoria: existente.categoria || categoria,
      emAlta: true, // ganhou nome/nicho -> entra como "em alta"
    },
  });

  return NextResponse.json({ ok: true, id, titulo });
}
