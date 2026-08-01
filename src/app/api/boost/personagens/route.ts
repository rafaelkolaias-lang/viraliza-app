import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { dataUrlParaEntrada } from "@/lib/imagem-entrada";
import { subirAvatar } from "@/lib/serverrk-upload";
import { meusPersonagens } from "@/lib/boost-servidor";
import { formatoPorChave } from "@/lib/viral-boost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Personagens DA PESSOA no Viral Boost: a fruta dela, a avó dela, o mascote da
 * loja. A foto sobe pro serverrk e vira a referência que trava o personagem em
 * todas as historinhas dela.
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  return NextResponse.json({ ok: true, personagens: await meusPersonagens(user.id) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { nome?: string; jeito?: string; genero?: string; formato?: string; foto?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) return NextResponse.json({ erro: "Dê um nome ao personagem." }, { status: 400 });

  const foto = dataUrlParaEntrada(body.foto);
  if (!foto) {
    return NextResponse.json(
      { erro: "Envie a foto do personagem (JPG ou PNG, até 12MB)." },
      { status: 400 },
    );
  }

  const ext = /png/i.test(foto.mime) ? "png" : /webp/i.test(foto.mime) ? "webp" : "jpg";
  const url = await subirAvatar(
    `personagem-${randomUUID()}.${ext}`,
    Buffer.from(foto.base64, "base64"),
    foto.mime,
  );
  if (!url) {
    return NextResponse.json({ erro: "Falha ao salvar a foto. Tente de novo." }, { status: 502 });
  }

  const p = await prisma.personagemUsuario.create({
    data: {
      userId: user.id,
      nome: nome.slice(0, 60),
      jeito: String(body.jeito ?? "").trim().slice(0, 160) || "personagem da casa",
      genero: body.genero === "m" ? "m" : "f",
      formato: formatoPorChave(body.formato).chave,
      imagemUrl: url,
    },
  });

  return NextResponse.json({
    ok: true,
    personagem: {
      chave: `meu-${p.id}`,
      nome: p.nome,
      genero: p.genero,
      jeito: p.jeito,
      imagem: p.imagemUrl,
      formato: p.formato,
      meu: true,
    },
  });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id")?.replace(/^meu-/, "") ?? "";
  const p = await prisma.personagemUsuario.findUnique({ where: { id }, select: { userId: true } });
  if (!p || p.userId !== user.id) {
    return NextResponse.json({ erro: "Personagem não encontrado." }, { status: 404 });
  }
  await prisma.personagemUsuario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
