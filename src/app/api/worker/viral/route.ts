import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function idSeguro(id: string) {
  return id.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "viral";
}

/**
 * O ingest do Telegram (roda no serverrk) baixa o vídeo, salva o mp4 + thumb direto
 * no SSD (/mnt/ssd/viraliza/media/virais|thumbs) e chama AQUI só com os metadados.
 * A gente registra no banco (VideoShopee, migrado=true) apontando pro serverrk
 * (media.univershoop.com). Sem duplicar (upsert por id).
 */
export async function POST(req: Request) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const id = idSeguro(String(form.get("id") ?? "").trim());
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });

  const titulo = String(form.get("titulo") ?? "Vídeo viral").slice(0, 500) || "Vídeo viral";
  const link = String(form.get("link") ?? "").trim() || null;
  const categoria = String(form.get("categoria") ?? "").trim().slice(0, 255);
  const emAltaRaw = String(form.get("emAlta") ?? "").trim().toLowerCase();
  const emAlta = emAltaRaw === "1" || emAltaRaw === "true" || (!!categoria && emAltaRaw !== "0");
  const duracaoSeg = Number(form.get("duracaoSeg") ?? 0) || 0;
  const canal = String(form.get("canal") ?? "").trim() || null;
  const addRaw = String(form.get("adicionadoEm") ?? "").trim();
  const adicionadoEm = addRaw && !Number.isNaN(Date.parse(addRaw)) ? new Date(addRaw) : new Date();

  const existente = await prisma.videoShopee.findUnique({ where: { id } });
  if (existente) {
    // já existe: completa categoria/nicho/link se estavam vazios (não sobrescreve à toa)
    await prisma.videoShopee.update({
      where: { id },
      data: {
        categoria: existente.categoria || categoria,
        emAlta: existente.emAlta || emAlta,
        link: existente.link || link,
        migrado: true,
      },
    });
    return NextResponse.json({ ok: true, jaExistia: true });
  }

  await prisma.videoShopee.create({
    data: {
      id,
      titulo,
      link,
      categoria,
      emAlta,
      duracaoSeg,
      canal,
      migrado: true, // arquivo já está no serverrk (media.univershoop.com/virais/<id>.mp4)
      adicionadoEm,
    },
  });

  return NextResponse.json({ ok: true, id });
}
