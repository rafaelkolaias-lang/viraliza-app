import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { subirAvatar } from "@/lib/serverrk-upload";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Chat interno (lado do USUÁRIO). Regra de negócio: SÓ o admin abre a conversa.
 * A caixinha só aparece (e o usuário só consegue mandar) quando já existe ao
 * menos 1 mensagem do admin pra ele.
 *  - GET ?resumo=1: existe conversa? quantas não lidas? (poll leve do badge)
 *  - GET ?ler=1: mensagens completas + marca as do admin como lidas
 *  - POST { texto } ou { audio (data URL) }: responde
 */

const MIMES_AUDIO: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};
const MAX_AUDIO = 8 * 1024 * 1024; // ~8MB (uns 2 min de voz)

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const url = new URL(req.url);

  if (url.searchParams.get("resumo")) {
    const [total, naoLidas] = await Promise.all([
      prisma.chatMensagem.count({ where: { userId: user.id } }),
      prisma.chatMensagem.count({ where: { userId: user.id, autor: "admin", lida: false } }),
    ]);
    return NextResponse.json({ existe: total > 0, naoLidas });
  }

  const mensagens = await prisma.chatMensagem.findMany({
    where: { userId: user.id },
    orderBy: { criadoEm: "asc" },
    take: 200,
    select: { id: true, autor: true, texto: true, audioUrl: true, criadoEm: true },
  });
  if (url.searchParams.get("ler")) {
    await prisma.chatMensagem.updateMany({
      where: { userId: user.id, autor: "admin", lida: false },
      data: { lida: true },
    });
  }
  return NextResponse.json({ mensagens });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  // só responde se o admin já abriu a conversa
  const temConversa = await prisma.chatMensagem.count({ where: { userId: user.id } });
  if (!temConversa) {
    return NextResponse.json({ erro: "Conversa não disponível." }, { status: 403 });
  }

  let body: { texto?: string; audio?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, 2000) : "";
  let audioUrl: string | null = null;

  if (body.audio) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(body.audio));
    const ext = m ? MIMES_AUDIO[m[1].split(";")[0].toLowerCase()] : undefined;
    if (!m || !ext) {
      return NextResponse.json({ erro: "Áudio inválido." }, { status: 400 });
    }
    const bytes = Buffer.from(m[2], "base64");
    if (!bytes.length || bytes.length > MAX_AUDIO) {
      return NextResponse.json({ erro: "Áudio grande demais (máx ~2 min)." }, { status: 400 });
    }
    audioUrl = await subirAvatar(`chat-${randomUUID()}.${ext}`, bytes, m[1].split(";")[0]);
    if (!audioUrl) {
      return NextResponse.json({ erro: "Falha ao enviar o áudio. Tente de novo." }, { status: 502 });
    }
  }

  if (!texto && !audioUrl) {
    return NextResponse.json({ erro: "Escreva algo ou grave um áudio." }, { status: 400 });
  }

  const msg = await prisma.chatMensagem.create({
    data: { userId: user.id, autor: "user", texto: texto || null, audioUrl },
    select: { id: true, autor: true, texto: true, audioUrl: true, criadoEm: true },
  });
  return NextResponse.json({ ok: true, mensagem: msg });
}
