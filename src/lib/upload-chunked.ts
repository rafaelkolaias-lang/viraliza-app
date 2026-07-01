/**
 * Upload em pedaços (chunked) pro /api/jobs.
 *
 * Em vez de mandar o arquivo inteiro num POST (que estoura o limite de ~100MB do
 * Cloudflare e a RAM do container), a gente:
 *   1. cria o job como rascunho (POST /api/jobs com chunked=1) → pega o id;
 *   2. manda cada arquivo em pedaços de 8MB (POST /api/jobs/[id]/chunk);
 *   3. finaliza (POST /api/jobs/[id]/pronto) → o job entra na fila.
 */

export type SubEnvio = "videos" | "imagens" | "musica" | "template";
export type ArquivoEnvio = { sub: SubEnvio; file: File };

const TAM_PEDACO = 8 * 1024 * 1024; // 8MB

async function erroDe(res: Response, padrao: string): Promise<string> {
  const d = (await res.json().catch(() => ({}))) as { erro?: string };
  return d.erro ?? padrao;
}

export async function enviarJobEmPedacos(
  meta: Record<string, string>,
  arquivos: ArquivoEnvio[],
  onProgress?: (fracao: number) => void,
): Promise<string> {
  // 1. cria o rascunho
  const fd = new FormData();
  fd.set("chunked", "1");
  for (const [k, v] of Object.entries(meta)) fd.set(k, v);
  const res = await fetch("/api/jobs", { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { id?: string; erro?: string };
  if (!res.ok || !data.id) {
    throw new Error(data.erro ?? "Não consegui iniciar o envio.");
  }
  const id = data.id;

  const totalBytes = arquivos.reduce((s, a) => s + a.file.size, 0) || 1;
  let enviados = 0;

  // 2. cada arquivo em pedaços
  for (const { sub, file } of arquivos) {
    const partes = Math.max(1, Math.ceil(file.size / TAM_PEDACO));
    for (let i = 0; i < partes; i++) {
      const pedaco = file.slice(i * TAM_PEDACO, (i + 1) * TAM_PEDACO);
      const q = new URLSearchParams({ sub, nome: file.name, parte: String(i) });
      const r = await fetch(`/api/jobs/${id}/chunk?${q.toString()}`, {
        method: "POST",
        body: pedaco,
      });
      if (!r.ok) throw new Error(await erroDe(r, "Falha ao enviar um pedaço."));
      enviados += pedaco.size;
      onProgress?.(enviados / totalBytes);
    }
  }

  // 3. finaliza → entra na fila
  const rf = await fetch(`/api/jobs/${id}/pronto`, { method: "POST" });
  if (!rf.ok) throw new Error(await erroDe(rf, "Falha ao finalizar o envio."));
  return id;
}
