import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy de DOWNLOAD (same-origin) que força o navegador a baixar o arquivo.
 *
 * O `download` de um <a> é IGNORADO quando o link é de outro domínio
 * (ex.: media.univershoop.com), então no celular (iOS/Android) o vídeo só
 * abria em vez de baixar. Aqui a gente busca o arquivo no servidor e devolve
 * com Content-Disposition: attachment - aí o mobile baixa de verdade.
 *
 * Segurança: só busca de hosts nossos/confiáveis (anti open-proxy/SSRF).
 */
const HOSTS_OK = new Set([
  "media.univershoop.com",
  "drive.google.com",
  "lh3.googleusercontent.com",
]);

function nomeArquivo(nome: string | null): string {
  const base =
    (nome || "video")
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "video";
  return base.toLowerCase().endsWith(".mp4") ? base : `${base}.mp4`;
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  const nome = req.nextUrl.searchParams.get("nome");
  if (!u) return new Response("faltou a url", { status: 400 });

  let alvo: URL;
  try {
    alvo = new URL(u);
  } catch {
    return new Response("url inválida", { status: 400 });
  }
  if (alvo.protocol !== "https:" || !HOSTS_OK.has(alvo.hostname)) {
    return new Response("host não permitido", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(alvo.toString(), { redirect: "follow", cache: "no-store" });
  } catch {
    return new Response("falha ao buscar o vídeo", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("vídeo indisponível", { status: 502 });
  }

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") || "video/mp4");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  headers.set("content-disposition", `attachment; filename="${nomeArquivo(nome)}"`);
  headers.set("cache-control", "private, no-store");

  return new Response(upstream.body, { status: 200, headers });
}
