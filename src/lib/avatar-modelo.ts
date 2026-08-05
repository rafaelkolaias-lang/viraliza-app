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

/**
 * Tons de pele. Cada um tem uma AMOSTRA (o degradê que a pessoa vê no card): a
 * escolha por foto de pele é muito mais precisa do que por nome, porque "morena"
 * quer dizer uma coisa diferente pra cada pessoa.
 */
export type TomPele = Opcao & { amostra: string };
export const TONS_PELE: TomPele[] = [
  {
    chave: "muito_clara",
    label: "Muito clara",
    en: "very fair porcelain skin with a cool neutral undertone, visible fine texture",
    amostra: "linear-gradient(135deg,#fbeade,#f3d9c8)",
  },
  {
    chave: "clara",
    label: "Clara",
    en: "fair with a neutral undertone",
    amostra: "linear-gradient(135deg,#f4dcc4,#e9c6a8)",
  },
  {
    chave: "clara_media",
    label: "Clara média",
    en: "light medium skin with a warm beige undertone",
    amostra: "linear-gradient(135deg,#eac6a0,#dcae86)",
  },
  {
    chave: "morena",
    label: "Morena",
    en: "medium brown with a warm undertone",
    amostra: "linear-gradient(135deg,#bd7f52,#a4653c)",
  },
  {
    chave: "morena_escura",
    label: "Morena escura",
    en: "deep tan brown skin with a rich warm undertone, morena escura",
    amostra: "linear-gradient(135deg,#8f5633,#6f401f)",
  },
  {
    chave: "negra",
    label: "Negra",
    en: "deep brown with a rich warm undertone",
    amostra: "linear-gradient(135deg,#5c3520,#3a1f12)",
  },
  {
    chave: "vitiligo",
    label: "Vitiligo",
    en: "brown skin with natural vitiligo, soft irregular depigmented patches on the face, neck and hands, real skin texture",
    amostra:
      "radial-gradient(circle at 30% 32%,#f0dcc6 12%,transparent 13%),radial-gradient(circle at 62% 58%,#f0dcc6 16%,transparent 17%),radial-gradient(circle at 78% 24%,#f0dcc6 9%,transparent 10%),linear-gradient(135deg,#b97a4e,#96603a)",
  },
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
  { chave: "castanho", label: "Castanho", en: "natural brown, uniform, no highlights, no ombre" },
  { chave: "loiro", label: "Loiro", en: "natural honey blonde, uniform, no harsh bleach" },
  { chave: "ruivo", label: "Ruivo", en: "natural auburn red" },
  { chave: "vermelho", label: "Vermelho", en: "vivid dyed red, bright and saturated" },
  { chave: "rosa", label: "Rosa", en: "vivid dyed pink" },
  { chave: "roxo", label: "Roxo", en: "vivid dyed purple" },
  { chave: "azul", label: "Azul", en: "vivid dyed blue" },
  { chave: "verde", label: "Verde", en: "vivid dyed green" },
  { chave: "platinado", label: "Platinado", en: "platinum blonde, almost white, cool tone" },
  { chave: "grisalho", label: "Grisalho", en: "natural salt and pepper gray hair" },
];

/**
 * ESTILO do cabelo (corte e textura numa coisa só). Cada um tem a foto de
 * referência no serverrk. Uns são de mulher, outros de homem e alguns servem pros
 * dois: a tela mostra os do gênero escolhido mais os unissex.
 */
