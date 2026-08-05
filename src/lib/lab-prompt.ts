import "server-only";

import { estiloPorChave, categoriaDoProduto } from "@/lib/estilos-camera";
import { CENARIOS } from "@/lib/avatar-modelo";

/**
 * Prompt da IMAGEM do Viraliza Lab (o que vai pro Grok Imagine).
 *
 * A espinha dorsal vem do material da aula (identidade bloqueada, realismo RAW,
 * lista de EVITAR) mais as técnicas que levantamos na engenharia de prompt do
 * TikShopfy, que resolvem falhas que a gente já tinha apanhado:
 *
 *  1. SANDUÍCHE DE PRIORIDADE: a instrução crítica abre E fecha o prompt, porque
 *     no meio de um prompt longo a atenção do modelo afunda.
 *  2. FATIAR O QUE CADA REFERÊNCIA GOVERNA: a foto da pessoa manda SÓ na
 *     identidade; no estilo "vestindo" a roupa dela é substituída pelo produto e
 *     as cores originais são proibidas de vazar.
 *  3. REGRA POR TIPO DE PRODUTO: roupa, líquido, kit e eletrônico têm regras de
 *     exibição diferentes; um texto genérico não cobre os quatro.
 *  4. SAÍDA LIMPA COM REGRA DE DESEMPATE: em vez de listar todo efeito possível,
 *     diz pra que lado errar ("na dúvida, não coloque").
 *
 * Em inglês de propósito: os geradores de imagem respondem melhor.
 */

const REALISMO =
  "PHOTOREALISM: unedited RAW photo look, shot on a modern phone main camera, crisp 4K detail, EVERYTHING IN SHARP FOCUS from the person to the back wall (deep depth of field, like a phone photo in good light), natural skin texture with visible pores and small natural imperfections, individual hair strands, realistic fabric folds and material response, soft natural shadow transitions, subtle film grain, realistic color grading.";

const EVITAR =
  "AVOID: face drift, a different or generic face, beauty or glamour retouching, skin smoothing, plastic or waxy skin, slimming the face or body, changing the hair, CGI or 3D render look, illustration, cartoon, AI artifacts, oversharpening, editorial color grading, blurred or out of focus background, bokeh, depth of field haze, milky blur, extra copies of the product, invented products, changed colors or labels, text, captions, logo overlay, watermark, borders, collage, multiple panels.";

const SAIDA_LIMPA =
  "CLEAN OUTPUT, NON NEGOTIABLE: no text of any kind on the image (captions, labels added by you, watermarks, credits), no stickers, no badges, no arrows, no app UI, no frames, no artificial effects (sparkles, glow, floating particles, lens flares). If you are in doubt about adding anything on top of the photo, DO NOT add it: the clean photo always wins.";

/**
 * Regra de exibição por tipo de produto. Vem do `physical_type` do TikShopfy,
 * adaptado às nossas categorias: cada tipo falha de um jeito diferente (roupa
 * amassada, garrafa deitada, kit com item escondido).
 */
const REGRA_POR_CATEGORIA: Record<string, string> = {
  vestivel:
    "PRODUCT DISPLAY RULE (wearable): the item must be worn naturally on the body, or held up open by the shoulders or collar so the FRONT of the design faces the camera and is fully visible. Never crumpled, never folded, never bunched up.",
  beleza:
    "PRODUCT DISPLAY RULE (cosmetic or liquid): keep the bottle, jar or tube UPRIGHT with the label facing the camera, never tilted and never upside down, cap closed, clean and unopened.",
  eletronico:
    "PRODUCT DISPLAY RULE (device): hold it firmly with the main face, screen or label pointing straight at the camera, so its most recognizable feature is the first thing you see.",
  casa:
    "PRODUCT DISPLAY RULE (home item): show it in its natural position of use, complete and stable, with the most distinctive part facing the camera.",
};

const REGRA_PADRAO =
  "PRODUCT DISPLAY RULE: show the product in its natural position of use, complete, with the most distinctive feature facing the camera.";

/**
 * Escala do produto. O erro clássico do modelo é inflar o objeto pra caber o
 * rótulo legível no quadro, e aí um pote de 60 cápsulas fica do tamanho do
 * tronco da pessoa. Nomear o erro e dar a saída certa (aproximar a câmera)
 * corrige sem precisar dizer o tamanho real de cada produto.
 */
