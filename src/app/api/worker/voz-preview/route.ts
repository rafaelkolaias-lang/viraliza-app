import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { workerAutorizado } from "@/lib/worker-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prévias de voz: o gerador no PC do dono (gerar_previews_voz.py) sobe a prévia
// de cada voz curada pra cá. Salva em public/voice-previews/<id>.mp3 e o Estúdio
// toca via /api/midia/voice-previews/<id>.mp3. Gerada uma vez, reusada por todos.
const DIR = path.join(process.cwd(), "public", "voice-previews");

function idSeguro(id: string) {
  return id.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

export async function POST(req: Request) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const id = idSeguro(String(form.get("id") ?? "").trim());
  const audio = form.get("audio");
  if (!id || !(audio instanceof File)) {
    return NextResponse.json(
      { erro: "id e audio são obrigatórios" },
      { status: 400 },
    );
  }

  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(
    path.join(DIR, id + ".mp3"),
    Buffer.from(await audio.arrayBuffer()),
  );
  return NextResponse.json({ ok: true });
}
