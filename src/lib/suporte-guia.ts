import { CUSTO_IMAGEM_LAB } from "@/lib/lab-custos";
import { CUSTO_AVATAR } from "@/lib/avatar-modelo";
import type { LinkTela } from "@/lib/suporte-conversas";

/**
 * PASSO A PASSO do robô de suporte, feito em CÓDIGO e não pelo modelo.
 *
 * Por que existe: pedir pro qwen2.5:14b "dê um passo por mensagem e continue de
 * onde parou" não funciona. Nos testes com usuário simulado ele escolhia o
 * número do passo no chute (mandava o 5, depois voltava pro 4), pulava etapas e,
 * quando a pessoa respondia só "sim" ou "vamos", largava tudo e perguntava "qual
 * é a sua dúvida?". Guiar alguém exige LEMBRAR em que passo a conversa está, e
 * isso é estado, não é criatividade: modelo pequeno não segura, código segura.
 *
 * Como o estado sobrevive sem banco: a conversa inteira volta pro servidor a
 * cada pergunta, então o robô descobre onde parou LENDO AS PRÓPRIAS MENSAGENS de
 * trás pra frente e achando o último passo que ele mesmo mandou. Os textos daqui
 * são a chave dessa busca, por isso eles são fixos.
 *
 * O modelo continua respondendo tudo que é pergunta de verdade; a guia só cuida
 * de "e agora?", que é justamente onde ele se perdia. De quebra, esses passos
 * saem na hora, sem os ~40 segundos de espera do LLM.
 */

export type PassoGuia = {
  /** o texto do passo, sem o "Passo N de M:" (o prefixo é montado na hora) */
  texto: string;
  /** tela pra oferecer junto (o texto precisa citar o botão) */
  rota?: string;
  nome?: string;
};

export type Guia = {
  chave: string;
  /** nome do caminho, do jeito que a pessoa leu na lista dos 4 caminhos */
  nome: string;
  passos: PassoGuia[];
};

/**
 * Os caminhos guiados. A ordem dos passos é a ordem real das telas.
 *
 * Preço nunca escrito na mão: vem das mesmas constantes que a plataforma cobra.
 */
export const GUIAS: Guia[] = [
  {
    chave: "labs",
    nome: "Viraliza Labs",
    passos: [
      {
        texto:
          "abra o Viraliza Labs pelo botão abaixo e me diz quando estiver na tela, que a gente faz junto.",
        rota: "/painel/lab",
        nome: "Viraliza Labs",
      },
      { texto: "ele começa perguntando o estilo de câmera. Escolhe o que combina com o seu produto e me avisa." },
      { texto: "agora sobe a foto do produto e escreve o que ele é, bem certinho. Conseguiu subir?" },
      {
        texto:
          "escolhe o influenciador que vai segurar o produto. Os prontos da plataforma são de graça. Escolheu?",
      },
      { texto: "agora o cenário, que é o lugar onde a cena acontece. Escolheu?" },
      {
        texto: `confere o resumo e manda gerar a imagem. Custa ${CUSTO_IMAGEM_LAB} créditos e leva alguns instantes. A imagem apareceu?`,
      },
      {
        texto:
          "agora escolhe a duração do vídeo e o que o influenciador vai falar. Se preferir, a IA escreve a fala de graça. Fez?",
      },
      {
        texto:
          "manda gerar o vídeo. Ele leva alguns minutos e você pode fechar a aba que a produção continua. Mandou?",
      },
      {
        texto:
          "é isso! Quando ficar pronto ele aparece em Meus vídeos, com o botão de baixar. Pode abrir pelo botão abaixo.",
        rota: "/painel",
        nome: "Meus vídeos",
      },
    ],
  },
  {
    chave: "boost",
    nome: "Viral Boost",
    passos: [
      {
        texto:
          "abra o Viral Boost pelo botão abaixo e me diz quando estiver na tela, que a gente faz junto.",
        rota: "/painel/viral-boost",
        nome: "Viral Boost",
      },
      { texto: "primeiro ele pergunta o formato da historinha. Escolheu?" },
      {
        texto:
          "agora os personagens. Lembrando: 1 personagem faz vídeo de 15 segundos, 2 ou 3 fazem de 10. Escolheu?",
      },
      {
        texto:
          "agora a historinha. Dá pra usar uma das 10 prontas, escrever a sua ou pedir pra IA escrever de graça. Qual você quer?",
      },
      { texto: "agora o cenário da historinha. Escolheu?" },
      {
        texto:
          "manda gerar e espera uns minutos. A historinha aparece em Meus vídeos quando ficar pronta, no botão abaixo.",
        rota: "/painel",
        nome: "Meus vídeos",
      },
    ],
  },
  {
    chave: "editor",
    nome: "Editor automático",
    passos: [
      {
        texto:
          "abra o Editor automático pelo botão abaixo e me diz quando estiver na tela, que a gente faz junto.",
        rota: "/painel/novo",
        nome: "Editor automático",
      },
      { texto: "sobe o vídeo que você já gravou. Conseguiu subir?" },
      {
        texto:
          "agora escolhe o modo: legenda, voz narrada, transcrever a fala ou nenhum. Se estiver na dúvida, legenda é o mais usado. Escolheu?",
      },
      { texto: "agora diz onde você vai vender e o tom da copy: agressivo, equilibrado ou tranquilo. Fez?" },
      { texto: "agora escolhe a voz e a música de fundo. Escolheu?" },
      {
        texto:
          "manda gerar e espera uns minutos. O vídeo montado aparece em Meus vídeos, no botão abaixo.",
        rota: "/painel",
        nome: "Meus vídeos",
      },
    ],
  },
  {
    chave: "cortes",
    nome: "Cortes",
    passos: [
      {
        texto: "abra os Cortes pelo botão abaixo e me diz quando estiver na tela, que a gente faz junto.",
        rota: "/painel/cortes",
        nome: "Cortes de qualquer vídeo",
      },
      {
        texto:
          "cola o link do vídeo do YouTube. Só YouTube por enquanto, e o vídeo precisa ser público. Colou?",
      },
      { texto: "agora escolhe a duração do corte: 30 segundos, 1 minuto ou 1 minuto e meio. Escolheu?" },
      { texto: "agora a legenda: liga ou desliga, e escolhe a cor e a posição. Fez?" },
      {
        texto:
          "manda gerar e espera uns minutos. Os cortes aparecem em Meus vídeos, no botão abaixo.",
        rota: "/painel",
        nome: "Meus vídeos",
      },
    ],
  },
  {
    chave: "influenciador",
    nome: "Criar influenciador",
    passos: [
      {
        texto:
          "abra a tela Criar com IA pelo botão abaixo e me diz quando estiver nela, que a gente faz junto.",
        rota: "/painel/meus-avatares/criar",
        nome: "Criar com IA",
      },
      {
        texto:
          "escolhe um dos 3 cartões: do zero sem foto, a partir de uma foto real ou junto com um produto. Escolheu?",
      },
      { texto: "agora responde as perguntas da tela sobre como a pessoa tem que ser. Terminou?" },
      {
        texto: `manda criar. Custa ${CUSTO_AVATAR} créditos e leva de 1 a 3 minutos. Importante: não clique de novo achando que travou, senão cobra duas vezes. Deu certo?`,
      },
    ],
  },
];

