import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { subirAvatar } from "@/lib/serverrk-upload";
import { criarNotificacao } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Chat interno (lado do ADMIN). Só o admin abre conversa, com QUALQUER pessoa.
 *  - GET: lista as conversas (última mensagem + não lidas de cada uma)
 *  - GET ?userId=: a thread completa (marca as do usuário como lidas)
 *  - GET ?buscar=: acha pessoas por nome/email (pra iniciar conversa nova)
 *  - POST { userId, texto } ou { userId, audio }: envia (e avisa no sininho)
 */

const MIMES_AUDIO: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};
const MAX_AUDIO = 8 * 1024 * 1024;

async function exigirAdmin() {
  const user = await getCurrentUser();
  if (!user) return { erro: NextResponse.json({ erro: "Faça login." }, { status: 401 }) };
  if (user.role !== "admin") {
    return { erro: NextResponse.json({ erro: "Só admin." }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: Request) {
  const { user, erro } = await exigirAdmin();
  if (!user) return erro;
  const url = new URL(req.url);

  // busca de pessoas pra iniciar conversa
  const buscar = (url.searchParams.get("buscar") ?? "").trim();
  if (buscar) {
    const pessoas = await prisma.user.findMany({
      where: {
        OR: [{ nome: { contains: buscar } }, { email: { contains: buscar } }],
        role: { not: "admin" },
      },
      take: 8,
      select: { id: true, nome: true, email: true },
    });
    return NextResponse.json({ pessoas });
  }

  // thread de uma pessoa
  const userId = (url.searchParams.get("userId") ?? "").trim();
  if (userId) {
    const [pessoa, mensagens] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, nome: true, email: true } }),
      prisma.chatMensagem.findMany({
        where: { userId },
        orderBy: { criadoEm: "asc" },
        take: 300,
        select: { id: true, autor: true, texto: true, audioUrl: true, criadoEm: true },
      }),
    ]);
    if (!pessoa) return NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 });
    await prisma.chatMensagem.updateMany({
      where: { userId, autor: "user", lida: false },
      data: { lida: true },
    });
    return NextResponse.json({ pessoa, mensagens });
  }

  // lista de conversas: última mensagem + não lidas por pessoa
  const ultimas = await prisma.chatMensagem.findMany({
    orderBy: { criadoEm: "desc" },
    take: 500,
    select: {
      userId: true,
      autor: true,
      texto: true,
      audioUrl: true,
      lida: true,
      criadoEm: true,
      user: { select: { nome: true, email: true } },
    },
  });
  const porPessoa = new Map<
    string,
    { userId: string; nome: string; email: string; previa: string; quando: string; naoLidas: number }
  >();
  for (const m of ultimas) {
    const atual = porPessoa.get(m.userId);
    if (!atual) {
      porPessoa.set(m.userId, {
        userId: m.userId,
        nome: m.user.nome || m.user.email,
        email: m.user.email,
        previa: m.texto ? m.texto.slice(0, 60) : "🎤 Áudio",
        quando: m.criadoEm.toISOString(),
        naoLidas: m.autor === "user" && !m.lida ? 1 : 0,
      });
    } else if (m.autor === "user" && !m.lida) {
      atual.naoLidas++;
    }
  }
  return NextResponse.json({ conversas: [...porPessoa.values()] });
}

export async function POST(req: Request) {
  const { user, erro } = await exigirAdmin();
  if (!user) return erro;

  let body: { userId?: string; texto?: string; audio?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  const destino = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    : null;
  if (!destino) return NextResponse.json({ erro: "Escolha a pessoa." }, { status: 400 });

  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, 2000) : "";
  let audioUrl: string | null = null;
  if (body.audio) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(body.audio));
    const ext = m ? MIMES_AUDIO[m[1].split(";")[0].toLowerCase()] : undefined;
    if (!m || !ext) return NextResponse.json({ erro: "Áudio inválido." }, { status: 400 });
    const bytes = Buffer.from(m[2], "base64");
    if (!bytes.length || bytes.length > MAX_AUDIO) {
      return NextResponse.json({ erro: "Áudio grande demais (máx ~2 min)." }, { status: 400 });
    }
    audioUrl = await subirAvatar(`chat-${randomUUID()}.${ext}`, bytes, m[1].split(";")[0]);
    if (!audioUrl) {
      return NextResponse.json({ erro: "Falha ao enviar o áudio." }, { status: 502 });
    }
  }
  if (!texto && !audioUrl) {
    return NextResponse.json({ erro: "Escreva algo ou grave um áudio." }, { status: 400 });
  }

  // se a pessoa já leu tudo, avisa no sininho (se tem coisa não lida, não spamma)
  const naoLidasAntes = await prisma.chatMensagem.count({
    where: { userId, autor: "admin", lida: false },
  });

  const msg = await prisma.chatMensagem.create({
    data: { userId, autor: "admin", texto: texto || null, audioUrl },
    select: { id: true, autor: true, texto: true, audioUrl: true, criadoEm: true },
  });

  if (naoLidasAntes === 0) {
    await criarNotificacao({
      userId,
      tipo: "admin",
      titulo: "Você recebeu uma mensagem 💬",
      mensagem: texto ? texto.slice(0, 120) : "Mensagem de áudio da equipe Viraliza.",
      link: "/painel",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, mensagem: msg });
}
