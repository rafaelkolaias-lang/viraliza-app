/**
 * Viral Boost: historinhas de fruta no estilo novela, a trend que está rodando
 * no TikTok. Client-safe (a tela importa direto).
 *
 * A grande diferença pro concorrente: lá o vídeo é picado em takes de 8s e a
 * pessoa cola o prompt no VEO3 na mão. Aqui é UM vídeo de 10 segundos gerado
 * pelo nosso motor, então a historinha foi reescrita em TRÊS batidas curtas
 * (abertura, clímax e chamada) que cabem no tempo: 10s dão ~23 palavras de fala
 * no total, contando os três.
 */

const MEDIA = (
  process.env.NEXT_PUBLIC_LAB_MEDIA || "https://media.univershoop.com/lab"
).replace(/\/+$/, "");


/**
 * FORMATOS virais. Cada um é um universo com regras próprias de prompt: as frutas
 * precisam da regra de escala (senão viram fruta em cima da bancada) e a senhora
 * precisa do bloco de textura de pele (senão vira propaganda de margarina).
 */
export type Formato = {
  chave: string;
  nome: string;
  descricao: string;
  /** quantos personagens a cena aceita */
  maxPersonagens: number;
  /** aviso que aparece na tela (quando existe) */
  aviso?: string;
};

export const FORMATOS: Formato[] = [
  {
    chave: "frutas",
    nome: "Historinha de fruta",
    descricao: "Frutas do tamanho de gente vivendo drama de novela. A trend que está rodando.",
    maxPersonagens: 3,
  },
  {
    chave: "senhora",
    nome: "Senhora brasileira",
    descricao:
      "Uma senhora de verdade, no tanque ou na cozinha, falando com a câmera como se um neto tivesse começado a filmar.",
    maxPersonagens: 1,
    aviso:
      "Esse formato imita pessoa real. Marque o vídeo como conteúdo gerado por IA na hora de postar: sai muito mais barato que ter o perfil punido.",
  },
];

export function formatoPorChave(chave?: string | null) {
  return FORMATOS.find((f) => f.chave === chave) ?? FORMATOS[0];
}

export type FrutaPersonagem = {
  chave: string;
  nome: string;
  genero: "f" | "m";
  jeito: string; // como ele é (entra no prompt e ajuda a escolher)
  imagem: string;
  formato?: string; // de qual universo ele é (padrão: frutas)
  meu?: boolean; // true = personagem que a pessoa subiu
};

/** O elenco. Cada fruta é uma imagem de referência que trava o visual. */
export const FRUTAS: FrutaPersonagem[] = [
  {
    chave: "morango",
    nome: "Moranguinha",
    genero: "f",
    jeito: "dramática, coração mole, chora fácil",
    imagem: `${MEDIA}/frutas/morango.jpg`,
  },
  {
    chave: "abacate",
    nome: "Abacatão",
    genero: "m",
    jeito: "durão, marombeiro, fala grosso",
    imagem: `${MEDIA}/frutas/abacate.jpg`,
  },
  {
    chave: "banana",
    nome: "Bananinho",
    genero: "m",
    jeito: "sério, engomadinho, cara de quem esconde algo",
    imagem: `${MEDIA}/frutas/banana.jpg`,
  },
  {
    chave: "uva",
    nome: "Uvazinha",
    genero: "f",
    jeito: "esperta, debochada, sempre com uma resposta",
    imagem: `${MEDIA}/frutas/uva.jpg`,
  },
];

/** Elenco do formato "senhora brasileira". */
export const SENHORAS: FrutaPersonagem[] = [
  {
    chave: "senhora",
    nome: "Dona Cida",
    genero: "f",
    jeito: "senhora de 72 anos, ativa, humilde e carinhosa",
    imagem: `${MEDIA}/personagens/senhora.jpg`,
    formato: "senhora",
  },
];

/** O elenco da casa no formato escolhido. */
export function elencoDoFormato(formato: string): FrutaPersonagem[] {
  return formato === "senhora" ? SENHORAS : FRUTAS;
}

