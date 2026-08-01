import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import { driveThumb } from "@/lib/drive";
import { dataUrlParaEntrada } from "@/lib/imagem-entrada";
import { subirAvatar } from "@/lib/serverrk-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Produtos do Viraliza Lab (passo "Selecione um produto"):
 *  - GET  lista os produtos DA PESSOA (que ela subiu) + o acervo Shopee, com
 *         busca por título e paginação (o acervo tem muita coisa).
 *  - POST sobe a foto de um produto dela (nome + imagem) e guarda pra reusar.
 */

const POR_PAGINA = 24;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const url = new URL(req.url);
  const busca = (url.searchParams.get("busca") ?? "").trim().slice(0, 80);
  const pagina = Math.max(1, Number(url.searchParams.get("pagina") ?? 1) || 1);

  // os meus vêm sempre na 1ª página (são poucos e é o que ela mais usa)
  const meus =
    pagina === 1
      ? await prisma.produtoUsuario.findMany({
          where: {
            userId: user.id,
            ...(busca ? { nome: { contains: busca } } : {}),
          },
          orderBy: { criadoEm: "desc" },
          take: 60,
          select: { id: true, nome: true, imagemUrl: true },
        })
      : [];

  const [shopee, total] = await Promise.all([
    prisma.produtoShopee.findMany({
      where: busca ? { titulo: { contains: busca } } : {},
      orderBy: { adicionadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      select: { id: true, titulo: true, driveId: true, migrado: true },
    }),
    prisma.produtoShopee.count({ where: busca ? { titulo: { contains: busca } } : {} }),
  ]);

  return NextResponse.json({
    meus: meus.map((p) => ({ id: p.id, titulo: p.nome, imagem: p.imagemUrl, meu: true })),
    shopee: shopee.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      imagem: p.migrado
        ? `${MEDIA_BASE}/produtos/${p.id}.jpg`
        : driveThumb(p.driveId, 500),
      meu: false,
    })),
    pagina,
    temMais: pagina * POR_PAGINA < total,
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { nome?: string; foto?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) {
    return NextResponse.json({ erro: "Dê um nome ao produto." }, { status: 400 });
  }
  const foto = dataUrlParaEntrada(body.foto);
  if (!foto) {
    return NextResponse.json(
      { erro: "Envie a foto do produto (JPG ou PNG, até 12MB)." },
      { status: 400 },
    );
  }

  const ext = /png/i.test(foto.mime) ? "png" : /webp/i.test(foto.mime) ? "webp" : "jpg";
  const url = await subirAvatar(
    `produto-${randomUUID()}.${ext}`,
    Buffer.from(foto.base64, "base64"),
    foto.mime,
  );
  if (!url) {
    return NextResponse.json({ erro: "Falha ao salvar a foto. Tente de novo." }, { status: 502 });
  }

  const p = await prisma.produtoUsuario.create({
    data: { userId: user.id, nome: nome.slice(0, 200), imagemUrl: url },
    select: { id: true, nome: true, imagemUrl: true },
  });
  return NextResponse.json({
    ok: true,
    produto: { id: p.id, titulo: p.nome, imagem: p.imagemUrl, meu: true },
  });
}