const ESCALA_REAL =
  "REAL WORLD SCALE, CRITICAL: the product must look exactly the size it is in real life. The most common failure is enlarging the product so its label becomes readable: DO NOT do that. THE HAND IS THE RULER and the hand never grows: the fingers wrap around the product exactly like they would around the real object, and a hand held item (bottle, jar, tube, box, phone, gadget) is NEVER taller than the distance from the wrist to the fingertips. Such an item is about 10 to 15 cm tall and, when a person is in the frame, it takes AT MOST about one quarter of the image height: never as tall as the head, never from the chin to the waist, never wider than the chest. If the label ends up too small to read, move the CAMERA closer or crop tighter, NEVER inflate the object. The same applies the other way: never shrink a large item just to fit the frame.";

export type OpcoesImagemLab = {
  estilo: string; // chave de ESTILOS_CAMERA
  cena: string; // descrição escrita pela pessoa (posição/enquadramento)
  cenario: string; // chave de CENARIOS_LAB
  cenarioTexto?: string; // quando a pessoa escolheu "Outros"
  cenarioMotor?: string; // chave equivalente em CENARIOS (quando existe)
  cenarioLivre?: string; // descrição do cenário quando não tem equivalente
  /** true = a ÚLTIMA imagem anexada é a foto do LUGAR (cenário próprio do usuário) */
  cenarioFoto?: boolean;
  comAvatar: boolean; // false = POV/sem pessoa (só as mãos ou só o produto)
  produtoNome?: string;
  /** enquadramento da variação escolhida (POV: mãos segurando ou produto parado) */
  variacaoExtra?: string;
  /** true no POV "produto parado": nem as mãos podem aparecer */
  semMaos?: boolean;
};

/** Bloco do cenário: usa a descrição rica de CENARIOS quando existir. */
function blocoCenario(o: OpcoesImagemLab): string {
  if (o.cenarioFoto) {
    return "SETTING FROM PHOTO, CRITICAL: the LAST attached photo is the EXACT place where the scene happens. Place the subject INSIDE that same environment: same walls, same furniture in the same positions, same colors, same decoration, same lighting mood. Do NOT redesign the room, do NOT invent a different place, do NOT add or remove furniture: it must be recognizable as the very same location from the photo. The place stays in SHARP FOCUS, exactly as crisp as in the photo: NO blur, NO bokeh, NO depth of field haze on the background, every wall, object and detail perfectly readable in 4K, and the person and the product equally sharp. Use that photo ONLY for the place: ignore any person, product or text that appears in it.";
  }
  const doMotor = o.cenarioMotor ? CENARIOS.find((c) => c.chave === o.cenarioMotor) : null;
  if (doMotor) {
    return `SETTING: ${doMotor.local}. The whole place stays in SHARP FOCUS (no blur, no bokeh), every detail readable, and the person and the product equally sharp. Lighting: ${doMotor.luz}.`;
  }
  const livre = (o.cenarioTexto || o.cenarioLivre || "").trim();
  if (livre) {
    return `SETTING: ${livre}. The whole place stays in SHARP FOCUS (no blur, no bokeh), every detail readable, and the person and the product equally sharp. Natural believable lighting for that place.`;
  }
  return "SETTING: a real lived-in Brazilian home, the whole place in SHARP FOCUS (no blur, no bokeh) and the person and the product equally sharp. Soft natural daylight, no flash, no studio light.";
}

/**
 * Monta o prompt final. `comAvatar` muda a leitura das imagens anexadas:
 *  - com avatar: 1ª foto = PESSOA (identidade travada), 2ª = PRODUTO
 *  - sem avatar: a única foto anexada é o PRODUTO
 */