export type EstiloCabelo = Opcao & { genero: "female" | "male" | "unisex" };
export const CABELO_ESTILOS: EstiloCabelo[] = [
  // ----- feminino -----
  { chave: "long_straight", label: "Longo liso", genero: "female", en: "long straight hair falling below the shoulder blades, smooth with natural movement" },
  { chave: "long_curly", label: "Longo cacheado", genero: "female", en: "long curly hair with defined curls and natural volume" },
  { chave: "wavy", label: "Ondulado médio", genero: "female", en: "medium length wavy hair, soft loose waves" },
  { chave: "bob", label: "Chanel", genero: "female", en: "chin length bob haircut, straight and neat" },
  { chave: "pixie", label: "Pixie", genero: "female", en: "short pixie cut, cropped close with texture on top" },
  { chave: "bangs", label: "Com franja", genero: "female", en: "shoulder length hair with straight blunt bangs over the forehead" },
  { chave: "ponytail", label: "Rabo de cavalo", genero: "female", en: "hair pulled back into a high ponytail, smooth on top" },
  { chave: "bun", label: "Coque", genero: "female", en: "hair tied in a neat bun at the back of the head, a few loose strands" },
  { chave: "braids", label: "Tranças", genero: "female", en: "long box braids, neatly parted" },
  { chave: "afro", label: "Black power", genero: "female", en: "natural afro hair, round volume, defined coily texture" },
  // ----- masculino -----
  { chave: "short_classic", label: "Curto clássico", genero: "male", en: "short classic haircut, neatly combed, natural finish" },
  { chave: "fade", label: "Degradê", genero: "male", en: "fade haircut, short faded sides with more length on top" },
  { chave: "undercut", label: "Undercut", genero: "male", en: "undercut, shaved sides with longer hair on top" },
  { chave: "buzzcut", label: "Raspado", genero: "male", en: "buzz cut, very short hair all over" },
  { chave: "bald", label: "Careca", genero: "male", en: "completely bald head, natural scalp" },
  { chave: "slickback", label: "Penteado pra trás", genero: "male", en: "hair combed straight back, slicked back style" },
  { chave: "medium_straight", label: "Médio liso", genero: "male", en: "medium length straight hair, loose and natural" },
  { chave: "curly_short", label: "Cacheado curto", genero: "male", en: "short curly hair with defined curls" },
  { chave: "afro_short", label: "Black curto", genero: "male", en: "short natural afro hair, defined coily texture" },
  { chave: "mohawk", label: "Moicano", genero: "male", en: "mohawk haircut, shaved sides with a strip of longer hair on top" },
  // ----- serve pros dois -----
  { chave: "short_straight", label: "Curto liso", genero: "unisex", en: "short straight hair, simple neat cut" },
  { chave: "medium_curly", label: "Cacheado médio", genero: "unisex", en: "medium length curly hair, defined curls with natural volume" },
  { chave: "dreads", label: "Dreads", genero: "unisex", en: "medium length dreadlocks, natural and neat" },
  { chave: "manbun", label: "Coque samurai", genero: "unisex", en: "hair tied in a small bun at the back, short at the sides" },
];

/** Estilos de cabelo que aparecem pro gênero escolhido (com os unissex junto). */
export function estilosDeCabelo(genero: string): EstiloCabelo[] {
  const g = genero === "male" ? "male" : "female";
  return CABELO_ESTILOS.filter((e) => e.genero === g || e.genero === "unisex");
}

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

/**
 * Tipo físico. O terceiro muda de sentido conforme o gênero (curvilínea pra
 * mulher, robusto pro homem), então cada opção carrega a versão masculina do
 * rótulo, da descrição e do texto que vai pro prompt.
 */
export type TipoFisico = Opcao & {
  desc: string;
  labelM?: string;
  descM?: string;
  enM?: string;
};
export const TIPOS_FISICOS: TipoFisico[] = [
  {
    chave: "magra",
    label: "Magra",
    labelM: "Magro",
    desc: "Corpo magro e esguio",
    en: "slim with natural healthy curves, not skinny, not muscular",
    enM: "slim and lean, natural healthy build, not skinny, not muscular",
  },
  {
    chave: "atletica",
    label: "Atlética",
    labelM: "Atlético",
    desc: "Corpo tonificado e definido",
    en: "athletic and toned, defined shoulders, natural proportions",
  },
  {
    chave: "curvilinea",
    label: "Curvilínea",
    labelM: "Robusto",
    desc: "Corpo com curvas naturais",
    descM: "Corpo largo, com barriga",
    en: "curvy hourglass with natural proportions",
    enM: "stocky and broad, wide shoulders and a natural belly, strong build",
  },
  {
    chave: "plus",
    label: "Plus size",
    desc: "Corpo grande e arredondado",
    en: "plus size with natural healthy proportions",
  },
];

