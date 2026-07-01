import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { workerAutorizado } from "@/lib/worker-auth";
import type { ViralVideo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIRAIS_DIR = path.join(process.cwd(), "public", "virais");
const VIRAIS_JSON = path.join(process.cwd(), "data", "virais.json");

function idSeguro(id: string) {
  return id.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "viral";
}

async function lerLista(): Promise<ViralVideo[]> {
  try {
    const arr = JSON.parse(await fs.readFile(VIRAIS_JSON, "utf8")) as ViralVideo[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function salvarLista(lista: ViralVideo[]) {
  await fs.mkdir(path.dirname(VIRAIS_JSON), { recursive: true });
  const tmp = VIRAIS_JSON + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(lista, null, 2), "utf8");
  await fs.rename(tmp, VIRAIS_JSON);
}

/**
 * O bot do Telegram (no PC) sobe um vídeo viral pra cá: o arquivo + os metadados.
 * Salva em public/virais/<id>.mp4 e registra em data/virais.json (sem duplicar).
 */
export async function POST(req: Request) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("video");
  const thumbFile = form.get("thumb");
  const id = idSeguro(String(form.get("id") ?? "").trim());
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });

  await fs.mkdir(VIRAIS_DIR, { recursive: true });

  // salva a miniatura (se veio)
  let thumbPath: string | undefined;
  if (thumbFile instanceof File) {
    await fs.writeFile(
      path.join(VIRAIS_DIR, id + ".jpg"),
      Buffer.from(await thumbFile.arrayBuffer()),
    );
    thumbPath = `/virais/${id}.jpg`;
  }

  const lista = await lerLista();
  const existente = lista.find((v) => v.id === id);
  if (existente) {
    // já existe: aproveita pra preencher a miniatura que faltava
    if (thumbPath && !existente.thumb) {
      existente.thumb = thumbPath;
      await salvarLista(lista);
    }
    return NextResponse.json({ ok: true, jaExistia: true });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "vídeo obrigatório" }, { status: 400 });
  }
  await fs.writeFile(path.join(VIRAIS_DIR, id + ".mp4"), Buffer.from(await file.arrayBuffer()));

  const item: ViralVideo = {
    id,
    titulo: String(form.get("titulo") ?? "Vídeo viral").slice(0, 120),
    link: String(form.get("link") ?? "") || undefined,
    arquivo: `/virais/${id}.mp4`,
    thumb: thumbPath,
    duracaoSeg: Number(form.get("duracaoSeg") ?? 0) || 0,
    canal: String(form.get("canal") ?? "") || undefined,
    adicionadoEm: String(form.get("adicionadoEm") ?? "") || new Date().toISOString(),
  };
  lista.unshift(item); // mais novo primeiro
  await salvarLista(lista);

  return NextResponse.json({ ok: true, id });
}