export function frutaPorChave(chave?: string | null) {
  return [...FRUTAS, ...SENHORAS].find((f) => f.chave === chave) ?? null;
}

/** Cenários da novela (a descrição é o que vai pro prompt). */
export type CenarioFruta = { chave: string; label: string; descricao: string };
export const CENARIOS_FRUTA: CenarioFruta[] = [
  { chave: "cozinha", label: "Cozinha de casa", descricao: "uma cozinha simples de casa brasileira, armários, pia e luz da janela" },
  { chave: "feira", label: "Feira livre", descricao: "uma feira livre colorida com barracas de madeira, caixotes empilhados e movimento ao fundo" },
  { chave: "bar", label: "Bar à noite", descricao: "um bar à meia-luz com luzes neon coloridas, balcão e taças brilhando" },
  { chave: "restaurante", label: "Restaurante", descricao: "um restaurante elegante com mesas postas, toalha branca, velas acesas e taças de cristal" },
  { chave: "academia", label: "Academia", descricao: "uma academia moderna com aparelhos de musculação, espelhos grandes e luz branca" },
  { chave: "praia", label: "Praia", descricao: "uma praia tropical no fim de tarde, areia dourada, coqueiros e ondas ao fundo" },
  { chave: "quintal", label: "Quintal", descricao: "um quintal gostoso com plantas, varal, balanço de madeira e luz do fim de tarde" },
  { chave: "balada", label: "Balada", descricao: "uma balada com luzes coloridas piscando, pista cheia e som alto" },
  { chave: "rua", label: "Rua da cidade", descricao: "uma calçada movimentada de cidade grande, vitrines acesas e luz urbana" },
  { chave: "shopping", label: "Shopping", descricao: "uma praça de alimentação de shopping com mesas, balcões iluminados e movimento" },
  { chave: "escritorio", label: "Escritório", descricao: "um escritório com mesas, computadores e janelas amplas" },
  { chave: "quarto", label: "Quarto", descricao: "um quarto simples com cama arrumada, abajur aceso e luz baixa de madrugada" },
];

/** Cenários do formato senhora (lugares de casa brasileira de verdade). */
export const CENARIOS_SENHORA: CenarioFruta[] = [
  { chave: "tanque", label: "Tanque de lavar", descricao: "um tanque de lavar roupa de concreto no quintal de uma casa simples, sabão em barra, bacia de plástico e varal com roupa balançando atrás" },
  { chave: "fogao", label: "Fogão", descricao: "uma cozinha simples de casa brasileira, panela no fogo, azulejo antigo e luz da janela" },
  { chave: "varal", label: "Varal", descricao: "um quintal com varal de arame cheio de roupa, muro pintado, plantas em vaso e chão de cerâmica gasta" },
  { chave: "horta", label: "Horta", descricao: "uma hortinha no quintal com temperos em vasos e regador na mão, luz do fim de tarde" },
  { chave: "sala", label: "Sala", descricao: "uma sala simples com sofá de tecido, toalhinha de crochê na mesa e retratos de família na parede" },
];

/** Os cenários do formato escolhido. */
export function cenariosDoFormato(formato: string): CenarioFruta[] {
  return formato === "senhora" ? CENARIOS_SENHORA : CENARIOS_FRUTA;
}

export function cenarioFrutaPorChave(chave?: string | null) {
  return (
    [...CENARIOS_FRUTA, ...CENARIOS_SENHORA].find((c) => c.chave === chave) ?? CENARIOS_FRUTA[0]
  );
}

/**
 * Uma batida da historinha: o que acontece na cena e a fala exata. São sempre
 * três, e a fala de cada uma é curta de propósito: o vídeo inteiro tem 10s.
 */
export type Batida = { rotulo: string; acao: string; fala: string };

export type Historinha = {
  chave: string;
  formato: string; // frutas | senhora
  nome: string;
  sinopse: string;
  tom: string;
  frutas: number; // quantas frutas a história pede
  papeis: string[];
  cenarioPadrao: string;
  /** monta as batidas com os nomes das frutas escolhidas */
  batidas: (nomes: string[]) => Batida[];
};

