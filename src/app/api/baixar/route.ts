import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy de DOWNLOAD (same-origin) que força o navegador a baixar o arquivo.
 *
 * O `download` de um <a> é IGNORADO quando o link é de outro domínio
 * (ex.: media.univershoop.com), então no celular (iOS/Android) o arquivo só
 * abria em vez de baixar. Aqui a gente busca o arquivo no servidor e devolve
 * com Content-Disposition: attachment - aí o mobile baixa de verdade.
 *
 * Serve VÍDEO e IMAGEM: a extensão do arquivo baixado sai do tipo real do
 * conteúdo (senão a galeria de imagens baixava tudo como .mp4 - "vídeo" que na
 * verdade é foto).
 *
 * Segurança: só busca de hosts nossos/confiáveis (anti open-proxy/SSRF).
 */
const HOSTS_OK = new Set([
  "media.univershoop.com",
  "drive.google.com",
  "lh3.googleusercontent.com",
]);

/** content-type -> extensão do arquivo salvo. */
const EXT_POR_TIPO: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Extensão de mídia achada na própria URL (fallback quando falta content-type). */
function extDaUrl(caminho: string): string | null {
  const m = /\.(mp4|webm|mov|jpe?g|png|webp|gif)(?:$|\?)/i.exec(caminho);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}

function nomeArquivo(nome: string | null, ext: string): string {
  let base =
    (nome || "arquivo")
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "arquivo";
  // tira uma extensão de mídia que já veio no nome (ex.: "imagem-viraliza.png"),
  // pra não gerar "imagem-viraliza.png.jpg"
  base = base.replace(/\.(mp4|webm|mov|jpe?g|png|webp|gif)$/i, "");
  return `${base}.${ext}`;
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
    return new Response("falha ao buscar o arquivo", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("arquivo indisponível", { status: 502 });
  }

  const tipo = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  // extensão: pelo tipo real primeiro, depois pela URL, e mp4 só como último caso
  const ext = EXT_POR_TIPO[tipo] || extDaUrl(alvo.pathname) || "mp4";

  const headers = new Headers();
  headers.set("content-type", tipo || "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  headers.set("content-disposition", `attachment; filename="${nomeArquivo(nome, ext)}"`);
  headers.set("cache-control", "private, no-store");

  return new Response(upstream.body, { status: 200, headers });
}
