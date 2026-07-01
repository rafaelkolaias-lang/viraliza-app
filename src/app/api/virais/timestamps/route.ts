import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { contarViraisNovos } from "@/lib/virais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Quantos vídeos virais entraram DEPOIS de `?desde=<ISO>` (data do último que o
 * usuário viu, guardada no navegador). Retorna só um número - o menu acende a
 * bolinha de "tem vídeo novo". Antes isso baixava TODAS as datas; agora é um
 * count indexado (rápido e leve, não cresce com o acervo).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ novos: 0 });

  const desdeRaw = new URL(req.url).searchParams.get("desde") || "";
  const desde = desdeRaw && !Number.isNaN(Date.parse(desdeRaw)) ? new Date(desdeRaw) : null;
  if (!desde) return NextResponse.json({ novos: 0 });

  const novos = await contarViraisNovos(desde);
  return NextResponse.json({ novos });
}
