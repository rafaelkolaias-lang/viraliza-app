import { NextResponse } from "next/server";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBS = new Set(["videos", "imagens", "musica", "template"]);

function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo";
}

/**
 * Recebe UM pedaço de um arquivo de entrada e grava em disco (append em stream,
 * sem bufferizar na memória). parte=0 cria/zera o arquivo; parte>0 acrescenta.
 * Mantém cada request pequeno → passa pelo Cloudflare (limite ~100MB) e não
 * estoura a RAM do container.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ erro: "Job não encontrado." }, { status: 404 });
  }
  if (job.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  if (job.status !== "recebendo") {
    return NextResponse.json(
      { erro: "Esse job não está recebendo arquivos." },
      { status: 409 },
    );
  }

  const url = new URL(req.url);
  const sub = String(url.searchParams.get("sub") ?? "");
  const nome = nomeSeguro(String(url.searchParams.get("nome") ?? ""));
  const parte = Number(url.searchParams.get("parte") ?? 0) || 0;

  if (!SUBS.has(sub)) {
    return NextResponse.json({ erro: "destino inválido" }, { status: 400 });
  }
  if (!req.body) {
    return NextResponse.json({ erro: "pedaço vazio" }, { status: 400 });
  }

  const dir = path.join(pastaEntrada(id), sub);
  const alvo = path.join(dir, nome);
  // trava traversal: o alvo tem que ficar dentro da pasta do sub
  if (!alvo.startsWith(dir + path.sep)) {
    return NextResponse.json({ erro: "caminho inválido" }, { status: 400 });
  }

  await fs.mkdir(dir, { recursive: true });

  // parte 0 zera o arquivo (cobre reenvio); demais acrescentam
  const ws = createWriteStream(alvo, { flags: parte === 0 ? "w" : "a" });
  try {
    await pipeline(Readable.fromWeb(req.body as Parameters<typeof Readable.fromWeb>[0]), ws);
  } catch {
    return NextResponse.json(
      { erro: "Falha ao gravar o pedaço." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, parte });
}
