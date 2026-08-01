/**
 * Biblioteca de MOVIMENTOS do Viraliza Lab: como a pessoa (e a câmera) se mexem
 * no vídeo. Cada item tem um vídeo curto de exemplo (public/movimentos) e a
 * direção em inglês que entra no prompt do Grok.
 *
 * É OPCIONAL: sem movimento o vídeo sai normal, com a animação que a IA decidir.
 * Client-safe (a tela importa direto).
 */

export type CategoriaMovimento =
  | "movimentos"
  | "selfie"
  | "espelho"
  | "pov"
  | "camera";

export type Movimento = {
  chave: string;
  label: string;
  descricao: string; // o que a pessoa lê
  categoria: CategoriaMovimento;
  en: string; // direção que entra no prompt
  /** estilos de câmera em que esse movimento faz sentido (vazio = todos) */
  estilos?: string[];
};

// Sem "Todos" de propósito: com 27 vídeos rodando ao mesmo tempo a tela fica
// pesada no celular. Sempre mostra uma categoria por vez.
export const CATEGORIAS_MOVIMENTO: { chave: CategoriaMovimento; label: string }[] = [
  { chave: "movimentos", label: "Movimentos" },
  { chave: "selfie", label: "Selfie" },
  { chave: "espelho", label: "No espelho" },
  { chave: "pov", label: "POV (mãos)" },
  { chave: "camera", label: "Câmera" },
];

