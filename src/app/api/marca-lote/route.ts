import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { getCurrentUser } from "@/lib/dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A logo/marca salva por usuário (uma só). Fica fora do public - só o dono lê/usa.
const MARCAS_DIR = path.join(process.cwd(), "data", "marcas");
const MAX_ARQUIVO = 20 * 1024 * 1024; // 20MB (é uma imagem)
const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function pastaDoDono(userId: string) {
  return path.join(MARCAS_DIR, userId);
}
function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "logo.png";
}
async function arquivoSalvo(userId: string): Promise<string | null> {
  try {
    const dir = pastaDoDono(userId);
    const arquivos = await fs.readdir(dir);
    const primeiro = arquivos.find((n) => CONTENT_TYPE[path.extname(n).toLowerCase()]);
    return primeiro ? path.join(dir, primeiro) : null;
  } catch {
    return null;
  }
}

/** GET: devolve a logo salva do usuário (pra prévia + reuso). 204 se não tem. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const alvo = await arquivoSalvo(user.id);
  if (!alvo) return new Response(null, { status: 204 });

  const ext = path.extname(alvo).toLowerCase();
  const contentType = CONTENT_TYPE[ext] ?? "application/octet-stream";
  const stream = createReadStream(alvo);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="${path.basename(alvo)}"`,
      "cache-control": "no-store",
    },
  });
}

/** POST: salva/substitui a logo do usuário. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const form = await req.formData();
  const arq = form.getAll("logo").filter((f): f is File => f instanceof File)[0];
  if (!arq) return NextResponse.json({ erro: "Envie a imagem." }, { status: 400 });
  if (!arq.type.startsWith("image/")) {
    return NextResponse.json({ erro: "Só imagem (PNG de preferência)." }, { status: 400 });
  }
  if (arq.size > MAX_ARQUIVO) {
    return NextResponse.json({ erro: "Imagem grande demais." }, { status: 400 });
  }

  const dir = pastaDoDono(user.id);
  // limpa a antiga e grava a nova (uma logo por conta)
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(dir, { recursive: true });
  const nome = nomeSeguro(arq.name);
  const buf = Buffer.from(await arq.arrayBuffer());
  await fs.writeFile(path.join(dir, nome), buf);

  return NextResponse.json({ ok: true, nome });
}

/** DELETE: remove a logo salva. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  await fs.rm(pastaDoDono(user.id), { recursive: true, force: true }).catch(() => {});
  return NextResponse.json({ ok: true });
}
