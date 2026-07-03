import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serve mídia gravada em RUNTIME (o Next só serve estáticos do build).
const PUBLIC = path.join(process.cwd(), "public");
const PERMITIDOS = new Set([
  "virais",
  "produtos",
  "videos",
  "downloads",
  "voice-previews",
]);

const CONTENT_TYPE: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".mp3": "audio/mpeg",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  if (
    !slug?.length ||
    !PERMITIDOS.has(slug[0]) ||
    slug.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"))
  ) {
    return new Response("inválido", { status: 400 });
  }

  const alvo = path.join(PUBLIC, ...slug);
  if (!alvo.startsWith(PUBLIC + path.sep)) {
    return new Response("inválido", { status: 400 });
  }
  if (!existsSync(alvo) || !statSync(alvo).isFile()) {
    return new Response("não encontrado", { status: 404 });
  }

  const size = statSync(alvo).size;
  const ext = path.extname(alvo).toLowerCase();
  const contentType = CONTENT_TYPE[ext] ?? "application/octet-stream";

  // ?dl=1 força o download (Content-Disposition: attachment) - faz o mobile baixar
  // em vez de só abrir. ?nome define o nome do arquivo salvo.
  const url = new URL(req.url);
  let disposition: string | undefined;
  if (url.searchParams.get("dl")) {
    const bruto =
      (url.searchParams.get("nome") || path.basename(alvo))
        .replace(/[^\w.\- ]+/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 80) || "arquivo";
    const nomeFinal = bruto.includes(".") ? bruto : `${bruto}${ext || ".mp4"}`;
    disposition = `attachment; filename="${nomeFinal}"`;
  }

  // Range: necessário pra vídeo (preview/seek) e pra arquivos grandes
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (start >= size || end >= size || start > end) {
      return new Response("range inválido", {
        status: 416,
        headers: { "content-range": `bytes */${size}` },
      });
    }
    const stream = createReadStream(alvo, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        "content-type": contentType,
        "content-range": `bytes ${start}-${end}/${size}`,
        "accept-ranges": "bytes",
        "content-length": String(end - start + 1),
        "cache-control": "public, max-age=3600",
        ...(disposition ? { "content-disposition": disposition } : {}),
      },
    });
  }

  const stream = createReadStream(alvo);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "content-type": contentType,
      "content-length": String(size),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=3600",
      ...(disposition ? { "content-disposition": disposition } : {}),
    },
  });
}