/** Tira acento e pontuação pra comparar o que a pessoa escreveu. */
function simplificar(txt: string): string {
  return txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O robô acabou de perguntar QUAL caminho? É desta pergunta que sai a escolha.
 *
 * São duas formas: a lista dos 4 caminhos, e a repescagem ("não peguei qual dos
 * quatro é o seu caso, você quer criar do zero ou já tem o vídeo gravado?"), que
 * o modelo usa quando a pessoa responde qualquer coisa fora da lista.
 */
export function ehListaDeCaminhos(texto: string): boolean {
  const t = texto.toLowerCase();
  if (t.includes("viraliza labs") && t.includes("viral boost") && t.includes("cortes")) return true;
  return /qual dos (4|quatro)/.test(t) || (/do zero/.test(t) && /grav/.test(t));
}

/**
 * Qual caminho a pessoa escolheu, respondendo à lista dos 4.
 *
 * Aceita o nome ("labs"), o número ("1"), o ordinal ("a primeira opção") e a
 * situação dela ("já gravei o vídeo", "quero vender um produto"), que é como a
 * maioria responde. Só roda logo depois da lista, então errar aqui é difícil.
 */
export function caminhoEscolhido(texto: string): Guia | null {
  const t = simplificar(texto);
  if (!t || t.length > 120) return null;

  const casa = (re: RegExp) => re.test(t);

  // situação descrita > nome da ferramenta > número/ordinal
  if (casa(/\bja gravei\b|\bgravei\b|meu video|video que eu|montar|legendar|narra|transcrever/)) return achar("editor");
  if (casa(/youtube|cortar|\bcorte/)) return achar("cortes");
  if (casa(/historinha|historia|personagem|novela|boost/)) return achar("boost");
  if (casa(/\blabs?\b|foto do produto|vender|produto|shopee|criativo|propaganda|anuncio|do zero/))
    return achar("labs");
  if (casa(/influenciador|avatar/)) return achar("influenciador");
  if (casa(/\b(1|um|primeir\w*)\b/)) return achar("labs");
  if (casa(/\b(2|dois|segund\w*)\b/)) return achar("boost");
  if (casa(/\b(3|tres|terceir\w*)\b/)) return achar("editor");
  if (casa(/\b(4|quatro|quart\w*)\b/)) return achar("cortes");
  return null;
}

function achar(chave: string): Guia | null {
  return GUIAS.find((g) => g.chave === chave) ?? null;
}

/**
 * A pessoa só disse "pode seguir".
 *
 * Lista fechada de propósito: qualquer coisa fora dela é pergunta de verdade e
 * vai pro modelo. Dar o próximo passo por engano no lugar de responder o que ela
 * perguntou seria pior do que não guiar.
 */
const SEGUIR = new Set([
  "sim", "s", "ok", "okay", "okey", "blz", "beleza", "certo", "isso", "isso ai", "aham", "uhum",
  "feito", "fiz", "ja fiz", "pronto", "prontinho", "consegui", "cheguei", "estou aqui", "to aqui",
  "tou aqui", "estou na tela", "to na tela", "vamos", "vamo", "bora", "pode", "pode ir", "pode sim",
  "manda", "manda ai", "continua", "continuar", "segue", "seguir", "proximo", "prosseguir",
  "e agora", "ok e agora", "e agora entao", "agora", "e depois", "depois", "deu certo", "escolhi",
  "sim pode", "sim feito", "tudo certo", "certo e agora", "ja abri", "abri", "entrei", "sim ja fiz",
]);

/**
 * "vai me falando o que fazer" e parentes: é pedido pra conduzir, igualzinho a
 * um "pode seguir". Ficou de fora da lista fechada porque a frase varia demais.
 */
const PEDE_CONDUCAO =
  /\b(vai|pode|va|continua|continue)(\s+(ir|indo))?\s+(me\s+)?(falando|dizendo|guiando|explicando|passando)|me\s+(fala|diz|guia|ensina|explica)\s+(o\s+que|como|os?\s+passos?)|(qual|quais)\s+(e|sao)\s+os?\s+proxim\w*\s+passos?|proximo\s+passo/;

export function querSeguir(texto: string): boolean {
  const t = simplificar(texto);
  return SEGUIR.has(t) || (t.length <= 60 && PEDE_CONDUCAO.test(t));
}

export type FalaBot = { autor: "user" | "bot"; texto: string };

/**
 * Quanto do começo do passo é usado pra reconhecê-lo numa mensagem antiga.
 *
 * O fim da frase não serve de âncora: o modelo às vezes escreve o primeiro passo
 * com as palavras dele ("...que a gente faz junto, combinado?") e uma comparação
 * do texto inteiro não casaria, deixando a conversa órfã justo depois do começo.
 * O começo da frase é bem mais estável, e 40 caracteres já separam um passo do
 * outro sem risco de confundir dois caminhos.
 */
const ANCORA = 40;

/** Onde a conversa parou: o último passo que o próprio robô mandou. */
export function ondeParou(historico: FalaBot[]): { guia: Guia; indice: number } | null {
  for (let i = historico.length - 1; i >= 0; i--) {
    const m = historico[i];
    if (m.autor !== "bot" || !m.texto) continue;
    const alvo = simplificar(m.texto);
    for (const guia of GUIAS) {
      const indice = guia.passos.findIndex((p) => alvo.includes(simplificar(p.texto).slice(0, ANCORA)));
      if (indice >= 0) return { guia, indice };
    }
  }
  return null;
}

export type RespostaGuia = { texto: string; links: LinkTela[] };

/** Monta a mensagem de um passo, já com "Passo N de M" e o botão da tela. */
function mensagem(guia: Guia, indice: number, abertura: string): RespostaGuia {
  const passo = guia.passos[indice];
  const texto = `${abertura}Passo ${indice + 1} de ${guia.passos.length}: ${passo.texto}`;
  return {
    texto,
    links: passo.rota ? [{ rota: passo.rota, nome: passo.nome ?? guia.nome }] : [],
  };
}

/**
 * A resposta da guia, se esta mensagem for caso dela. `null` = deixa com o modelo.
 *
 * São só dois casos, os dois seguros: a pessoa acabou de escolher um caminho na
 * lista dos 4, ou ela mandou seguir em frente enquanto um passo a passo já
 * estava rolando.
 */
export function respostaGuiada(historico: FalaBot[]): RespostaGuia | null {
  const ultima = historico[historico.length - 1];
  if (!ultima || ultima.autor !== "user") return null;

  const anterior = [...historico].slice(0, -1).reverse().find((m) => m.autor === "bot");

  // 1) respondeu à lista dos 4 caminhos: começa o passo a passo do escolhido
  if (anterior && ehListaDeCaminhos(anterior.texto)) {
    const guia = caminhoEscolhido(ultima.texto);
    if (guia) return mensagem(guia, 0, `Boa escolha. `);
  }

  // 2) já estava num passo a passo e mandou seguir
  if (querSeguir(ultima.texto)) {
    const onde = ondeParou(historico);
    if (!onde) return null;
    const proximo = onde.indice + 1;
    if (proximo >= onde.guia.passos.length) {
      return {
        texto:
          "Esse foi o último passo, terminamos! Se quiser fazer outro vídeo ou tiver qualquer dúvida, é só me chamar.",
        links: [],
      };
    }
    return mensagem(onde.guia, proximo, "");
  }

  return null;
}
