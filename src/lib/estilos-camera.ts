/**
 * Estilos de câmera do Viraliza Lab (passo "Criar cena"). Cada estilo é uma
 * MANEIRA de enquadrar a pessoa com o produto, com um vídeo de exemplo pra
 * pessoa bater o olho e entender o resultado antes de gastar crédito.
 *
 * `uso` liga o estilo ao motor que já existe (USOS_PRODUTO em avatar-modelo.ts,
 * usado pelo "Avatar com produto"); `extra` é o tempero em inglês que entra no
 * prompt da imagem, só quando o estilo pede algo além do uso base.
 * Client-safe (sem server-only): a tela do Lab importa direto.
 *
 * Os vídeos de exemplo NÃO ficam no repositório: moram no serverrk (ver
 * lab-midia.ts), então trocar um exemplo é só substituir o arquivo lá.
 */
import { midiaEstilo } from "@/lib/lab-midia";

export type EstiloCamera = {
  chave: string;
  label: string;
  descricao: string; // o que a pessoa lê no card
  paraQuem: string; // categorias de produto que combinam (chip do card)
  video: string; // exemplo em loop (mp4 curto, sem áudio)
  poster: string; // 1º frame, aparece antes do vídeo carregar
  uso: string; // chave de USOS_PRODUTO
  extra?: string; // ajuste extra no prompt da imagem (inglês)
};

export const ESTILOS_CAMERA: EstiloCamera[] = [
  {
    chave: "de_frente",
    label: "De frente",
    descricao:
      "Ideal para mostrar o produto inteiro em mãos: eletrônicos, brinquedos, livros e itens que precisam ser vistos em destaque.",
    paraQuem: "Eletrônicos, brinquedos, livros",
    ...midiaEstilo("de-frente"),
    uso: "segurando",
  },
  {
    chave: "selfie",
    label: "Selfie",
    descricao:
      "Estilo close autêntico, perfeito para cosméticos, skincare, perfumes e produtos pequenos que ganham com a proximidade do rosto.",
    paraQuem: "Cosméticos, skincare, perfumes",
    ...midiaEstilo("selfie"),
    uso: "mostrando",
    extra:
      "Selfie framing: the photo looks like it was taken by the person with their own phone at arm's length, close to the face, slightly high angle, the product held up next to the face.",
  },
  {
    chave: "maos",
    label: "Mãos",
    descricao:
      "Visão em primeira pessoa (POV), recomendado para acessórios, gadgets, comidas e produtos que pedem demonstração de uso.",
    paraQuem: "Acessórios, gadgets, comidas",
    ...midiaEstilo("maos"),
    uso: "segurando",
    extra:
      "POV first person framing: ONLY the hands of the person appear in the frame holding and demonstrating the product, seen from the person's own eyes, no face and no body visible, clean simple background.",
  },
  {
    chave: "vestindo",
    label: "Vestindo",
    descricao:
      "O avatar usa o produto no corpo: feito para roupas, calçados, óculos, relógios, bonés e qualquer item vestível.",
    paraQuem: "Roupas, calçados, óculos, relógios",
    ...midiaEstilo("vestindo"),
    uso: "vestindo",
    extra:
      "FULL BODY SHOT, MANDATORY: frame the person from the top of the head down to the shoes, with a small margin above the head and below the feet. The whole body must fit inside the frame, standing, in a natural relaxed pose facing the camera. The worn product must appear COMPLETE and never cropped by the frame: if it is pants, shorts, a skirt or a dress, the legs must be fully visible all the way down to the feet; if it is footwear, the shoes must be fully visible. Even if the person's reference photo is only a headshot or a half body portrait, generate her FULL BODY: complete the body naturally, keeping the same face, body type and proportions. Do NOT crop at the waist, do NOT crop at the knees. The rest of the outfit is simple and neutral so the product is the highlight.",
  },
  {
    chave: "espelho",
    label: "Frente ao espelho",
    descricao:
      "Selfie no espelho: o avatar aparece refletido segurando o celular e mostrando o produto. Ótimo para moda, looks e roupas que valem corpo inteiro.",
    paraQuem: "Moda, looks, corpo inteiro",
    ...midiaEstilo("espelho"),
    uso: "vestindo",
    extra:
      "MIRROR SELFIE framing: the photo is the REFLECTION of the person in a full length mirror, holding a smartphone in one hand at chest height (the phone must not cover the product), in a real bedroom or hallway mirror of a lived-in home. FULL BODY, MANDATORY: the reflection shows the person from head to shoes, the whole body inside the frame, and the worn product complete and never cropped. Even if the person's reference photo is only a headshot or half body portrait, generate her FULL BODY, keeping the same face, body type and proportions.",
  },
];

export function estiloPorChave(chave?: string | null) {
  return ESTILOS_CAMERA.find((e) => e.chave === chave) ?? null;
}

/**
 * Variações do estilo "Mãos" (POV). O movimento do vídeo depende do que existe na
 * FOTO: com as mãos no quadro dá pra girar e abrir o produto; com o produto
 * parado na bancada não tem mão nenhuma pra mexer, então só a câmera se move.
 * Escolher aqui muda o prompt da imagem E a lista de movimentos lá na frente.
 */
export type VariacaoPov = {
  chave: string;
  label: string;
  descricao: string;
  extra: string; // entra no lugar do extra do estilo no prompt da imagem
  sugestao: string; // texto de partida da descrição da cena
  temMaos: boolean;
};

