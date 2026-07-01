import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { workerAutorizado } from "@/lib/worker-auth";
import type { ViralProduto } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUTOS_DIR = path.join(process.cwd(), "public", "produtos");
const PRODUTOS_JSON = path.join(process.cwd(), "data", "produtos.json");

function idSeguro(id: string) {
  return id.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "produto";
}

async function lerLista(): Promise<ViralProduto[]> {
  try {
    const arr = JSON.parse(await fs.readFile(PRODUTOS_JSON, "utf8")) as ViralProduto[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function salvarLista(lista: ViralProduto[]) {
  await fs.mkdir(path.dirname(PRODUTOS_JSON), { recursive: true });
  const tmp = PRODUTOS_JSON + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(lista, null, 2), "utf8");
  await fs.rename(tmp, PRODUTOS_JSON);
}

/**
 * O bot do Telegram sobe um produto viral (imagem + metadados) pra cá.
 * Salva em public/produtos/<id>.jpg e registra em data/produtos.json (sem duplicar).
 */
export async function POST(req: Request) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("imagem");
  const id = idSeguro(String(form.get("id") ?? "").trim());
  if (!id) return NextResponse.json({ erro: "id obrigatório" }, { status: 400 });
  if (!(file instanceof File)) {
    return NextResponse.json({ erro: "imagem obrigatória" }, { status: 400 });
  }

  const lista = await lerLista();
  if (lista.some((p) => p.id === id)) {
    return NextResponse.json({ ok: true, jaExistia: true });
  }

  // mantém a extensão original (jpg/png/webp)
  const extRaw = (form.get("ext") ? String(form.get("ext")) : ".jpg").toLowerCase();
  const ext = [".jpg", ".jpeg", ".png", ".webp"].includes(extRaw) ? extRaw : ".jpg";

  await fs.mkdir(PRODUTOS_DIR, { recursive: true });
  await fs.writeFile(path.join(PRODUTOS_DIR, id + ext), Buffer.from(await file.arrayBuffer()));

  const item: ViralProduto = {
    id,
    titulo: String(form.get("titulo") ?? "Produto viral").slice(0, 120),
    link: String(form.get("link") ?? "") || undefined,
    arquivo: `/produtos/${id}${ext}`,
    canal: String(form.get("canal") ?? "") || undefined,
    adicionadoEm: String(form.get("adicionadoEm") ?? "") || new Date().toISOString(),
  };
  lista.unshift(item);
  await salvarLista(lista);

  return NextResponse.json({ ok: true, id });
}