export const MOVIMENTOS: Movimento[] = [
  // ---------- POV (só mãos) ----------
  {
    chave: "pov-produto-maos",
    label: "Girando o produto",
    descricao: "As mãos giram o produto devagar, mostrando todos os lados.",
    categoria: "pov",
    en: "POV close-up: the hands hold and examine the product, gently rotating it to show all sides, natural hand movement.",
    estilos: ["maos"],
  },
  {
    chave: "pov-unboxing",
    label: "Unboxing",
    descricao: "As mãos revelam o produto, como abrindo a embalagem.",
    categoria: "pov",
    en: "POV close-up: the hands reveal and present the product with a gentle unboxing motion, detailed product focus.",
    estilos: ["maos"],
  },
  {
    chave: "pov-capinha",
    label: "Inclinando na luz",
    descricao: "Inclina o produto pra luz bater e brilhar.",
    categoria: "pov",
    en: "POV handheld: the hands tilt the product to catch the light reflection, slow deliberate tilt showing it from multiple angles.",
    estilos: ["maos"],
  },
  {
    chave: "pov-sapatos",
    label: "Olhando pros pés",
    descricao: "Câmera olhando pra baixo, mostrando o calçado.",
    categoria: "pov",
    en: "POV shot looking down at the feet wearing the product, subtle foot movements, weight shift and a small step.",
    estilos: ["maos", "vestindo"],
  },

  // ---------- SELFIE ----------
  {
    chave: "selfie-sorriso",
    label: "Sorriso natural",
    descricao: "Segura o celular na altura do rosto e sorri.",
    categoria: "selfie",
    en: "POV smartphone selfie: holding the phone at face level with a warm natural smile, subtle handheld camera movement.",
    estilos: ["selfie"],
  },
  {
    chave: "selfie-aponta",
    label: "Apontando pro produto",
    descricao: "Aponta pro produto com a mão livre.",
    categoria: "selfie",
    en: "POV smartphone selfie: holding the phone and pointing at the product with the free hand, confident expression.",
    estilos: ["selfie"],
  },
  {
    chave: "selfie-aprovacao",
    label: "Aprovando",
    descricao: "Balança a cabeça aprovando e faz joinha.",
    categoria: "selfie",
    en: "POV smartphone selfie: approving nod and thumbs up, satisfied expression, subtle handheld movement.",
    estilos: ["selfie"],
  },
  {
    chave: "selfie-cabelo",
    label: "Ajeitando o cabelo",
    descricao: "Movimento leve de cabeça ajeitando o cabelo.",
    categoria: "selfie",
    en: "POV smartphone selfie: gentle head movement and hair adjustment, looking playfully at the camera, subtle handheld shake.",
    estilos: ["selfie"],
  },
  {
    chave: "selfie-pensativo",
    label: "Pensativa",
    descricao: "Expressão pensativa, mão no queixo.",
    categoria: "selfie",
    en: "POV smartphone selfie: thoughtful expression, chin touch or looking upward, subtle handheld movement.",
    estilos: ["selfie"],
  },

  // ---------- ESPELHO ----------
  {
    chave: "espelho-confianca",
    label: "Pose confiante",
    descricao: "De pé no espelho, ajustando a pose com confiança.",
    categoria: "espelho",
    en: "Mirror selfie: standing confidently in front of the mirror with a slight pose adjustment, subtle phone movement.",
    estilos: ["espelho"],
  },
  {
    chave: "espelho-textura",
    label: "Mostrando o tecido",
    descricao: "Toca o tecido pra mostrar a textura de perto.",
    categoria: "espelho",
    en: "Mirror selfie: touching the fabric of the clothing to show texture detail, natural curious gesture.",
    estilos: ["espelho"],
  },
  {
    chave: "espelho-relax",
    label: "Relaxada",
    descricao: "Parada de leve, mudando o peso do corpo.",
    categoria: "espelho",
    en: "Mirror selfie: standing relaxed in front of the mirror, gentle weight shift, calm easygoing expression.",
    estilos: ["espelho"],
  },
  {
    chave: "espelho-parado",
    label: "Só posando",
    descricao: "Quase parada, deixando a roupa aparecer.",
    categoria: "espelho",
    en: "Mirror selfie: standing still in front of the mirror letting the outfit show, only natural micro movements.",
    estilos: ["espelho"],
  },

  // ---------- MOVIMENTOS (corpo) ----------
  {
    chave: "revelacao",
    label: "Revelação",
    descricao: "Revela o produto com cara de admiração e olha pra câmera.",
    categoria: "movimentos",
    en: "Frontal UGC: revealing the outfit or product with an admiring expression, looking down at it then up at the camera with excitement.",
  },
  {
    chave: "destaque-tecido",
    label: "Destacando o tecido",
    descricao: "Segura e estica o tecido pra mostrar a qualidade.",
    categoria: "movimentos",
    en: "Frontal UGC: touching and highlighting the fabric texture of the clothing, gentle pinch or stretch of the material.",
  },
  {
    chave: "ajusta-roupa",
    label: "Ajeitando a roupa",
    descricao: "Ajeita a gola, a barra, alisa o tecido.",
    categoria: "movimentos",
    en: "Frontal: adjusting the clothing, straightening the collar, pulling the hem, smoothing the fabric, natural casual gesture.",
  },
  {
    chave: "ajusta-acessorio",
    label: "Ajeitando o acessório",
    descricao: "Ajeita os óculos ou o acessório com leveza.",
    categoria: "movimentos",
    en: "Frontal: adjusting glasses or an accessory with a gentle touch, subtle confident expression.",
  },
  {
    chave: "olhar-curioso",
    label: "Olhar curioso",
    descricao: "Olha o produto com curiosidade e abre um sorriso.",
    categoria: "movimentos",
    en: "Frontal: looking curiously at the product, then transitioning to a warm smile at the camera, natural unscripted feel.",
  },
  {
    chave: "arruma-cabelo",
    label: "Passando a mão no cabelo",
    descricao: "Passa os dedos no cabelo, bem casual.",
    categoria: "movimentos",
    en: "Frontal: running fingers through the hair in a casual natural gesture, relaxed expression.",
  },
  {
    chave: "maos-bolso",
    label: "Mãos no bolso",
    descricao: "Postura relaxada com as mãos no bolso.",
    categoria: "movimentos",
    en: "Frontal: standing with hands in pockets, relaxed confident posture, subtle weight shift.",
  },
  {
    chave: "micro-sorriso",
    label: "Micro sorriso",
    descricao: "Do neutro pro sorriso discreto, olhar suave.",
    categoria: "movimentos",
    en: "Very subtle change in facial expression, from neutral to a gentle micro-smile, eyes soften naturally.",
  },
  {
    chave: "virada-cabeca",
    label: "Virada de cabeça",
    descricao: "Vira a cabeça devagar do lado pro centro.",
    categoria: "movimentos",
    en: "A slow subtle head turn from one side to the center, eyes shift naturally, natural expression throughout.",
  },
  {
    chave: "muda-atencao",
    label: "Olhada de lado",
    descricao: "Olha rapidinho pro lado e volta pra câmera.",
    categoria: "movimentos",
    en: "The subject briefly shifts visual attention, looking slightly off camera then back, natural unscripted feel.",
  },
  {
    chave: "assimetrico",
    label: "Movimento natural",
    descricao: "Corpo se move de um jeito solto, nada robótico.",
    categoria: "movimentos",
    en: "Movement is intentionally asymmetric, one side leads subtly, natural organic body mechanics.",
  },
  {
    chave: "espera-final",
    label: "Terminando parado",
    descricao: "Vai desacelerando e termina numa pose estável.",
    categoria: "movimentos",
    en: "Movement gradually settles toward a final resting pose, natural deceleration, ending in a relaxed stable position.",
  },

  // ---------- CÂMERA ----------
  {
    chave: "push-in-peso",
    label: "Aproximação lenta",
    descricao: "Câmera vai chegando devagar enquanto ela troca o peso.",
    categoria: "camera",
    en: "Subtle slow push-in camera movement while the subject shifts weight naturally from one foot to the other, fabric reacts to the movement.",
  },
  {
    chave: "pan-zoom",
    label: "Pan com zoom",
    descricao: "Câmera desliza de lado com um zoom suave.",
    categoria: "camera",
    en: "Slow horizontal pan combined with a gentle zoom, the subject holds a natural pose, the camera reveals the outfit details progressively.",
  },
];

