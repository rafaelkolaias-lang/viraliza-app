import "server-only";

/**
 * Motor do "Vídeo com avatar": manda a geração pro robô do Grok que roda no
 * SERVERRK (container viraliza-grok: Chromium logado + Flask). O app faz
 * POST /gerar (rápido, devolve jobId) e depois vai fazendo GET /status/<id> até
 * ficar pronto (a geração leva minutos; o Cloudflare corta requisição em ~100s,
 * por isso o polling). O serverrk baixa o mp4 e salva na mídia; devolve a URL.
 * Env: GROK_INGEST_URL (https://grok-rk.univershoop.com) + GROK_INGEST_TOKEN.
 */

const BASE = (process.env.GROK_INGEST_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.GROK_INGEST_TOKEN || "";

export type ArquivoImagem = { bytes: Buffer; ext: string };

export type ResultadoVideo = {
  ok: boolean;
  videoUrl?: string; // URL http do serverrk (media.univershoop.com/avatares/<id>.mp4)
  thumbUrl?: string; // miniatura (JPG de 1 frame) gerada pelo serverrk, se saiu
  erro?: string;
  log?: string;
};

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function imgJson(a: ArquivoImagem) {
  return { mime: MIME[a.ext] ?? "image/png", base64: a.bytes.toString("base64") };
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Manda gerar o vídeo no robô do serverrk e espera ficar pronto. */
export async function gerarVideoGrok(opts: {
  prompt: string;
  avatar: ArquivoImagem;
  produtos: ArquivoImagem[];
  cenarioRef?: ArquivoImagem; // foto de referência do cenário (casa), opcional
  duracaoSeg: number;
  qualidade?: string; // "720p" (padrão) etc; o robô do serverrk seleciona no Grok
  semAudio?: boolean; // true = vídeo "sem fala" (desliga o áudio do Grok)
}): Promise<ResultadoVideo> {
  if (!BASE || !TOKEN) {
    return { ok: false, erro: "Motor de vídeo não configurado (GROK_INGEST_URL/TOKEN)." };
  }

  const imagens = [
    imgJson(opts.avatar),
    ...opts.produtos.map(imgJson),
    ...(opts.cenarioRef ? [imgJson(opts.cenarioRef)] : []),
  ];

  // 1. inicia a geração (rápido) -> jobId
  let jobId = "";
  try {
    const r = await fetch(`${BASE}/gerar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Grok-Token": TOKEN },
      body: JSON.stringify({
        prompt: opts.prompt,
        imagens,
        duracao: opts.duracaoSeg,
        qualidade: opts.qualidade || "720p",
        semAudio: !!opts.semAudio,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
    const d = (await r.json().catch(() => ({}))) as { jobId?: string; erro?: string };
    if (!r.ok || !d.jobId) {
      return { ok: false, erro: d.erro ?? "Não consegui iniciar a geração no servidor." };
    }
    jobId = d.jobId;
  } catch {
    return { ok: false, erro: "Sem conexão com o motor de vídeo." };
  }

  // 2. polling do status até pronto/erro. Janela grande porque agora tem FILA no
  // serverrk (um vídeo por vez): se tiver gente na frente, o nosso espera a vez.
  const inicio = Date.now();
  while (Date.now() - inicio < 1_500_000) {
    await dormir(6_000);
    try {
      const s = (await fetch(`${BASE}/status/${jobId}`, {
        headers: { "X-Grok-Token": TOKEN },
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      }).then((x) => x.json())) as {
        status?: string;
        videoUrl?: string;
        thumbUrl?: string;
        erro?: string;
      };
      if (s.status === "pronto" && s.videoUrl) {
        return { ok: true, videoUrl: s.videoUrl, thumbUrl: s.thumbUrl };
      }
      if (s.status === "erro") return { ok: false, erro: s.erro ?? "Falha ao gerar o vídeo." };
    } catch {
      // hiccup de rede num poll: tenta de novo no próximo ciclo
    }
  }
  return { ok: false, erro: "O vídeo demorou demais. Tente de novo." };
}
