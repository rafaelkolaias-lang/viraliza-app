import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { dataUrlParaEntrada } from "@/lib/imagem-entrada";
import { subirAvatar } from "@/lib/serverrk-upload";
import { criarCenario, excluirCenario, meusCenarios } from "@/lib/cenarios-usuario";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Cenários próprios do usuário. Igual ao "subir avatar": a gente SÓ hospeda a
 * foto no serverrk e registra (sem IA, custo zero). O cenário aparece no passo
 * Cenário do Lab e na aba Cenários do Personalize com IA — só pra ele.
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  return NextResponse.json({ cenarios: await meusCenarios(user.id) });
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

  const foto = dataUrlParaEntrada(body.foto);
  if (!foto) {
    return NextResponse.json(
      { erro: "Envie uma imagem válida (JPG ou PNG, até 12MB)." },
      { status: 400 },
    );
  }

  const ext = EXT[foto.mime] ?? "jpg";
  const url = await subirAvatar(
    `cenario-${randomUUID()}.${ext}`,
    Buffer.from(foto.base64, "base64"),
    foto.mime,
  );
  if (!url) {
    return NextResponse.json({ erro: "Falha ao salvar o cenário. Tente de novo." }, { status: 502 });
  }

  const cenario = await criarCenario({
    userId: user.id,
    nome: String(body.nome ?? "").trim() || "Meu cenário",
    imagemUrl: url,
  });
  if (!cenario) {
    return NextResponse.json(
      { erro: "Você chegou no limite de 30 cenários. Exclua algum pra subir outro." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, cenario });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ erro: "Faltou o id." }, { status: 400 });
  const ok = await excluirCenario(user.id, id);
  if (!ok) return NextResponse.json({ erro: "Cenário não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
