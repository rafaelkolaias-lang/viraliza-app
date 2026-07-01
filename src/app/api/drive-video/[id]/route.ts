import { getCurrentUser } from "@/lib/dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// id do Drive: letras, números, - e _ (>= 10 chars).
const ID_RE = /^[a-zA-Z0-9_-]{10,}$/;

/**
 * Proxy MESMA-ORIGEM de um vídeo do Google Drive.
 *
 * Serve pro "Editar esse": o Editor baixa o vídeo via fetch() no navegador pra
 * fazer uma CÓPIA local (o original da plataforma nunca é tocado). Buscar o Drive
 * direto no cliente esbarra em CORS; por isso o download passa por aqui (servidor
 * baixa do Drive e devolve os bytes na mesma origem). Exige login.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("faça login", { status: 401 });

  const { id } = await params;
  if (!ID_RE.test(id)) return new Response("id inválido", { status: 400 });

  // endpoint de download direto do Drive (confirm=t pula o aviso de arquivo grande)
  const upstream = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  let r: Response;
  try {
    r = await fetch(upstream, { redirect: "follow" });
  } catch {
    return new Response("falha ao buscar no Drive", { status: 502 });
  }
  if (!r.ok || !r.body) return new Response("vídeo indisponível", { status: 502 });

  const ct = r.headers.get("content-type") || "";
  // se o Drive devolveu HTML (interstício/erro), não é o vídeo
  if (ct.includes("text/html")) {
    return new Response("vídeo indisponível", { status: 502 });
  }

  const len = r.headers.get("content-length");
  return new Response(r.body, {
    headers: {
      "content-type": ct.includes("video") ? ct : "video/mp4",
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
      ...(len ? { "content-length": len } : {}),
    },
  });
}
