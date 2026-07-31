import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ImagemEntrada } from "@/lib/openai-image";

/**
 * Helpers pra transformar as fotos que chegam do front em ImagemEntrada
 * ({ base64, mime }) que o gpt-image-1 aceita: a pessoa manda o produto/rosto como
 * data URL (base64) e o avatar salvo vem como URL http (baixamos do serverrk).
 */

const MIMES_OK = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 12 * 1024 * 1024; // 12MB por imagem, o suficiente pra foto de celular

/** Converte um data URL (data:image/png;base64,....) em ImagemEntrada. Null se inválido. */
export function dataUrlParaEntrada(dataUrl?: string): ImagemEntrada | null {
  if (!dataUrl) return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = m[1].toLowerCase();
  if (!MIMES_OK.includes(mime)) return null;
  const base64 = m[2];
  if (Buffer.byteLength(base64, "base64") > MAX_BYTES) return null;
  return { base64, mime: mime === "image/jpg" ? "image/jpeg" : mime };
}

/** Baixa uma imagem (avatar salvo no serverrk OU um avatar PRONTO da plataforma,
 *  que é arquivo local em public, ex: /avatares/yasmin.jpg). Null se falhar. */
export async function baixarImagemEntrada(url?: string): Promise<ImagemEntrada | null> {
  if (!url) return null;
  // caminho local do app (avatares prontos em public): lê direto do disco
  if (url.startsWith("/")) {
    try {
      const rel = url.replace(/^\/+/, "").replace(/\.\./g, "");
      const abs = path.join(process.cwd(), "public", rel);
      const buf = await readFile(abs);
      if (buf.length === 0 || buf.length > MAX_BYTES) return null;
      const ext = path.extname(abs).toLowerCase();
      const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
      return { base64: buf.toString("base64"), mime };
    } catch {
      return null;
    }
  }
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const mimeBruto = (res.headers.get("content-type") || "image/png").split(";")[0].trim().toLowerCase();
    const mime = MIMES_OK.includes(mimeBruto) ? (mimeBruto === "image/jpg" ? "image/jpeg" : mimeBruto) : "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;
    return { base64: buf.toString("base64"), mime };
  } catch {
    return null;
  }
}
