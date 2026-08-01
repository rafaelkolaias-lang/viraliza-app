import "server-only";

/**
 * Geração de IMAGEM no robô do Grok (serverrk). Usa a rota /gerar-imagem do
 * container viraliza-grok, que roda na conta RESERVA de propósito: a conta
 * principal fica livre pros vídeos. Mesmo padrão do video-robot.ts (POST rápido
 * devolve jobId, depois polling do /status).
 *
 * Quem chama trata o null como "não deu": aí o Lab cai no gpt-image da OpenAI.
 */

const BASE = (process.env.GROK_INGEST_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.GROK_INGEST_TOKEN || "";
// Conta do Grok que gera IMAGEM. O plano é usar a reserva ("antiga") pra deixar a
// principal livre pros vídeos, mas enquanto a reserva não estiver logada usamos a
// "nova". Trocar por env, sem deploy: GROK_CONTA_IMAGEM=antiga.
const CONTA_IMAGEM = process.env.GROK_CONTA_IMAGEM || "nova";

export type ImagemEnvio = { base64: string; mime: string };

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function grokImagemConfigurado(): boolean {
  return !!BASE && !!TOKEN;
}

/** Gera a imagem no Grok e devolve a URL hospedada no serverrk. null se falhar. */
export async function gerarImagemGrok(opts: {
  prompt: string;
  imagens: ImagemEnvio[];
  conta?: "antiga" | "nova"; // padrão: a reserva (definida no servidor)
  limiteMs?: number;
}): Promise<{ imagemUrl: string } | null> {
  if (!grokImagemConfigurado() || opts.imagens.length === 0) return null;

  let jobId = "";
  try {
    const r = await fetch(`${BASE}/gerar-imagem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Grok-Token": TOKEN },
      body: JSON.stringify({
        prompt: opts.prompt,
        imagens: opts.imagens,
        conta: opts.conta ?? CONTA_IMAGEM,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    const d = (await r.json().catch(() => ({}))) as { jobId?: string };
    if (!r.ok || !d.jobId) return null;
    jobId = d.jobId;
  } catch {
    return null;
  }

  const limite = opts.limiteMs ?? 300_000; // 5 min: imagem é bem mais rápida que vídeo
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    await dormir(5_000);
    try {
      const s = (await fetch(`${BASE}/status/${jobId}`, {
        headers: { "X-Grok-Token": TOKEN },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }).then((x) => x.json())) as { status?: string; imagemUrl?: string };
      if (s.status === "pronto" && s.imagemUrl) return { imagemUrl: s.imagemUrl };
      if (s.status === "erro") return null;
    } catch {
      // soluço de rede num poll: tenta no próximo ciclo
    }
  }
  return null;
}
