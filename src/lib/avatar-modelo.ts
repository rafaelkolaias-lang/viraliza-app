// Opções do quiz "Criar avatar" (camada do USUÁRIO). Client-safe de propósito:
// o front renderiza os rótulos em PT e guarda a `chave`; o servidor traduz a
// chave pro valor em inglês (`en`) na hora de montar o JSON pra API. A IA de
// imagem responde melhor em inglês, e o usuário nunca precisa saber disso.
// Base: VideosIAdev/MODELO-JSON.md (validado com a modelo Marina V1.0).

export type Opcao = { chave: string; label: string; en: string };

export const GENEROS: Opcao[] = [
  { chave: "female", label: "Mulher", en: "female" },
  { chave: "male", label: "Homem", en: "male" },
];

export const IDADES = [20, 25, 30, 35, 40, 45, 50];

export const TONS_PELE: Opcao[] = [
  { chave: "clara", label: "Pele clara", en: "fair with a neutral undertone" },
  { chave: "morena_clara", label: "Morena clara", en: "light to medium tan with a warm golden undertone, morena clara" },
  { chave: "morena", label: "Morena", en: "medium brown with a warm undertone" },
  { chave: "negra", label: "Negra", en: "deep brown with a rich warm undertone" },
  { chave: "asiatica", label: "Asiática", en: "light with a neutral warm undertone, east asian" },
];

export const FORMATOS_ROSTO: Opcao[] = [
  { chave: "oval", label: "Oval", en: "oval with a soft rounded jawline" },
  { chave: "redondo", label: "Redondo", en: "round with soft full cheeks" },
  { chave: "quadrado", label: "Quadrado", en: "square with a defined jawline" },
  { chave: "coracao", label: "Coração", en: "heart shaped, wider forehead and a narrow chin" },
  { chave: "alongado", label: "Alongado", en: "long oval with elongated proportions" },
];

// só a cor muda; o servidor monta "medium almond shaped, {cor}, slightly hooded upper lid"
export const OLHOS: Opcao[] = [
  { chave: "castanho_escuro", label: "Castanho escuro", en: "warm dark brown" },
  { chave: "castanho_claro", label: "Castanho claro", en: "light brown" },
  { chave: "mel", label: "Mel", en: "hazel" },
  { chave: "verde", label: "Verde", en: "green" },
  { chave: "verde_acinzentado", label: "Verde acinzentado", en: "gray green" },
];

export const CABELO_CORES: Opcao[] = [
  { chave: "preto", label: "Preto", en: "natural black, uniform, no highlights" },
  { chave: "castanho_escuro", label: "Castanho escuro", en: "dark chocolate brown, uniform, no highlights, no ombre" },
  { chave: "castanho_claro", label: "Castanho claro", en: "light brown, uniform, no highlights" },
  { chave: "loiro", label: "Loiro", en: "natural honey blonde, uniform, no harsh bleach" },
  { chave: "ruivo", label: "Ruivo", en: "natural auburn red" },
];

export const CABELO_COMPRIMENTOS: Opcao[] = [
  { chave: "curto", label: "Curto", en: "short bob" },
  { chave: "ombro", label: "Na altura do ombro", en: "shoulder length" },
  { chave: "longo", label: "Longo", en: "long, below the shoulder blades" },
];

export const CABELO_TEXTURAS: Opcao[] = [
  { chave: "liso", label: "Liso", en: "straight with natural movement, some flyaway strands" },
  { chave: "ondulado", label: "Ondulado", en: "naturally wavy, soft loose waves, some flyaway strands" },
  { chave: "cacheado", label: "Cacheado", en: "naturally curly, defined curls, natural volume" },
  { chave: "crespo", label: "Crespo", en: "natural coily hair, defined texture, natural volume" },
];