export function movimentoPorChave(chave?: string | null) {
  return MOVIMENTOS.find((m) => m.chave === chave) ?? null;
}

/**
 * O que a imagem base aguarda animar. É o corte que importa: o motor ANIMA a
 * foto, então movimento de POV numa foto com a pessoa de frente ou faz o modelo
 * ignorar, ou pior, recriar a cena e trocar o rosto.
 *
 *  - imagem POV (só as mãos): SÓ os movimentos de POV;
 *  - produto parado na bancada (sem mão nenhuma): só os de câmera;
 *  - com pessoa: tudo, menos os de POV (não tem POV com o rosto no quadro).
 */
export type CenaDaImagem = { temPessoa: boolean; temMaos: boolean };

export function movimentosDaCena(cena: CenaDaImagem): Movimento[] {
  if (!cena.temPessoa) {
    const cat: CategoriaMovimento = cena.temMaos ? "pov" : "camera";
    return MOVIMENTOS.filter((m) => m.categoria === cat);
  }
  return MOVIMENTOS.filter((m) => m.categoria !== "pov");
}

/** Categorias que sobram pra essa cena (na ordem da barra de filtros). */
export function categoriasDaCena(cena: CenaDaImagem) {
  const disponiveis = new Set(movimentosDaCena(cena).map((m) => m.categoria));
  return CATEGORIAS_MOVIMENTO.filter((c) => disponiveis.has(c.chave));
}

/** Dentro do que sobrou, os que combinam com o estilo escolhido vêm primeiro. */
export function movimentosParaEstilo(
  estilo: string | null | undefined,
  cena: CenaDaImagem,
): Movimento[] {
  const lista = movimentosDaCena(cena);
  if (!estilo) return lista;
  const combinam = lista.filter((m) => !m.estilos || m.estilos.includes(estilo));
  const resto = lista.filter((m) => m.estilos && !m.estilos.includes(estilo));
  return [...combinam, ...resto];
}
