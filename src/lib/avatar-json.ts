import "server-only";

import {
  CABELO_CORES,
  CABELO_COMPRIMENTOS,
  CABELO_TEXTURAS,
  CENARIOS,
  EXPRESSOES,
  FORMATOS_ROSTO,
  MAQUIAGENS,
  OLHOS,
  TIPOS_FISICOS,
  TONS_PELE,
  enDe,
  type EscolhasAvatar,
} from "@/lib/avatar-modelo";

/**
 * Monta o JSON COMPLETO que vai pra API de imagem, a partir das escolhas do
 * usuário. Aqui mora a "camada travada" (câmera, luz, proibições anti-IA) que o
 * usuário nunca vê nem mexe: é o que faz a imagem parecer foto de verdade. Fiel
 * ao VideosIAdev/MODELO-JSON.md (modelo Marina V1.0). Tudo em inglês de propósito.
 */

// lista anti-IA (o que mais pesa no realismo)
const PROIBICOES = [
  "no beauty retouching, no skin smoothing, no frequency separation look",
  "no glamour or magazine retouching",
  "no perfectly symmetric face",
  "no plastic, waxy or glossy skin",
  "no airbrushed skin, keep every pore and natural texture",
  "no CGI, no 3D render, no digital painting, no illustration",
  "no overly sharpened edges, no HDR look",
  "no exaggerated body proportions",
  "no distorted hands, no missing or extra fingers",
  "no text, no watermark, no logo, no border, no graphic overlay",
  "no collage, no multiple panels, no grid, a single photograph only",
];

// bloco extra pra "gente comum" (entra ANTES da lista anti-IA quando estilo = natural)
const ANTI_MODELO = [
  "this is an ordinary everyday person, NOT a professional model",
  "do not make the face conventionally beautiful or symmetric",
  "teeth are natural and slightly imperfect, never a perfect white veneer smile",
  "body is a normal untrained body, no gym definition, no six pack",
  "hair is not professionally styled, it looks like the person did it at home",
  "clothes are simple and affordable, cotton, slightly worn from use, never new looking",
  "skin shows real life: uneven tone, sun exposure, natural blemishes",
  "the person looks like someone you would meet on a regular street in Brazil",
];

export function montarJsonAvatar(e: EscolhasAvatar) {
  const female = e.genero !== "male";
  const tomEn = enDe(TONS_PELE, e.tomPele);
  const corEn = enDe(CABELO_CORES, e.cabeloCor);
  const compEn = enDe(CABELO_COMPRIMENTOS, e.cabeloComprimento);
  const textEn = enDe(CABELO_TEXTURAS, e.cabeloTextura);
  const olhosCor = enDe(OLHOS, e.olhos);
  const olhosFull = `medium almond shaped, ${olhosCor}, slightly hooded upper lid`;
  const formatoEn = enDe(FORMATOS_ROSTO, e.formatoRosto);
  const expressaoEn = enDe(EXPRESSOES, e.expressao);
  const tipoFisicoEn = enDe(TIPOS_FISICOS, e.tipoFisico);
  const maquiagemEn = female ? enDe(MAQUIAGENS, e.maquiagem) : "no makeup, natural bare skin";
  const cenario = CENARIOS.find((c) => c.chave === e.cenario) ?? CENARIOS[0];
  const marcas = e.marcas.trim()
    ? e.marcas.trim()
    : "a few small natural freckles on the cheeks and nose, one small mole near the jaw";
  const proibicoes = e.estilo === "comercial" ? PROIBICOES : [...ANTI_MODELO, ...PROIBICOES];

  // roupa do DIA A DIA (nao mais a camiseta cinza neutra): look casual real de
  // brasileiro em casa, variando cor/estampa a cada geracao pra nao ficar sem graca.
  const roupaPeca = female
    ? "a simple everyday outfit a young Brazilian woman wears day to day at home, such as a casual cotton t-shirt, a basic blouse, a tank top or a strappy top in an ordinary color or a subtle everyday print, affordable and slightly worn from use, no visible brand logo"
    : "a simple everyday outfit a Brazilian man wears day to day at home, such as a casual cotton t-shirt, a polo or a relaxed button up shirt in an ordinary color or a subtle everyday print, affordable and slightly worn from use, no visible brand logo";

  return {
    tarefa: `Generate ONE single photorealistic portrait photograph of a real ${
      female ? "woman" : "man"
    }, to be used as the permanent identity reference of a virtual model. The result must be indistinguishable from a real photograph taken with a real camera.`,

    modelo: {
      nome: e.nome.trim() || "Avatar",
      versao: "V1.0",
      identidade: {
        genero: female ? "female" : "male",
        idade_aparente: e.idade,
        etnia: "Brazilian, mixed heritage, the common Brazilian look",
        altura_aproximada_cm: female ? 168 : 178,
        tipo_fisico: tipoFisicoEn,
      },
      rosto: {
        formato: formatoEn,
        olhos: olhosFull,
        expressao: expressaoEn,
        macas_do_rosto: "moderately defined, natural volume, not sculpted",
        nariz: "small and straight, narrow bridge, rounded tip",
        labios: "medium full, natural shape, natural pink color, no filler look",
        distancia_entre_olhos: "average, natural spacing",
        sobrancelhas: "natural thickness, softly arched, dark brown, individual hairs visible",
        cilios: "natural length, no extensions",
        assimetria: "keep a subtle natural asymmetry, a real face is never perfectly symmetric",
      },
      pele: {
        tom: tomEn,
        imperfeicoes: marcas,
        maquiagem: maquiagemEn,
        textura: "real skin with visible pores, fine peach fuzz and subtle natural texture",
        acabamento: "natural satin finish, slight natural shine on the forehead and nose, never plastic",
      },
      cabelo: {
        cor: corEn,
        comprimento: compEn,
        textura: textEn,
        reparticao: "slightly off center parting",
        acabamento: "natural movement, not styled with heat, no salon gloss",
      },
      corpo: {
        ombros: "natural width, relaxed",
        postura: "upright and relaxed, natural weight distribution",
        maos: "natural hands, short clean natural nails, correct anatomy with five fingers",
      },
      roupa: {
        peca: roupaPeca,
        motivo:
          "everyday casual clothing, the kind a real person wears at home, so the avatar looks natural and relatable, not like a studio model",
      },
      acessorios: "none, no earrings, no necklace, no rings, no watch",
    },

    enquadramento:
      "half body portrait, from the top of the head to the waist, the subject centered and facing the camera, natural breathing room above the head, both shoulders inside the frame",
    pose: "standing relaxed and facing the camera, shoulders slightly angled, arms relaxed down at the sides, chin level, looking straight into the lens",

    cenario: {
      local: cenario.local,
      elementos:
        "a real lived in home behind the subject: everyday furniture and small personal objects are present and give the room life, but they are clearly SOFT and OUT OF FOCUS, never sharp, never cluttered, and never competing with the face",
      profundidade:
        "shallow depth of field, the home background well blurred (natural bokeh) while the subject stays fully sharp",
      clima: "cozy, everyday, honest, like a real photo taken at home, not in a studio",
    },

    iluminacao: {
      fonte: cenario.luz,
      qualidade: "soft and diffused, gentle falloff across the face",
      sombras: "long soft shadows on the opposite side of the face, never harsh, never black",
      temperatura: "neutral daylight, slightly warm",
      proibido: "no flash, no ring light, no studio strobe, no colored gels, no dramatic contrast",
    },

    camera: {
      camera: "professional full frame camera on a tripod, eye level",
      lente: "85mm at f/2.0",
      foco: "sharp focus on the eyes",
      profundidade_de_campo: "shallow, the wall behind softly blurred, the face fully sharp",
      perspectiva: "natural, no wide angle distortion, no fisheye",
      estilo: "unedited RAW photo look, colors close to Kodak Portra 400",
    },

    realismo: [
      "ultra photorealistic, unedited RAW photo look",
      "natural skin texture with visible pores and subtle imperfections",
      "realistic individual hair strands",
      "realistic fabric folds and material response",
      "soft natural shadow transitions",
      "natural film grain",
    ],

    proibicoes,

    travas_de_identidade: [
      "This portrait defines the permanent identity of this model.",
      `Skin tone must be exactly: ${tomEn}.`,
      `Hair must be exactly: ${corEn}, ${compEn}, ${textEn}.`,
      `Eyes must be exactly: ${olhosFull}.`,
      `Apparent age must be exactly ${e.idade} years old.`,
      "Keep the natural marks described in 'pele'.",
      "These traits are requirements, not suggestions. Do not average them toward a generic stock photo face.",
    ],

    saida: {
      formato: "one single vertical photograph, 2:3, no panels, no collage",
      qualidade: "authentic natural photograph, not a fashion editorial",
    },
  };
}