export const VARIACOES_POV: VariacaoPov[] = [
  {
    chave: "maos",
    label: "Mãos segurando",
    descricao: "As mãos aparecem segurando e demonstrando o produto.",
    extra:
      "POV first person framing: ONLY the hands of the person appear in the frame holding and demonstrating the product, seen from the person's own eyes, no face and no body visible, clean simple background.",
    sugestao: "Apenas as mãos aparecem, segurando o produto e demonstrando como usar",
    temMaos: true,
  },
  {
    chave: "parado",
    label: "Produto parado",
    descricao: "O produto sozinho na bancada ou na mesa, sem ninguém no quadro.",
    extra:
      "Product-only POV still life: the product sits by itself on a real surface (kitchen counter, wooden table, desk or bathroom sink) inside the scene, seen from slightly above at a natural angle, as if someone put it down and took a quick photo with the phone. NO person, NO hands, NO body part anywhere in the frame, only the product and its surroundings.",
    sugestao: "O produto sozinho em cima da bancada, de frente pra câmera, sem ninguém no quadro",
    temMaos: false,
  },
];

export function variacaoPovPorChave(chave?: string | null) {
  return VARIACOES_POV.find((v) => v.chave === chave) ?? VARIACOES_POV[0];
}

/**
 * Categorias de produto e o estilo de câmera que cai melhor em cada uma. Serve
 * pra AVISAR (nunca bloquear): se a pessoa escolheu "Vestindo" e mandou um fone
 * de ouvido, a tela sugere trocar pra "De frente" antes de gastar crédito.
 * A detecção é pelo TÍTULO do produto, que na Shopee costuma ser bem descritivo.
 */
type Categoria = {
  chave: string;
  nome: string; // como falamos dela na dica
  estilos: string[]; // estilos que combinam (o 1º é o recomendado)
  termos: string[]; // palavras que aparecem no título
};

const CATEGORIAS: Categoria[] = [
  {
    chave: "vestivel",
    nome: "roupa ou item vestível",
    estilos: ["vestindo", "espelho"],
    termos: [
      "camisa", "camiseta", "blusa", "cropped", "top", "regata", "vestido", "saia",
      "short", "bermuda", "calca", "calça", "legging", "jeans", "conjunto", "macacao",
      "macacão", "pijama", "body", "sutia", "sutiã", "lingerie", "biquini", "biquíni",
      "maio", "maiô", "jaqueta", "casaco", "moletom", "blazer", "sueter", "suéter",
      "tenis", "tênis", "sapato", "sandalia", "sandália", "bota", "chinelo", "sapatilha",
      "salto", "meia", "oculos", "óculos", "relogio", "relógio", "bone", "boné",
      "chapeu", "chapéu", "cinto", "bolsa", "mochila",
    ],
  },
  {
    chave: "beleza",
    nome: "produto de beleza",
    estilos: ["selfie"],
    termos: [
      "creme", "serum", "sérum", "hidratante", "protetor solar", "skincare", "sabonete",
      "shampoo", "condicionador", "mascara", "máscara", "batom", "gloss", "base",
      "corretivo", "po compacto", "pó compacto", "blush", "rimel", "rímel", "delineador",
      "perfume", "colonia", "colônia", "desodorante", "esmalte", "cilios", "cílios",
      "sobrancelha", "maquiagem", "labial", "facial", "capilar", "anti-idade", "acne",
    ],
  },
  {
    chave: "gadget",
    nome: "acessório ou gadget",
    estilos: ["maos", "de_frente"],
    termos: [
      "fone", "carregador", "cabo", "power bank", "powerbank", "suporte celular",
      "capinha", "capa celular", "pelicula", "película", "mouse", "teclado", "pen drive",
      "adaptador", "smartwatch", "caixa de som", "microfone", "ring light", "tripe",
      "tripé", "lanterna", "chaveiro", "organizador", "utensilio", "utensílio",
      "descascador", "ralador", "abridor", "cortador", "escova", "pinca", "pinça",
      "aparador", "massageador", "seringa", "dosador",
    ],
  },
  {
    chave: "destaque",
    nome: "produto que precisa aparecer inteiro",
    estilos: ["de_frente"],
    termos: [
      "brinquedo", "boneca", "boneco", "livro", "jogo", "quebra-cabeca", "quebra-cabeça",
      "kit", "garrafa", "copo", "caneca", "panela", "liquidificador", "air fryer",
      "airfryer", "ventilador", "luminaria", "luminária", "vaso", "quadro", "almofada",
      "suplemento", "whey", "vitamina", "colageno", "colágeno", "cha", "chá",
    ],
  },
];

/** tira acento e deixa minúsculo, pra casar "calça" com "calca". */
function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Descobre a categoria pelo título do produto (null se não reconhecer). */
export function categoriaDoProduto(titulo: string): Categoria | null {
  const t = normalizar(titulo);
  let melhor: { cat: Categoria; peso: number } | null = null;
  for (const cat of CATEGORIAS) {
    for (const termo of cat.termos) {
      const alvo = normalizar(termo);
      // casa como palavra inteira (evita "top" dentro de "notebook")
      const re = new RegExp(`(^|[^a-z0-9])${alvo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      if (re.test(t) && (!melhor || alvo.length > melhor.peso)) {
        melhor = { cat, peso: alvo.length };
      }
    }
  }
  return melhor?.cat ?? null;
}

/**
 * Dica de combinação entre o produto escolhido e o estilo de câmera.
 * Devolve null quando está tudo certo (ou quando não deu pra reconhecer).
 */
export function dicaDeEstilo(
  tituloProduto: string,
  estiloEscolhido: string,
): { mensagem: string; sugerido: EstiloCamera } | null {
  const cat = categoriaDoProduto(tituloProduto);
  if (!cat || cat.estilos.includes(estiloEscolhido)) return null;
  const sugerido = estiloPorChave(cat.estilos[0]);
  if (!sugerido) return null;
  return {
    mensagem: `Isso parece ${cat.nome}. Esse tipo de produto costuma render mais no estilo "${sugerido.label}".`,
    sugerido,
  };
}
