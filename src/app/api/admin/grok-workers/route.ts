import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = (process.env.GROK_INGEST_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.GROK_INGEST_TOKEN || "";

/** GET: Retorna a lista de workers do Grok. Só admin. */
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  }

  if (!BASE || !TOKEN) {
    return NextResponse.json({ erro: "Motor de vídeo não configurado." }, { status: 500 });
  }

  try {
    const res = await fetch(`${BASE}/api/v1/workers/list`, {
      headers: { "X-Grok-Token": TOKEN },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ erro: "Erro ao consultar o Master do Grok." }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || "Erro de conexão com o Master." }, { status: 500 });
  }
}

/** POST: Ativa ou desativa um worker específico. Só admin. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  }

  if (!BASE || !TOKEN) {
    return NextResponse.json({ erro: "Motor de vídeo não configurado." }, { status: 500 });
  }

  let body: { name?: string; ativo?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ erro: "Nome do worker é obrigatório." }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/api/v1/workers/toggle`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Grok-Token": TOKEN 
      },
      body: JSON.stringify({
        name: body.name,
        ativo: !!body.ativo,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ erro: "Erro ao atualizar worker no Master." }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || "Erro de conexão com o Master." }, { status: 500 });
  }
}