/**
 * Converte o JSON do avatar num PROMPT de texto pro gpt-image-1. Modelos de imagem
 * respondem melhor a prosa descritiva do que a um JSON cru: aqui a gente "achata"
 * a spec em frases claras, mantendo as travas de identidade e as proibicoes.
 */
export function promptImagemAvatar(json: ReturnType<typeof montarJsonAvatar>): string {
  const m = json.modelo;
  const id = m.identidade;
  const r = m.rosto;
  const p = m.pele;
  const c = m.cabelo;
  const cam = json.camera;
  const cen = json.cenario;
  const luz = json.iluminacao;

  return [
    json.tarefa,
    `Person: ${id.genero}, apparent age about ${id.idade_aparente} years old, ${id.etnia}, ${id.tipo_fisico} build, around ${id.altura_aproximada_cm} cm tall.`,
    `Face: ${r.formato} shape; eyes ${r.olhos}; expression ${r.expressao}; nose ${r.nariz}; lips ${r.labios}; eyebrows ${r.sobrancelhas}; lashes ${r.cilios}; ${r.assimetria}.`,
    `Skin: ${p.tom}; ${p.textura}; ${p.acabamento}; natural marks: ${p.imperfeicoes}; makeup: ${p.maquiagem}.`,
    `Hair: ${c.cor}, ${c.comprimento}, ${c.textura}, ${c.reparticao}, ${c.acabamento}.`,
    `Outfit: ${m.roupa.peca}. Accessories: ${m.acessorios}.`,
    `Framing: ${json.enquadramento}. Pose: ${json.pose}.`,
    `Scene: ${cen.local}; ${cen.elementos}; ${cen.clima}.`,
    `Lighting: ${luz.fonte}; ${luz.qualidade}; ${luz.sombras}; ${luz.temperatura}. Avoid: ${luz.proibido}.`,
    `Camera: ${cam.camera}, ${cam.lente}, ${cam.foco}, ${cam.profundidade_de_campo}, ${cam.estilo}.`,
    `Realism: ${json.realismo.join("; ")}.`,
    `Identity locks: ${json.travas_de_identidade.join(" ")}`,
    `Strictly avoid: ${json.proibicoes.join("; ")}.`,
    `Output: ${json.saida.formato}, ${json.saida.qualidade}.`,
  ].join("\n");
}
