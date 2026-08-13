import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Serve uma MÍDIA DE ENTRADA de um job pro próprio dono (tarefa 21).
 *
 * É o que deixa o "Tentar Novamente" / "Editar novamente" abrir o editor com os
 * arquivos originais pré-carregados: a pasta `data/uploads/<jobId>` fica fora do
 * public de propósito (o worker baixa por token), então o navegador só chega
 * nela por aqui, com sessão e checagem de dono. O nome passa pelo `basename`
 * (nada de subir de pasta) e a busca é limitada às subpastas de mídia.
 *
 * As entradas expiram em 24h (limpeza no instrumentation.ts): depois disso a
 * rota devolve 404 e a tela pede o upload de novo.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; arquivo: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }

  const { id, arquivo } = await params;
  const job = await prisma.job.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  }

  const nome = path.basename(decodeURIComponent(arquivo));
  for (const sub of ["videos", "imagens"] as const) {
    const caminho = path.join(pastaEntrada(id), sub, nome);
    let st;
    try {
      st = await fs.stat(caminho);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;

    const ext = path.extname(nome).toLowerCase();
    const tipo =
      {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
      }[ext] ?? "application/octet-stream";

    // stream direto do disco: arquivo de vídeo pode ter centenas de MB e
    // carregar tudo em memória derrubaria o processo com uploads grandes
    const corpo = Readable.toWeb(createReadStream(caminho)) as ReadableStream;
    return new Response(corpo, {
      headers: {
        "Content-Type": tipo,
        "Content-Length": String(st.size),
        "Cache-Control": "private, no-store",
      },
    });
  }

  return NextResponse.json(
    { erro: "As mídias originais expiraram no servidor (valem 24h)." },
    { status: 404 },
  );
}
