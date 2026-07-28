import "server-only";

import { USOS_PRODUTO, CENARIOS, enDe } from "@/lib/avatar-modelo";

/**
 * Prompts das gerações image-to-image do "Meus avatares":
 *  - `promptAvatarDaFoto`: transforma a foto real da pessoa num retrato de avatar
 *    limpo e realista (mantendo a identidade), pra ela usar nos vídeos.
 *  - `promptAvatarComProduto`: coloca a pessoa (avatar/foto) usando o produto da
 *    foto enviada (segurando, passando no rosto/cabelo, vestindo...).
 * Tudo em inglês de propósito: o gpt-image-1 responde melhor. Ver openai-image.ts.
 */

// trechos de realismo reaproveitados (mesma pegada do avatar-json.ts)
const REALISMO =
  "ultra photorealistic, unedited RAW photo look, natural skin texture with visible pores and subtle imperfections, realistic individual hair strands, soft natural shadow transitions, natural film grain";

const PROIBIDO =
  "no beauty retouching, no skin smoothing, no plastic or waxy skin, no CGI, no 3D render, no illustration, no cartoon, no text, no watermark, no logo, no border, no collage, no multiple panels, a single photograph only";

/** Retrato de avatar a partir de UMA foto real da pessoa (image-to-image). */
export function promptAvatarDaFoto(): string {
  return [
    "Using the person in the provided photo, generate ONE single photorealistic vertical portrait of THIS SAME person, to be used as their virtual avatar.",
    "Keep the same identity: same face, same skin tone, same hair, same gender and apparent age. Do not beautify, do not change the ethnicity, do not slim the face. It must clearly look like the same real person.",
    "Reframe as a clean half body portrait, from the top of the head to the waist, the person centered and facing the camera, relaxed and with a light natural smile.",
    "Place them in a real lived-in Brazilian home softly out of focus behind them (natural bokeh), the person fully sharp.",
    "Everyday casual clothing, the kind a real person wears at home. Soft natural daylight, no flash, no studio light.",
    `Realism: ${REALISMO}.`,
    `Strictly avoid: ${PROIBIDO}.`,
    "Output: one single vertical photograph, 2:3, authentic natural photo, not a fashion editorial.",
  ].join("\n");
}

/**
 * Pessoa (1a imagem = avatar/foto) usando o PRODUTO (2a imagem). `uso` vem de
 * USOS_PRODUTO; `nomeProduto` é opcional (só ajuda a IA a entender o objeto);
 * `cenario` é a chave de CENARIOS (o fundo já sai na imagem, pra depois virar
 * vídeo de 15s sem precisar mandar cenário separado).
 */
export function promptAvatarComProduto(
  uso: string,
  nomeProduto?: string,
  cenario?: string,
): string {
  const comoUsa = enDe(USOS_PRODUTO, uso);
  const nome = (nomeProduto ?? "").trim();
  const cen = CENARIOS.find((c) => c.chave === cenario);
  // fundo: o cenário escolhido (desfocado) ou, se não escolheu, uma casa genérica
  const fundo = cen
    ? `Place them inside ${cen.local}, softly out of focus behind them (natural bokeh), the person and the product fully sharp. Lighting: ${cen.luz}.`
    : "Place them in a real lived-in home softly out of focus behind them (natural bokeh), the person and the product fully sharp. Soft natural daylight, no flash, no studio light.";

  return [
    "You are given two photos. The FIRST photo is a person. The SECOND photo is a product.",
    "Generate ONE single photorealistic vertical photograph of the SAME person from the first photo, now interacting with the EXACT product from the second photo.",
    nome
      ? `The product is: ${nome}. Keep it identical to the second photo (same shape, color, label and details).`
      : "Keep the product identical to the second photo (same shape, color, label and details).",
    "Keep the person's identity intact: same face, skin tone, hair, gender and age as the first photo. Do not beautify or change them.",
    `Interaction: ${comoUsa}.`,
    `Half body framing, the person centered and facing the camera with a natural friendly expression. ${fundo}`,
    "Everyday casual clothing. Hands must be anatomically correct with five fingers, never covering or distorting the product.",
    `Realism: ${REALISMO}.`,
    `Strictly avoid: ${PROIBIDO}. Do not invent a different product, do not add extra copies of it.`,
    "Output: one single vertical photograph, 2:3, authentic natural photo, like a real UGC review photo.",
  ].join("\n");
}