export const TIPOS_FISICOS: Opcao[] = [
  { chave: "magra", label: "Magro(a)", en: "slim with natural healthy curves, not skinny, not muscular" },
  { chave: "atletica", label: "Atlético(a)", en: "athletic and toned, defined shoulders, natural proportions" },
  { chave: "curvilinea", label: "Curvilíneo(a)", en: "curvy hourglass with natural proportions" },
  { chave: "plus", label: "Plus size", en: "plus size with natural healthy proportions" },
];

export const EXPRESSOES: Opcao[] = [
  { chave: "sorriso_leve", label: "Sorriso leve", en: "calm and friendly, a light closed lip smile, relaxed eyes" },
  { chave: "sorriso_aberto", label: "Sorriso aberto", en: "genuine warm open smile, the eyes smiling too, crinkles at the eye corners" },
  { chave: "neutra", label: "Neutra", en: "neutral relaxed expression, lips closed, calm gaze" },
];

export const MAQUIAGENS: Opcao[] = [
  { chave: "sem", label: "Sem maquiagem", en: "no makeup at all, bare natural skin" },
  { chave: "leve", label: "Leve e natural", en: "very light and natural, groomed brows, a touch of mascara, nude lip, no heavy contour" },
  { chave: "marcante", label: "Marcante", en: "defined makeup, winged eyeliner, matte lipstick, still natural skin texture" },
];

// cenários = casas brasileiras REAIS (baseados nas fotos de referência do Lucas:
// apartamento simples com porcelanato, casa de tijolo à vista, quintal com muro de
// tijolo). Vividos, do dia a dia, com os objetos ao fundo mas desfocados. Ver
// docs/cenarios-referencia.md. local + fonte de luz em inglês.
export type Cenario = { chave: string; label: string; local: string; luz: string };
export const CENARIOS: Cenario[] = [
  {
    chave: "sala",
    label: "Sala",
    local: "a nice tidy Brazilian middle class living room, a white wall with 3D textured panels, a wall mounted TV, a white TV console with an orchid and small decorations, a plush light gray sofa with cushions, a blue and gray geometric pattern rug, glossy light porcelain floor tiles",
    luz: "warm recessed ceiling downlights, cozy indoor evening light",
  },
  {
    chave: "sala_tijolo",
    label: "Casa simples (tijolo)",
    local: "a humble simple Brazilian house, walls of raw exposed red brick, a framed picture of a colonial building on the brick, a modest brown two seat fabric sofa, a wooden dining table and chairs with a flower vase, a patterned rug on a bare concrete floor, a real casa simples de periferia",
    luz: "the strong bright light of a single bare ceiling bulb, homely and a bit harsh",
  },
  {
    chave: "cozinha",
    label: "Cozinha",
    local: "a simple real home kitchen, a counter with a few jars, dishes and everyday items, plain tiled wall and cabinets, an ordinary Brazilian kitchen",
    luz: "natural daylight from the kitchen window mixed with warm indoor light",
  },
  {
    chave: "quarto",
    label: "Quarto",
    local: "a cozy modern Brazilian bedroom, a bed with a white floral bedspread and dusty pink throw and pillows, an upholstered headboard with a warm LED strip, gray curtains, a mirrored wardrobe, a small white dressing desk, a modern ceiling light",
    luz: "warm ambient bedroom light with soft downlights, cozy evening mood",
  },
  {
    chave: "quintal",
    label: "Quintal",
    local: "a real Brazilian backyard under a wooden tile roof, light ceramic floor, a big green potted plant, a red exposed brick boundary wall, a metal gate, some grass and a small tree, a crochet rug on the floor",
    luz: "bright natural daylight, sunny with a clear blue sky in the background",
  },
  {
    chave: "penteadeira",
    label: "Penteadeira",
    local: "a corner with a simple vanity or dressing table, a mirror, small cosmetics and personal items, an ordinary bedroom corner",
    luz: "soft natural daylight from a nearby window, out of frame",
  },
];

