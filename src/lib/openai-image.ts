import "server-only";

/**
 * Motor de imagem do "Meus avatares": gera a foto do avatar com o gpt-image-1 da
 * OpenAI. Recebe o prompt de texto (montado a partir do quiz) e devolve os bytes
 * PNG (base64). Quem hospeda a foto depois e o serverrk (ver serverrk-upload.ts).
 */

const ENDPOINT = "https://api.openai.com/v1/images/generations";
const ENDPOINT_EDIT = "https://api.openai.com/v1/images/edits";

export function openaiConfigurado(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type ImagemGerada = { base64: string; mime: string };
export type ImagemEntrada = { base64: string; mime: string };

/** Gera 1 imagem com o gpt-image-1. Retorna null se faltar chave ou a API falhar. */
export async function gerarImagem(prompt: string): Promise<ImagemGerada | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const body = {
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
    prompt,
    n: 1,
    size: process.env.OPENAI_IMAGE_SIZE || "1024x1536",
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    // "low" afrouxa só os FALSOS positivos do filtro (ex: short feminino de corpo
    // inteiro era bloqueado como "sexual"). Conteúdo realmente impróprio segue barrado.
    moderation: process.env.OPENAI_IMAGE_MODERATION || "low",
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

/**
 * Edita/combina imagens com o gpt-image-1 (image-to-image). Recebe o prompt + as
 * fotos de entrada (a 1a e a "base": rosto da pessoa ou avatar; as seguintes sao
 * referencia, ex: a foto do produto) e devolve os bytes PNG. Usado no "avatar da
 * minha foto" e no "avatar com produto". Retorna null se faltar chave ou a API falhar.
 */
export async function editarImagem(
  prompt: string,
  imagens: ImagemEntrada[],
): Promise<ImagemGerada | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || imagens.length === 0) return null;

  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5");
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("size", process.env.OPENAI_IMAGE_SIZE || "1024x1536");
  form.append("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
  // preserva a identidade da pessoa da foto (rosto, cabelo, corpo): sem isso o
  // modelo "recriava" a pessoa e ela saía diferente. Só existe no gpt-image-1/1.5.
  form.append("input_fidelity", process.env.OPENAI_IMAGE_FIDELITY || "high");
  // mesmo motivo do gerarImagem: sem isso, roupa feminina (short, saia) de corpo
  // inteiro tomava moderation_blocked "sexual" na SAÍDA (falso positivo).
  form.append("moderation", process.env.OPENAI_IMAGE_MODERATION || "low");
  for (const img of imagens) {
    const ext = /jpe?g/i.test(img.mime) ? "jpg" : /webp/i.test(img.mime) ? "webp" : "png";
    const blob = new Blob([Buffer.from(img.base64, "base64")], { type: img.mime });
    // gpt-image-1 aceita varias imagens de entrada no campo "image[]"
    form.append("image[]", blob, `entrada.${ext}`);
  }

  try {
    const res = await fetch(ENDPOINT_EDIT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[openai-image] edits falhou", res.status, txt.slice(0, 400));
      return null;
    }
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return null;
    return { base64: b64, mime: "image/png" };
  } catch (e) {
    console.error("[openai-image] edits erro de rede/timeout", e);
    return null;
  }
}