/** Rótulo, descrição e texto do prompt do tipo físico no gênero escolhido. */
export function tipoFisicoNoGenero(t: TipoFisico, genero: string) {
  const male = genero === "male";
  return {
    label: male ? (t.labelM ?? t.label) : t.label,
    desc: male ? (t.descM ?? t.desc) : t.desc,
    en: male ? (t.enM ?? t.en) : t.en,
  };
}

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
  {
    chave: "academia",
    local: "a real gym, weight racks, dumbbells, machines and wall mirrors softly out of focus in the background, an ordinary Brazilian gym",
    label: "Academia",
    luz: "bright even gym lighting, energetic indoor light",
  },
  {
    chave: "rua",
    label: "Na rua",
    local: "an ordinary Brazilian residential street outdoors, a sidewalk with houses, a wall and a few trees behind, the person outside as if walking on the street",
    luz: "natural outdoor daylight, soft daytime sunlight",
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
export const DURACOES = [6, 10, 15] as const;
export const PALAVRAS_POR_SEG = 2.5;

// obs de cada duração, pra pessoa entender pra que serve cada uma.
export const DURACAO_NOTA: Record<number, string> = {
  6: "Curtinho, ótimo pra vídeo sem fala",
  10: "Dá tempo de uma fala boa",
  15: "Mais completo, fala caprichada",
};

// Estilos de vídeo do modo guiado (client-safe: a UI mostra label+desc; o
// servidor traduz a chave numa direção de cena no prompt). Padrão: ugc.
export type EstiloVideo = { chave: string; label: string; desc: string };
export const ESTILOS_VIDEO: EstiloVideo[] = [
  { chave: "ugc", label: "UGC clássico", desc: "Ela apresenta o produto como creator" },
  { chave: "pov", label: "POV", desc: "Primeira pessoa: a câmera é o olhar dela" },
  { chave: "unboxing", label: "Unboxing", desc: "Abrindo a embalagem e revelando" },
  { chave: "demo", label: "Demonstração", desc: "Produto funcionando na prática" },
  { chave: "antes_depois", label: "Antes e Depois", desc: "O problema e a transformação" },
  { chave: "review", label: "Review sincero", desc: "Opinião de quem comprou e testou" },
];

// Idioma da fala no VÍDEO LIVRE (client-safe: a UI mostra o label; o servidor
// usa `fala` na abertura do prompt). Padrão: português do Brasil.
export type IdiomaFala = { chave: string; label: string; fala: string };
export const IDIOMAS_FALA: IdiomaFala[] = [
  { chave: "pt", label: "Português (BR)", fala: "português do Brasil" },
  { chave: "en", label: "Inglês", fala: "inglês" },
  { chave: "es", label: "Espanhol", fala: "espanhol" },
];

export function limitePalavras(seg: number) {
  return Math.round(seg * PALAVRAS_POR_SEG);
}
export function contarPalavras(texto: string) {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

// Custo fixo pra GERAR 1 avatar na plataforma (creditos = centavos). Subir uma
// imagem pronta e gratis (sem IA). Client-safe pra UI mostrar antes de gerar.
export const CUSTO_AVATAR = 20;

// Como o produto aparece na foto "avatar com produto" (image-to-image). O `en`
// vira a instrucao pro gpt-image-1. Client-safe: a UI mostra o label em PT.
export const USOS_PRODUTO: Opcao[] = [
  {
    chave: "segurando",
    label: "Segurando o produto",
    en: "the person is holding the product in one hand, showing it clearly to the camera, fingers open so they do not cover the product, at chest height",
  },
  {
    chave: "rosto",
    label: "Passando no rosto",
    en: "the person is gently applying the product on their own face with the fingertips, like applying a skincare cream or serum, the product container visible near the face",
  },
  {
    chave: "cabelo",
    label: "Passando no cabelo",
    en: "the person is applying the product on their own hair with one hand, like a hair cream or oil, the product container visible near the head",
  },
  {
    chave: "vestindo",
    label: "Vestindo / usando",
    en: "the person is WEARING the product on their body, the FULL garment clearly visible and complete in the frame, showing how it fits when worn, natural relaxed standing pose, full body from head to toe",
  },
  {
    chave: "mostrando",
    label: "Mostrando pra câmera",
    en: "the person holds the product up next to their smiling face and points at it with the other hand, an enthusiastic review pose",
  },
];

// Custo pra gerar 1 vídeo com avatar (creditos = centavos): 6s=50, 10s=70, 15s=95.
// Mesma tabela do Lab (lab-video.ts), porque é o mesmo motor e a mesma cota.
// NÃO existe desconto por vídeo sem fala: a cota do motor é medida em SEGUNDOS
// gerados, e um vídeo mudo ocupa exatamente os mesmos segundos de um falado.
export const CUSTO_VIDEO_AVATAR = 50;
export const CUSTO_VIDEO_AVATAR_10S = 70;
export const CUSTO_VIDEO_AVATAR_15S = 95;
export function custoVideoAvatar(duracaoSeg: number): number {
  return duracaoSeg >= 15
    ? CUSTO_VIDEO_AVATAR_15S
    : duracaoSeg >= 10
      ? CUSTO_VIDEO_AVATAR_10S
      : CUSTO_VIDEO_AVATAR;
}

export type EscolhasAvatar = {
  nome: string;
  genero: string;
  idade: number;
  tomPele: string;
  formatoRosto: string;
  olhos: string;
  cabeloCor: string;
  /** chave de CABELO_ESTILOS (corte + textura numa coisa só) */
  cabeloEstilo?: string;
  cabeloComprimento: string;
  cabeloTextura: string;
  tipoFisico: string;
  expressao: string;
  maquiagem: string;
  marcas: string;
  cenario: string;
  estilo: string;
  /** cor da camisa (chave de CAMISAS ou "custom") */
  camisa?: string;
  /** cor livre quando a camisa é "custom" (hex) */
  camisaCor?: string;
  /** tipo da camiseta (chave de CAMISA_TIPOS) */
  camisaTipo?: string;
  /** detalhes do passo 6 */
  barba?: boolean;
  oculos?: boolean;
};

/** Tipo da camiseta do influenciador. */
export const CAMISA_TIPOS: (Opcao & { desc: string })[] = [
  { chave: "basica", label: "Convencional", desc: "Camiseta básica", en: "a plain basic cotton crew neck t-shirt" },
  { chave: "polo", label: "Gola polo", desc: "Camisa polo com gola", en: "a plain cotton polo shirt with a collar" },
];

/**
 * Cor da camisa. É o que mais aparece no card do influenciador e o que mais
 * atrapalha o vídeo depois: camisa estampada rouba a atenção do produto, por isso
 * são todas lisas. "Custom" deixa a pessoa escolher qualquer cor.
 */
export type CorCamisa = Opcao & { cor: string };
export const CAMISAS: CorCamisa[] = [
  { chave: "preta", label: "Preta", cor: "#151515", en: "black" },
  { chave: "branca", label: "Branca", cor: "#f8f8f8", en: "white" },
  { chave: "cinza", label: "Cinza", cor: "#9ca3af", en: "heather gray" },
  { chave: "azul_marinho", label: "Azul marinho", cor: "#1e3a5f", en: "navy blue" },
  { chave: "vermelha", label: "Vermelha", cor: "#dc2626", en: "red" },
  { chave: "verde_escuro", label: "Verde escuro", cor: "#15803d", en: "dark green" },
  { chave: "bege", label: "Bege", cor: "#e0c49a", en: "beige" },
  { chave: "rosa", label: "Rosa", cor: "#ec4899", en: "pink" },
];

/**
 * Nome em inglês da cor mais próxima de um hex. O seletor de cor devolve
 * "#22c55e", e pedir "#22c55e colored" pro gerador funciona muito pior do que
 * pedir "green": ele entende nome de cor, não código.
 */
export function corDoHex(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "black";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const luz = (max + min) / 2 / 255;
  const sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));

  if (luz > 0.92) return "white";
  if (luz < 0.1) return "black";
  if (sat < 0.12) return luz > 0.6 ? "light gray" : luz > 0.35 ? "gray" : "dark gray";

  let h = 0;
  if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / (max - min) + 2) * 60;
  else h = ((r - g) / (max - min) + 4) * 60;

  const nome =
    h < 15 || h >= 345
      ? "red"
      : h < 40
        ? "orange"
        : h < 65
          ? "yellow"
          : h < 90
            ? "lime green"
            : h < 160
              ? "green"
              : h < 195
                ? "teal"
                : h < 250
                  ? "blue"
                  : h < 290
                    ? "purple"
                    : "pink";
  return luz > 0.72 ? `light ${nome}` : luz < 0.28 ? `dark ${nome}` : nome;
}

/** Monta a descrição da roupa (tipo + cor) que vai pro prompt. */
export function descricaoCamisa(tipo?: string, cor?: string, corCustom?: string): string {
  const t = CAMISA_TIPOS.find((c) => c.chave === tipo) ?? CAMISA_TIPOS[0];
  const c = CAMISAS.find((x) => x.chave === cor);
  const nomeCor = cor === "custom" && corCustom ? corDoHex(corCustom) : (c?.en ?? "black");
  return `${t.en}, plain ${nomeCor}, no print, no pattern, no visible brand logo`;
}

/** Acha o valor em inglês de uma opção pela chave (fallback = 1ª opção). */
export function enDe(lista: Opcao[], chave: string): string {
  return (lista.find((o) => o.chave === chave) ?? lista[0]).en;
}

/** Avatar já criado, como as telas de "Personalize com IA" mostram no card. */
export type AvatarCriado = {
  id: string;
  nome: string;
  genero: string;
  imagemUrl: string;
  criadoEm: string;
  /** linha de identificação do card ("Feminino, 25 anos, Morena...") */
  ficha?: string;
};
