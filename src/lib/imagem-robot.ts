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

/**
 * Coloca a imagem na fila do robô e devolve o jobId NA HORA (sem esperar ficar
 * pronta). É o que permite a rota responder rápido em vez de segurar a conexão
 * do navegador durante a fila inteira, que é o que fazia o celular derrubar o
 * pedido com "Load failed".
 */
export async function dispararImagemGrok(opts: {
  prompt: string;
  imagens: ImagemEnvio[];
  conta?: "antiga" | "nova";
}): Promise<string | null> {
  if (!grokImagemConfigurado()) return null;
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
    return d.jobId;
  } catch {
    return null;
  }
}

export type StatusImagem =
  | { status: "gerando" }
  | { status: "pronto"; imagemUrl: string }
  | { status: "erro" };

/** Pergunta ao robô como está aquele jobId. "gerando" também cobre o soluço de
 *  rede: quem chama simplesmente pergunta de novo no próximo ciclo. */
export async function statusImagemGrok(jobId: string): Promise<StatusImagem> {
  if (!grokImagemConfigurado() || !jobId) return { status: "erro" };
  try {
    const s = (await fetch(`${BASE}/status/${jobId}`, {
      headers: { "X-Grok-Token": TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    }).then((x) => x.json())) as { status?: string; imagemUrl?: string };
    if (s.status === "pronto" && s.imagemUrl) return { status: "pronto", imagemUrl: s.imagemUrl };
    if (s.status === "erro") return { status: "erro" };
    return { status: "gerando" };
  } catch {
    return { status: "gerando" };
  }
}

/** Gera a imagem no Grok e devolve a URL hospedada no serverrk. null se falhar.
 *  Espera até ficar pronta, então só serve pra quem pode segurar a chamada. */
export async function gerarImagemGrok(opts: {
  prompt: string;
  imagens: ImagemEnvio[];
  conta?: "antiga" | "nova"; // padrão: a reserva (definida no servidor)
  limiteMs?: number;
}): Promise<{ imagemUrl: string } | null> {
  // sem imagem também vale: o influenciador nasce só do texto do prompt
  const jobId = await dispararImagemGrok(opts);
  if (!jobId) return null;

  const limite = opts.limiteMs ?? 300_000; // 5 min: imagem é bem mais rápida que vídeo
  const inicio = Date.now();
  while (Date.now() - inicio < limite) {
    await dormir(5_000);
    const s = await statusImagemGrok(jobId);
    if (s.status === "pronto") return { imagemUrl: s.imagemUrl };
    if (s.status === "erro") return null;
  }
  return null;
}
