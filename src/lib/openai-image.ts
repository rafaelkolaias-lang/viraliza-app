import "server-only";

/**
 * Motor de imagem do "Meus avatares": gera a foto do avatar com o gpt-image-1 da
 * OpenAI. Recebe o prompt de texto (montado a partir do quiz) e devolve os bytes
 * PNG (base64). Quem hospeda a foto depois e o serverrk (ver serverrk-upload.ts).
 */

const ENDPOINT = "https://api.openai.com/v1/images/generations";

export function openaiConfigurado(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type ImagemGerada = { base64: string; mime: string };

/** Gera 1 imagem com o gpt-image-1. Retorna null se faltar chave ou a API falhar. */
export async function gerarImagem(prompt: string): Promise<ImagemGerada | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const body = {
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    prompt,
    n: 1,
    size: process.env.OPENAI_IMAGE_SIZE || "1024x1536",
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[openai-image] falhou", res.status, txt.slice(0, 400));
      return null;
    }
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;
    return { base64: b64, mime: "image/png" };
  } catch (e) {
    console.error("[openai-image] erro de rede/timeout", e);
    return null;
  }
}
