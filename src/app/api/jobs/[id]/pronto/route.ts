import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";
import { travaDeGeracao } from "@/lib/niveis";
import { normalizarRoteiro } from "@/lib/montagem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo";
}

async function arquivosDe(id: string, sub: string): Promise<string[]> {
  try {
    return await fs.readdir(path.join(pastaEntrada(id), sub));
  } catch {
    return [];
  }
}

/**
 * Finaliza um job que estava esperando: confere que os arquivos chegaram e joga
 * na fila ("na_fila") pro worker pegar. Só o dono (ou admin).
 *
 * Atende DOIS caminhos:
 *
 * - **"recebendo"** = rascunho do upload em pedaços (marca em lote). Chega sem
 *   corpo nenhum: é só o "acabei de subir, pode ir".
 * - **"preparando"** = job do Editor que já tem as mídias e está esperando a IA
 *   terminar de descrever e posicionar as cenas no navegador (dono, 11/08/2026).
 *   Chega com o `roteiro` final, que substitui o que foi gravado na criação.
 *   Se a IA falhar, vem `erro` em vez do roteiro e o job morre aqui mesmo, com o
 *   motivo no card: **deu erro, não gera**. Nada é renderizado torto, e o
 *   "Tentar Novamente" reabre o Editor com as mídias, que continuam no servidor.
 *
 * O roteiro é revalidado aqui com `normalizarRoteiro` contra os arquivos que
 * REALMENTE estão em disco. Confiar no que a tela mandou seria aceitar um
 * roteiro apontando pra arquivo que não existe (ou pra fora da pasta).
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
  if (job.status !== "recebendo" && job.status !== "preparando") {
    return NextResponse.json({ erro: "Job já finalizado." }, { status: 409 });
  }

  // corpo é opcional: o upload em pedaços chama sem nada
  let corpo: { roteiro?: unknown; erro?: unknown } = {};
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    corpo = {};
  }

  // ---- a IA falhou lá no navegador: o vídeo não sai ----
  const motivo = String(corpo.erro ?? "").trim().slice(0, 2000);
  if (motivo) {
    await prisma.job.update({
      where: { id },
      data: { status: "erro", etapa: null, erro: motivo },
    });
    return NextResponse.json({ ok: true, id, status: "erro" });
  }

  // Trava por nível só pra quem ainda não ocupa vaga. Sem isso dava pra criar
  // vários rascunhos e soltar todos na fila de uma vez, furando o limite de
  // simultâneos. O "preparando" JÁ conta como em produção, então revalidar ali
  // faria o job tropeçar em si mesmo no último lugar livre. Job de marca não
  // ocupa vaga (auditoria #25): 0 mantém só a trava de dívida.
  if (job.status === "recebendo") {
    const trava = await travaDeGeracao(user, job.tipo === "marca" ? 0 : 1);
    if (!trava.ok) {
      return NextResponse.json({ erro: trava.erro }, { status: trava.status });
    }
  }

  const videos = await arquivosDe(id, "videos");
  const imagens = await arquivosDe(id, "imagens");
  if (!videos.length && !imagens.length) {
    return NextResponse.json(
      { erro: "Nenhum vídeo ou imagem foi enviado." },
      { status: 400 },
    );
  }

  // ---- roteiro final (Editor): substitui o que ficou gravado na criação ----
  let opcoes = job.opcoes;
  if (corpo.roteiro != null) {
    const nomes = new Set([...videos, ...imagens]);
    const roteiro = normalizarRoteiro(corpo.roteiro, nomes, nomeSeguro);
    if (!roteiro.length) {
      return NextResponse.json(
        { erro: "O roteiro final não bate com as mídias enviadas." },
        { status: 400 },
      );
    }
    let atual: Record<string, unknown> = {};
    try {
      atual = job.opcoes ? (JSON.parse(job.opcoes) as Record<string, unknown>) : {};
    } catch {
      atual = {};
    }
    opcoes = JSON.stringify({ ...atual, roteiro });
  }

  await prisma.job.update({
    where: { id },
    data: { status: "na_fila", etapa: null, erro: null, opcoes },
  });
  return NextResponse.json({ ok: true, id });
}
