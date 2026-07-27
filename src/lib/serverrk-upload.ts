import "server-only";

import { MEDIA_BASE } from "@/lib/midia-shopee";

/**
 * Sobe um arquivo gerado (avatar) pro serverrk, que hospeda toda a midia. O nginx
 * de la (viraliza-media) aceita PUT autenticado em /avatares/ (DAV) e serve o
 * arquivo publico em media.univershoop.com/avatares/<nome>. Assim o avatar segue
 * o mesmo caminho da midia Shopee, sem guardar bytes no banco nem no disco do app.
 */

/** Faz PUT dos bytes em /avatares/<nome> no serverrk. Retorna a URL publica ou null. */
export async function subirAvatar(
  nomeArquivo: string,
  bytes: Buffer,
  mime = "image/png",
): Promise<string | null> {
  const token = process.env.AVATAR_INGEST_TOKEN;
  if (!token) {
    console.error("[serverrk-upload] AVATAR_INGEST_TOKEN ausente");
    return null;
  }
  const nome = nomeArquivo.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  const url = `${MEDIA_BASE}/avatares/${nome}`;
  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Ingest-Token": token,
        "Content-Type": mime,
      },
      body: new Uint8Array(bytes),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status !== 201 && res.status !== 204) {
      const txt = await res.text().catch(() => "");
      console.error("[serverrk-upload] PUT falhou", res.status, txt.slice(0, 200));
      return null;
    }
    return url;
  } catch (e) {
    console.error("[serverrk-upload] erro de rede/timeout", e);
    return null;
  }
}
