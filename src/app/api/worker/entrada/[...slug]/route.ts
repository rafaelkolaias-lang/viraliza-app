import fs from "node:fs";
import path from "node:path";
import { workerAutorizado } from "@/lib/worker-auth";
import { UPLOADS_DIR } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrega um arquivo de entrada (mídia enviada pelo usuário) pro worker baixar.
 * Caminho: /api/worker/entrada/<jobId>/<videos|imagens|musica>/<arquivo>
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  if (!workerAutorizado(req)) {
    return new Response("não autorizado", { status: 401 });
  }

  const { slug } = await params;
  // bloqueia path traversal: nenhum segmento pode ser "..", vazio ou com barra
  if (
    !slug?.length ||
    slug.some((s) => !s || s === "." || s === ".." || s.includes("/") || s.includes("\\"))
  ) {
    return new Response("caminho inválido", { status: 400 });
  }

  const alvo = path.join(UPLOADS_DIR, ...slug);
  // garante que continua dentro de UPLOADS_DIR
  if (!alvo.startsWith(UPLOADS_DIR + path.sep)) {
    return new Response("caminho inválido", { status: 400 });
  }
  if (!fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) {
    return new Response("não encontrado", { status: 404 });
  }

  const buf = fs.readFileSync(alvo);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": `attachment; filename="${path.basename(alvo)}"`,
    },
  });
}
