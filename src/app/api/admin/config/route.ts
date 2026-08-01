import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { CHAVES, definir, estadoGeracao, type ChaveConfig } from "@/lib/configuracao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liga/desliga a geração de imagem e vídeo. Só admin. */

const PERMITIDAS: ChaveConfig[] = [CHAVES.geracaoImagem, CHAVES.geracaoVideo];

export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, ...(await estadoGeracao()) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  }

  let body: { chave?: string; ligado?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const chave = PERMITIDAS.find((c) => c === body.chave);
  if (!chave) return NextResponse.json({ erro: "Chave desconhecida." }, { status: 400 });

  await definir(chave, !!body.ligado, user.email);
  return NextResponse.json({ ok: true, ...(await estadoGeracao()) });
}