export const ESTILOS: Opcao[] = [
  { chave: "natural", label: "Natural (pessoa comum)", en: "ordinary" },
  { chave: "comercial", label: "Comercial (mais produzido)", en: "commercial" },
];

// Como o produto aparece no vídeo/foto com o avatar (etapa manual escolhida pela
// pessoa). `en` = como apresentar; `enquadramento` = o plano da câmera pra esse tipo.
export type Apresentacao = { chave: string; label: string; en: string; enquadramento: string };
export const APRESENTACOES: Apresentacao[] = [
  {
    chave: "mao",
    label: "Na mão",
    en: "the product resting on ONE open upturned palm held up near the chest toward the camera, fingers relaxed and kept together, the fingers NOT wrapping around and NOT covering the product, the front or label of the product facing the camera",
    enquadramento: "upper body, waist up, the open hand and the product large and centered, the other hand out of frame",
  },
  {
    chave: "corpo",
    label: "Vestindo (roupa)",
    en: "wearing the product naturally on the body as everyday clothing",
    enquadramento: "three quarter body shot that shows the whole outfit clearly",
  },
  {
    chave: "pes",
    label: "Nos pés (calçado)",
    en: "wearing the product on the feet, standing in a natural relaxed pose",
    enquadramento: "full body shot from a slightly lower angle so the shoes are clearly visible",
  },
  {
    chave: "rosto",
    label: "No rosto (óculos, brinco)",
    en: "wearing the product on the face or ears",
    enquadramento: "close portrait, head and shoulders, the product in sharp focus",
  },
  {
    chave: "pulso",
    label: "No pulso (relógio)",
    en: "wearing the product on the wrist, the forearm raised naturally toward the camera",
    enquadramento: "upper body with the wrist and product in the foreground and in focus",
  },
  {
    chave: "lado",
    label: "Ao lado (na bancada)",
    en: "the product placed on a clean simple surface (a table or shelf) right next to the person, the person beside it smiling at the camera with hands relaxed and NOT touching the product",
    enquadramento: "upper body, the person and the product side by side, the product large, frontal and clear",
  },
];

// Duração do clipe (o Grok gera vídeos curtos). A fala precisa caber no tempo:
// ~2,5 palavras por segundo é um ritmo natural de fala em português. Se na prática
// o Grok falar mais rápido/devagar, é só ajustar PALAVRAS_POR_SEG aqui num lugar só.
export const DURACOES = [6, 10] as const;
export const PALAVRAS_POR_SEG = 2.5;

export function limitePalavras(seg: number) {
  return Math.round(seg * PALAVRAS_POR_SEG);
}
export function contarPalavras(texto: string) {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

// Custo fixo pra gerar 1 avatar (creditos = centavos). A imagem no gpt-image-1
// sai mais cara que um video comum. Client-safe pra UI mostrar antes de gerar.
export const CUSTO_AVATAR = 300;

// Custo pra gerar 1 vídeo com avatar (creditos = centavos): 6s = 250, 10s = 300.
export const CUSTO_VIDEO_AVATAR = 250;
export const CUSTO_VIDEO_AVATAR_10S = 300;
export function custoVideoAvatar(duracaoSeg: number): number {
  return duracaoSeg >= 10 ? CUSTO_VIDEO_AVATAR_10S : CUSTO_VIDEO_AVATAR;
}

export type EscolhasAvatar = {
  nome: string;
  genero: string;
  idade: number;
  tomPele: string;
  formatoRosto: string;
  olhos: string;
  cabeloCor: string;
  cabeloComprimento: string;
  cabeloTextura: string;
  tipoFisico: string;
  expressao: string;
  maquiagem: string;
  marcas: string;
  cenario: string;
  estilo: string;
};

/** Acha o valor em inglês de uma opção pela chave (fallback = 1ª opção). */
export function enDe(lista: Opcao[], chave: string): string {
  return (lista.find((o) => o.chave === chave) ?? lista[0]).en;
}