export const HISTORINHAS: Historinha[] = [
  {
    chave: "confissao",
    formato: "frutas",
    nome: "Confissão de madrugada",
    sinopse: "Três da manhã, sozinha. A fruta resolve desabafar tudo que guardou a vida inteira.",
    tom: "existencial e melancólico, monólogo de novela das nove",
    frutas: 1,
    papeis: ["protagonista"],
    cenarioPadrao: "cozinha",
    batidas: ([a]) => [
      {
        rotulo: "Abertura",
        acao: `${a} está sozinha, parada, olha para a câmera com expressão perdida e solta um suspiro fundo.`,
        fala: "Três da manhã e eu aqui de novo.",
      },
      {
        rotulo: "Clímax",
        acao: `${a} desvia o olhar, uma lágrima desce, e volta a encarar a câmera com firmeza.`,
        fala: "Fingi ser doce a vida toda. Por dentro, azeda.",
      },
      {
        rotulo: "Chamada",
        acao: `${a} respira fundo e abre um sorriso melancólico para a câmera.`,
        fala: "Comenta se você guarda algo assim.",
      },
    ],
  },
  {
    chave: "crise",
    formato: "frutas",
    nome: "Crise existencial",
    sinopse: "De repente cai a ficha e a fruta entra em colapso filosófico sobre a própria vida.",
    tom: "tragicômico, drama exagerado com humor",
    frutas: 1,
    papeis: ["protagonista"],
    cenarioPadrao: "feira",
    batidas: ([a]) => [
      {
        rotulo: "Abertura",
        acao: `${a} arregala os olhos, boca aberta em choque, mãos no rosto em desespero teatral.`,
        fala: "Espera… é HOJE? Por que logo hoje?",
      },
      {
        rotulo: "Clímax",
        acao: `${a} anda de um lado pro outro gesticulando, depois para e olha pro alto, derrotada.`,
        fala: "Então é isso. A vida é uma vitamina batida.",
      },
      {
        rotulo: "Chamada",
        acao: `${a} abre um olho de leve e dá uma piscadinha cúmplice pra câmera.`,
        fala: "Salva se você já se sentiu assim.",
      },
    ],
  },
  {
    chave: "amor_proibido",
    formato: "frutas",
    nome: "Amor proibido",
    sinopse: "Duas frutas de mundos opostos se amam escondido. Ninguém pode saber.",
    tom: "romântico e dramático, Romeu e Julieta de novela",
    frutas: 2,
    papeis: ["apaixonada 1", "apaixonada 2"],
    cenarioPadrao: "bar",
    batidas: ([a, b]) => [
      {
        rotulo: "Abertura",
        acao: `${a} e ${b} se encontram escondidos, olhando para os lados com medo de alguém ver.`,
        fala: `${a}: Se descobrirem a gente aqui, acabou.`,
      },
      {
        rotulo: "Clímax",
        acao: `${b} segura a mão de ${a} e encara ela de perto, decidida.`,
        fala: `${b}: Então deixa descobrir. Eu não largo você.`,
      },
      {
        rotulo: "Chamada",
        acao: `Os dois olham juntos para a câmera, sérios, e a cena fecha.`,
        fala: `${a}: Comenta se você ficaria com ela.`,
      },
    ],
  },
  {
    chave: "briga",
    formato: "frutas",
    nome: "Briga de casal",
    sinopse: "Dez anos juntos e hoje a indireta virou direta. Ciúme, drama e final inesperado.",
    tom: "novela das nove, discussão de casal com timing cômico",
    frutas: 2,
    papeis: ["brava", "culpada"],
    cenarioPadrao: "cozinha",
    batidas: ([a, b]) => [
      {
        rotulo: "Abertura",
        acao: `${a} está de braços cruzados encarando ${b}, que desvia o olhar sem jeito.`,
        fala: `${a}: Quem é a laranja que te mandou mensagem?`,
      },
      {
        rotulo: "Clímax",
        acao: `${b} gagueja e tenta se explicar; ${a} arregala os olhos, indignada.`,
        fala: `${b}: Era minha prima! Somos do mesmo cacho!`,
      },
      {
        rotulo: "Chamada",
        acao: `${a} olha pra câmera com cara de quem não engoliu nada.`,
        fala: `${a}: Comenta, você acreditaria nessa?`,
      },
    ],
  },
  {
    chave: "traicao",
    formato: "frutas",
    nome: "Traição revelada",
    sinopse: "Casal mais a amante. A verdade explode no pior momento possível.",
    tom: "novela das nove, dramático ao extremo com gancho no fim",
    frutas: 3,
    papeis: ["traída", "traidor", "amante"],
    cenarioPadrao: "restaurante",
    batidas: ([a, b, c]) => [
      {
        rotulo: "Abertura",
        acao: `${a} e ${b} estão numa mesa quando ${c} entra devagar atrás deles, séria.`,
        fala: `${c}: Boa noite. Não vai me apresentar?`,
      },
      {
        rotulo: "Clímax",
        acao: `${b} congela, ${a} vira a cabeça devagar e encara ${b} sem acreditar.`,
        fala: `${a}: Fala que ela tá mentindo. Fala!`,
      },
      {
        rotulo: "Chamada",
        acao: `${b} abre a boca pra responder e a cena corta na cara dele.`,
        fala: `${a}: Segue pra ver o que ele respondeu.`,
      },
    ],
  },
  {
    chave: "reencontro",
    formato: "frutas",
    nome: "Reencontro inesperado",
    sinopse: "Duas amigas que não se viam há anos se cruzam de novo. Risada, saudade e uma verdade no fim.",
    tom: "nostálgico e emotivo, papo de amigas com virada no final",
    frutas: 2,
    papeis: ["amiga 1", "amiga 2"],
    cenarioPadrao: "shopping",
    batidas: ([a, b]) => [
      {
        rotulo: "Abertura",
        acao: `${a} e ${b} se esbarram sem querer e param, se reconhecendo com um sorriso enorme.`,
        fala: `${a}: Não acredito! Quantos anos, hein?`,
      },
      {
        rotulo: "Clímax",
        acao: `As duas riem juntas, e aos poucos o sorriso de ${b} vai murchando.`,
        fala: `${b}: Muitos. Nunca te contei por que sumi.`,
      },
      {
        rotulo: "Chamada",
        acao: `${a} para de rir e olha pra câmera, curiosa, esperando.`,
        fala: `${a}: Comenta o que ela vai falar.`,
      },
    ],
  },
  // ---------- senhora brasileira ----------
  {
    chave: "aniversario",
    formato: "senhora",
    nome: "Aniversário dela",
    sinopse: "Ela para o que está fazendo, olha pra câmera e conta que é aniversário dela hoje.",
    tom: "caloroso e humilde, como avó falando com o neto",
    frutas: 1,
    papeis: ["protagonista"],
    cenarioPadrao: "tanque",
    batidas: ([a]) => [
      {
        rotulo: "Abertura",
        acao: `${a} está lavando roupa no tanque, para, enxuga as mãos no vestido e olha pra câmera com um sorriso tímido.`,
        fala: "Oi, meu povo! Tudo bom?",
      },
      {
        rotulo: "Clímax",
        acao: `${a} sorri com os olhos enrugando e fala com orgulho tranquilo.`,
        fala: "Hoje é meu aniversário. Setenta e dois anos, graças a Deus.",
      },
      {
        rotulo: "Chamada",
        acao: `${a} faz um gesto pequeno com a mão em direção à câmera.`,
        fala: "Deixa um parabéns pra mim?",
      },
    ],
  },
  {
    chave: "receita",
    formato: "senhora",
    nome: "A receita da vó",
    sinopse: "Ela está cozinhando e entrega o segredo que a mãe dela ensinou.",
    tom: "afetuoso e caseiro, papo de cozinha",
    frutas: 1,
    papeis: ["protagonista"],
    cenarioPadrao: "fogao",
    batidas: ([a]) => [
      {
        rotulo: "Abertura",
        acao: `${a} mexe a panela no fogão, olha pra câmera de lado e ri.`,
        fala: "Ó, que cheiro bom, hein?",
      },
      {
        rotulo: "Clímax",
        acao: `${a} aponta a colher pra câmera, como quem conta um segredo.`,
        fala: "Segredo da minha mãe: uma pitada de açúcar no refogado.",
      },
      {
        rotulo: "Chamada",
        acao: `${a} volta a mexer a panela e dá uma piscadinha.`,
        fala: "Comenta se sua vó fazia igual.",
      },
    ],
  },
  {
    chave: "conselho",
    formato: "senhora",
    nome: "Conselho de vó",
    sinopse: "Ela para tudo pra dar aquele conselho que só quem viveu muito dá.",
    tom: "sereno e sábio, com um tanto de humor",
    frutas: 1,
    papeis: ["protagonista"],
    cenarioPadrao: "varal",
    batidas: ([a]) => [
      {
        rotulo: "Abertura",
        acao: `${a} está estendendo roupa no varal, para com o prendedor na mão e olha pra câmera.`,
        fala: "Deixa eu te falar uma coisa, meu filho.",
      },
      {
        rotulo: "Clímax",
        acao: `${a} fala devagar, com firmeza, os olhos enrugando de leve.`,
        fala: "Não corre atrás de quem não te olha.",
      },
      {
        rotulo: "Chamada",
        acao: `${a} volta pro varal e solta um sorriso de canto pra câmera.`,
        fala: "Manda pra quem precisa ouvir isso.",
      },
    ],
  },
];

