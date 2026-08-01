import "server-only";

import { estiloPorChave } from "@/lib/estilos-camera";
import { CENARIOS } from "@/lib/avatar-modelo";

/**
 * Prompt da IMAGEM do Viraliza Lab (o que vai pro Grok Imagine).
 *
 * A espinha dorsal vem do material da aula: IDENTIDADE BLOQUEADA (a pessoa e o
 * produto das fotos são referência RÍGIDA, é proibido recriar/estilizar), bloco
 * de REALISMO (RAW, poros, grão, 85mm) e uma lista de EVITAR (facial drift,
 * retoque de beleza, CGI, texto, marca d'água). Em inglês de propósito: os
 * geradores respondem melhor.
 */

const REALISMO =
  "PHOTOREALISM: unedited RAW photo look, shot on a full frame camera with an 85mm f/1.8 lens, natural skin texture with visible pores and small natural imperfections, individual hair strands, realistic fabric folds and material response, soft natural shadow transitions, subtle film grain, realistic color grading, shallow natural depth of field.";

const EVITAR =
  "AVOID: face drift, a different or generic face, beauty or glamour retouching, skin smoothing, plastic or waxy skin, slimming the face or body, changing the hair, CGI or 3D render look, illustration, cartoon, AI artifacts, oversharpening, editorial color grading, extra copies of the product, invented products, changed colors or labels, text, captions, logo overlay, watermark, borders, collage, multiple panels.";

const VALIDACAO =
  "BEFORE FINISHING: compare the result with the reference photos. If the person is not clearly the same person, or the product is not identical to its photo, discard and redo. Output ONE single vertical photograph, 9:16, like a real photo taken by a Brazilian creator at home.";

export type OpcoesImagemLab = {
  estilo: string; // chave de ESTILOS_CAMERA
  cena: string; // descrição escrita pela pessoa (posição/enquadramento)
  cenario: string; // chave de CENARIOS_LAB
  cenarioTexto?: string; // quando a pessoa escolheu "Outros"
  cenarioMotor?: string; // chave equivalente em CENARIOS (quando existe)
  cenarioLivre?: string; // descrição do cenário quando não tem equivalente
  comAvatar: boolean; // false = POV/sem pessoa (só as mãos ou só o produto)
  produtoNome?: string;
  /** enquadramento da variação escolhida (POV: mãos segurando ou produto parado) */
  variacaoExtra?: string;
  /** true no POV "produto parado": nem as mãos podem aparecer */
  semMaos?: boolean;
};

/** Bloco do cenário: usa a descrição rica de CENARIOS quando existir. */
function blocoCenario(o: OpcoesImagemLab): string {
  const doMotor = o.cenarioMotor ? CENARIOS.find((c) => c.chave === o.cenarioMotor) : null;
  if (doMotor) {
    return `SETTING: ${doMotor.local}, softly out of focus behind the subject (natural bokeh) while the person and the product stay perfectly sharp. Lighting: ${doMotor.luz}.`;
  }
  const livre = (o.cenarioTexto || o.cenarioLivre || "").trim();
  if (livre) {
    return `SETTING: ${livre}, softly out of focus behind the subject (natural bokeh) while the person and the product stay perfectly sharp. Natural believable lighting for that place.`;
  }
  return "SETTING: a real lived-in Brazilian home softly out of focus behind the subject, the person and the product perfectly sharp. Soft natural daylight, no flash, no studio light.";
}

/**
 * Monta o prompt final. `comAvatar` muda a leitura das imagens anexadas:
 *  - com avatar: 1ª foto = PESSOA (identidade travada), 2ª = PRODUTO
 *  - sem avatar: a única foto anexada é o PRODUTO
 */
export function montarPromptImagemLab(o: OpcoesImagemLab): string {
  const estilo = estiloPorChave(o.estilo);
  const linhas: string[] = [];

  // ABERTURA = a regra que mais importa. O Grok dá muito mais peso ao começo e ao
  // fim do prompt, então a identidade entra nas DUAS pontas (aprendizado: quando
  // ela ficava só no meio, o rosto saía "parecido", não igual).
  if (o.comAvatar) {
    linhas.push(
      "KEEP THE FACE OF THE FIRST PHOTO. This is a real person and the first photo is her official identity reference. Do NOT redraw her, do NOT reinterpret her, do NOT generate a similar looking person: use HER face, exactly as it is.",
    );
    linhas.push(
      "Same face shape, same jawline, same nose, same eyes and eye spacing, same eyebrows, same lips, same teeth, same skin tone and freckles or marks, same hair color, texture, length and parting, same apparent age, same ethnicity, same body type, same glasses, jewelry, piercings and tattoos. No beautifying, no slimming, no younger face, no makeup added, no different haircut.",
    );
  } else if (o.semMaos) {
    linhas.push(
      "NO PEOPLE in this image: no face, no body, no hands, not even a finger or an arm at the edge of the frame. The product is alone in the scene.",
    );
  } else {
    linhas.push(
      "No face and no identity needed: the person is anonymous, only hands may appear, with natural realistic skin.",
    );
  }

  linhas.push(
    o.comAvatar
      ? "Second photo = the PRODUCT."
      : "The photo given = the PRODUCT.",
  );
  linhas.push(
    `Copy the product exactly as it is: same shape, color, material, texture, seams, prints, labels and logos. Never redraw a print or a logo, never change the color, never add extra units.${
      o.produtoNome ? ` It is: ${o.produtoNome}.` : ""
    } If the photo shows several colors or variants, use ONE only, the same one everywhere.`,
  );

  linhas.push(`Scene: ${o.cena.trim()}`);

  if (o.variacaoExtra) linhas.push(o.variacaoExtra);
  else if (estilo?.extra) linhas.push(estilo.extra);
  else if (estilo)
    linhas.push(`${estilo.label} shot, product clearly visible and well lit, natural pose.`);

  linhas.push(blocoCenario(o));
  linhas.push(REALISMO);
  linhas.push(
    "It must look like a real photo taken by a Brazilian creator with a phone, not a studio campaign and not a fashion editorial.",
  );
  linhas.push(EVITAR);

  // FECHAMENTO = repete as travas que mais falham, agora como critério de aprovação.
  // O Grok obedece muito mais o fim do prompt, então o corpo inteiro volta aqui:
  // com peça de roupa ele teimava em cortar na cintura quando a foto do avatar era
  // um retrato.
  const corpoInteiro = estilo?.chave === "vestindo" || estilo?.chave === "espelho";
  linhas.push(
    [
      o.comAvatar
        ? "FINAL CHECK, the most important one: put the two images side by side. If the face is not clearly the SAME WOMAN from the first photo (or the same man), the image is wrong: redo it keeping her exact face."
        : "FINAL CHECK:",
      "The product must be identical to its photo.",
      o.semMaos ? "If any hand, arm or person appears in the frame, the image is wrong: redo it with the product alone." : "",
      corpoInteiro
        ? "The framing MUST be full body, head to shoes, with the worn product completely visible and not cropped: if the legs or the feet are cut off, the image is wrong, redo it wider."
        : "",
      "Output ONE single vertical photograph, 9:16.",
    ]
      .filter(Boolean)
      .join(" "),
  );

  // uma linha só: no campo do Grok cada quebra vira Enter (envia antes da hora)
  return linhas.join(" ").replace(/\s*\n+\s*/g, " ").trim();
}