export function montarPromptImagemLab(o: OpcoesImagemLab): string {
  const estilo = estiloPorChave(o.estilo);
  const cena = o.cena.trim();
  const vestindo = estilo?.chave === "vestindo" || estilo?.chave === "espelho";
  const linhas: string[] = [];

  // ---------- ABERTURA: o pedido da pessoa tem prioridade máxima ----------
  linhas.push(
    `MANDATORY USER INSTRUCTION (HIGHEST PRIORITY, THIS OVERRIDES EVERY OTHER RULE BELOW IF THERE IS ANY CONFLICT): "${cena}". If the reference product photo shows several items, kits or props that contradict this instruction, IGNORE THEM.`,
  );

  // A escala entra logo na abertura junto com a identidade: no meio do prompt ela
  // se perdia e o modelo continuava inflando o produto pra caber o rótulo.
  linhas.push(
    "SIZE DISCIPLINE (applies to the whole image): the product keeps its real life size next to the hand and the body. An oversized product is a failed image.",
  );

  // A identidade também entra na abertura: quando ficava só no meio, o rosto saía
  // "parecido" e não igual.
  if (o.comAvatar) {
    linhas.push(
      "KEEP THE FACE OF THE FIRST PHOTO. This is a real person and the first photo is her official identity reference. Do NOT redraw her, do NOT reinterpret her, do NOT generate a similar looking person: use HER face, exactly as it is.",
    );
    linhas.push(
      "Same face shape, same jawline, same nose, same eyes and eye spacing, same eyebrows, same lips, same teeth, same skin tone and freckles or marks, same hair color, texture, length and parting, same apparent age, same ethnicity, same body type, same glasses, jewelry, piercings and tattoos. No beautifying, no slimming, no younger face, no makeup added, no different haircut.",
    );
    // FATIAR A REFERÊNCIA: sem isso o modelo copia a roupa junto com o rosto, e a
    // camiseta do avatar aparece por baixo (ou no lugar) do produto.
    linhas.push(
      vestindo
        ? "CLOTHING REPLACEMENT, CRITICAL: use the first photo ONLY for the person's identity (face, hair, skin tone, body type). COMPLETELY REPLACE the clothes she is wearing in that photo, top AND bottom, with the product. The original clothing colors from the reference must NOT appear anywhere in the final image: the product is the only garment that matters. If the product is a single piece, complete the look with plain neutral clothing in a color that does not copy the reference."
        : "Use the first photo ONLY for the person's identity (face, hair, skin tone, body type). Her clothes in that photo are just a reference of style: they must not compete with the product.",
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

  // ---------- PRODUTO ----------
  linhas.push(o.comAvatar ? "Second photo = the PRODUCT." : "The first photo given = the PRODUCT.");
  if (o.cenarioFoto) {
    linhas.push(
      "The LAST attached photo = the PLACE (background reference only). Never copy any person, product, text or watermark from that photo: only the environment.",
    );
  }
  // Modo flexível: como a pessoa SEMPRE escreve a cena aqui, a foto do produto
  // manda na APARÊNCIA e a instrução dela manda na COMPOSIÇÃO. É o que resolve o
  // conflito clássico "a foto tem 3 unidades mas eu quero mostrar 1".
  linhas.push(
    `PRODUCT FIDELITY: the product reference photo is given ONLY so you copy the EXACT shape, colors, materials, prints, labels and design details of the item. Do NOT copy the original photo's composition, layout, number of items, packaging arrangement or background: follow the user instruction for that.${
      o.produtoNome ? ` The product is: ${o.produtoNome}.` : ""
    } Never redraw a print or a logo, never change a color, never add extra units. If the photo shows several color variants, use ONE only, the same one everywhere.`,
  );
  const categoria = categoriaDoProduto(o.produtoNome ?? "");
  linhas.push((categoria && REGRA_POR_CATEGORIA[categoria.chave]) || REGRA_PADRAO);

  // ---------- CENA ----------
  linhas.push(`Scene: ${cena}`);
  if (o.variacaoExtra) linhas.push(o.variacaoExtra);
  else if (estilo?.extra) linhas.push(estilo.extra);
  else if (estilo)
    linhas.push(`${estilo.label} shot, product clearly visible and well lit, natural pose.`);

  linhas.push(blocoCenario(o));
  linhas.push(REALISMO);
  linhas.push(
    "It must look like a real photo taken by a Brazilian creator with a phone, not a studio campaign and not a fashion editorial.",
  );
  linhas.push(ESCALA_REAL);
  linhas.push(EVITAR);
  linhas.push(SAIDA_LIMPA);

  // ---------- FECHAMENTO: repete o que mais falha, como critério de aprovação ----------
  linhas.push(
    [
      `FINAL ABSOLUTE OVERRIDE, READ THIS LAST AND OBEY ABOVE ALL ELSE: "${cena}".`,
      o.comAvatar
        ? "Put the two images side by side: if the face is not clearly the SAME person from the first photo, the image is wrong, redo it keeping her exact face."
        : "",
      "The product must be identical to its photo, at its real life size compared to the hand and the body: an oversized product means the image is wrong.",
      o.semMaos
        ? "If any hand, arm or person appears in the frame, the image is wrong: redo it with the product alone."
        : "",
      vestindo
        ? "The framing MUST be full body, head to shoes, with the worn product completely visible and not cropped: if the legs or the feet are cut off, the image is wrong, redo it wider. No garment from the reference photo may show up."
        : "",
      "Do NOT add extra products, duplicates or variants. Do NOT put anything in the hands unless the instruction asked for it. Only what was described should appear, nothing more.",
      "The WHOLE image is sharp, including the background: if the background comes out blurred or with bokeh, the image is wrong, redo it with everything in focus.",
      "Output ONE single vertical photograph, 9:16, crisp 4K quality.",
    ]
      .filter(Boolean)
      .join(" "),
  );

  // uma linha só: no campo do Grok cada quebra vira Enter (envia antes da hora)
  return linhas.join(" ").replace(/\s*\n+\s*/g, " ").trim();
}