export function historinhaPorChave(chave?: string | null) {
  return HISTORINHAS.find((h) => h.chave === chave) ?? null;
}

/** As histórias do formato que cabem na quantidade de personagens escolhida. */
export function historinhasPara(qtd: number, formato = "frutas"): Historinha[] {
  return HISTORINHAS.filter((h) => h.formato === formato && h.frutas === qtd);
}

/**
 * Historinha ESCRITA PELA PESSOA: ela dá o título e as três falas, e a gente
 * monta a mesma estrutura das nossas (abertura, clímax e chamada). É o mesmo
 * caminho, só que o texto é dela.
 */
export type HistorinhaPropria = {
  nome: string;
  sinopse: string;
  tom: string;
  batidas: { rotulo: string; acao: string; fala: string }[];
};

export const ROTULOS_BATIDA = ["Abertura", "Clímax", "Chamada"];

/** Vira uma Historinha normal, pra seguir o mesmo caminho das nossas. */
export function historinhaDe(p: HistorinhaPropria, qtdPersonagens: number, formato: string): Historinha {
  return {
    chave: "propria",
    formato,
    nome: p.nome.trim() || "Minha historinha",
    sinopse: p.sinopse.trim(),
    tom: p.tom.trim() || "novela brasileira",
    frutas: qtdPersonagens,
    papeis: Array.from({ length: qtdPersonagens }, (_, i) => `personagem ${i + 1}`),
    cenarioPadrao: "cozinha",
    batidas: () => p.batidas,
  };
}

/**
 * Orçamento de palavras do vídeo (~2,3 palavras por segundo de fala).
 *
 * São 10 segundos, e não 15, por limite do motor: vídeo de 15s no Grok aceita
 * UMA imagem de referência só, e aqui a gente manda a foto de cada personagem.
 */
export const LIMITE_PALAVRAS = 23;

export function contarPalavras(texto: string) {
  return texto.trim() ? texto.trim().split(/\s+/).length : 0;
}

/** Hashtags pra pessoa copiar junto com o vídeo. */
export function hashtagsDa(h: Historinha, nomes: string[]): string[] {
  const base = ["#historinhadefruta", "#frutasfalantes", "#novelinha", "#dramadefruta", "#fyp"];
  const doPersonagem = nomes.map((n) => `#${n.toLowerCase().replace(/[^a-z0-9]/g, "")}`);
  return [...doPersonagem, ...base];
}
