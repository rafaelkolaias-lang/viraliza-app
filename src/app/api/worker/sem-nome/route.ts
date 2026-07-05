import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";
import { TITULOS_GENERICOS } from "@/lib/virais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista vídeos SEM nome de produto (título genérico), pro enriquecedor de visão
 * (roda no serverrk) processar os frames e mandar um nome de volta. Só migrado
 * (arquivo no SSD, dá pra extrair frame). Protegido por token do worker.
 */
export async function GET(req: Request) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 30));

  const where = { migrado: true, titulo: { in: TITULOS_GENERICOS } };
  const [total, itens] = await Promise.all([
    prisma.videoShopee.count({ where }),
    prisma.videoShopee.findMany({
      where,
      select: { id: true, titulo: true, categoria: true, duracaoSeg: true, link: true },
      orderBy: { adicionadoEm: "desc" },
      take: limit,
    }),
  ]);

  return NextResponse.json({ total, itens });
}
