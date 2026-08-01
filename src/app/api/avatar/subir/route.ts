import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { dataUrlParaEntrada } from "@/lib/imagem-entrada";
import { subirAvatar } from "@/lib/serverrk-upload";
import { registrarAvatar } from "@/lib/avatares";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * "Subir avatar pronto": a pessoa manda a imagem do avatar dela e a gente SÓ
 * hospeda no serverrk e registra (NADA de IA, CUSTO ZERO). Ela usa direto nos
 * vídeos, igual aos avatares prontos. Ver openai-image.ts pros modos que geram.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { nome?: string; foto?: string; genero?: string; url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) {
    return NextResponse.json({ erro: "Dê um nome ao avatar." }, { status: 400 });
  }

  // imagem JÁ hospedada por nós (ex: a que o Viraliza Lab acabou de gerar): não
  // precisa subir de novo, só registrar na galeria da pessoa.
  const jaHospedada = (body.url ?? "").trim();
  const MEDIA = process.env.NEXT_PUBLIC_MEDIA_BASE || "https://media.univershoop.com";
  let url: string | null = null;

  if (jaHospedada) {
    if (!jaHospedada.startsWith(MEDIA)) {
      return NextResponse.json({ erro: "Imagem inválida." }, { status: 400 });
    }
    url = jaHospedada;
  } else {
    const foto = dataUrlParaEntrada(body.foto);
    if (!foto) {
      return NextResponse.json({ erro: "Envie uma imagem válida (JPG ou PNG, até 12MB)." }, { status: 400 });
    }
    // sobe a imagem como está (sem gerar nada, sem cobrar)
    const ext = EXT[foto.mime] ?? "png";
    url = await subirAvatar(`${randomUUID()}.${ext}`, Buffer.from(foto.base64, "base64"), foto.mime);
  }

  if (!url) {
    return NextResponse.json({ erro: "Falha ao salvar o avatar. Tente de novo." }, { status: 502 });
  }

  const avatar = await registrarAvatar({
    userId: user.id,
    nome,
    genero: body.genero === "male" ? "male" : "female",
    imagemUrl: url,
    escolhas: { origem: "upload" },
  });

  return NextResponse.json({ ok: true, avatar });
}
