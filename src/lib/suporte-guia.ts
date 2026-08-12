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
 * Cada passo DIZ QUAIS SÃO AS OPÇÕES daquela tela e o que cada uma faz. Sem
 * isso o passo virava um "escolhe o que combina" que não ajuda ninguém: a
 * pessoa chega numa tela com cinco cartões e continua sem saber qual clicar,
 * que foi exatamente a reclamação do teste. A lista sai em linhas com "-"
 * porque o widget mantém lista inteira num balão só (ver `partirResposta`).
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
      {
        texto:
          "a primeira tela pergunta o estilo de câmera, que é o jeito que o influenciador aparece com o produto:\n\n" +
          "- De frente: segura o produto na altura do peito. Bom pra eletrônico, brinquedo e livro.\n" +
          "- Selfie: bem perto do rosto. Bom pra cosmético, skincare e perfume.\n" +
          "- Mãos: só as mãos aparecem demonstrando o produto. Bom pra acessório, gadget e comida.\n" +
          "- Vestindo: corpo inteiro usando o produto. Pra roupa, calçado, óculos e relógio.\n" +
          "- Frente ao espelho: selfie no espelho, corpo inteiro. Pra moda e look.\n\n" +
          "Qual deles combina com o seu produto?",
      },
      {
        texto:
          "agora o produto. Dá pra subir a foto do seu ou pegar uma pronta na busca da Shopee e do TikTok Shop. " +
          'Logo abaixo você escreve como ele deve aparecer na cena, que é a POSIÇÃO ("segurando na altura do peito, rótulo virado pra câmera"), nunca a cor nem o material: isso já vem da foto. ' +
          'Se não souber o que escrever, o atalho "A IA escreve pra você" faz isso de graça na própria tela. Conseguiu?',
      },
      {
        texto:
          "agora o influenciador, que é quem segura o produto. Você usa um dos 9 prontos da plataforma, que são de graça, " +
          'um seu, ou marca "Nenhum", que gera uma pessoa anônima. No estilo Mãos pode deixar em Nenhum mesmo, porque ali só aparecem as mãos. Escolheu?',
      },
      {
        texto:
          "agora o cenário, que é o lugar onde a cena acontece. São fotos de ambiente pra escolher (sala, cozinha, quarto, rua, academia, praia e outros) " +
          'e no fim da lista tem "Subir meu cenário", pra usar a foto do seu próprio ambiente. Escolheu?',
      },
      {
        texto: `agora aparece o resumo de tudo que você escolheu. Confere com calma e manda gerar a imagem: custa ${CUSTO_IMAGEM_LAB} créditos e leva alguns instantes. Gerar de novo cobra de novo, por isso vale conferir antes. A imagem apareceu?`,
      },
      {
        texto:
          "agora o vídeo. Primeiro a duração:\n\n" +
          "- 6 segundos: sem fala, só o produto aparecendo. Bom pra capa e anúncio curto.\n" +
          "- 10 segundos: dá uma frase de venda.\n" +
          "- 15 segundos: fala completa, com gancho, benefício e chamada. É a mais usada.\n\n" +
          "Depois escolhe a voz e o tom (animado, calmo, urgente ou divertido) e escreve o que ele vai falar. A IA escreve a fala de graça se você quiser. Fez?",
      },
      {
        texto:
          "agora o movimento de câmera, que é como a cena se mexe no vídeo. A lista muda conforme o estilo que você escolheu no começo, " +
          "então aparecem só os movimentos que combinam com a sua imagem. Escolheu?",
      },
      {
        texto:
          "confere o resumo do vídeo e manda gerar. Leva de 3 a 5 minutos e você pode fechar a aba, que a produção continua no servidor. Mandou?",
      },
      {
        texto:
          "é isso! Quando ficar pronto o vídeo aparece em Meus vídeos, com o botão de baixar, e o sininho lá em cima te avisa. Pode abrir pelo botão abaixo.",
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
      {
        texto:
          "primeiro o formato da historinha. São dois:\n\n" +
          "- Historinha de fruta: frutas do tamanho de gente vivendo drama de novela. É a trend que está rodando.\n" +
          "- Senhora brasileira: uma senhora no tanque ou na cozinha falando com a câmera, como se um neto tivesse começado a filmar.\n\n" +
          "Qual você quer?",
      },
      {
        texto:
          "agora os personagens. Na historinha de fruta são a Moranguinha, o Abacatão, o Bananinho e a Uvazinha; a senhora brasileira é a Dona Cida, sozinha. " +
          "Lembrando: 1 personagem faz vídeo de 15 segundos, 2 ou 3 fazem de 10. Escolheu?",
      },
      {
        texto:
          "agora a historinha em si, e são 3 caminhos: usar uma das 10 prontas (confissão de madrugada, briga de casal, traição revelada, reencontro e por aí), " +
          "escrever a sua ou pedir pra IA escrever, que é de graça. Qual você prefere?",
      },
      {
        texto:
          "agora o cenário da historinha: cozinha, feira, bar, restaurante, academia, praia, balada, quintal e outros. " +
          "Nas historinhas da Dona Cida os cenários são de casa mesmo: tanque, fogão, varal, horta e sala. Escolheu?",
      },
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
      {
        texto:
          "a tela vai em 5 etapas, e a primeira pergunta de onde o seu vídeo parte:\n\n" +
          "- Vídeo com fala: você já tem um vídeo com alguém falando na câmera, seja você ou outra pessoa. Ele roda por baixo do começo ao fim, com o som dele, e as fotos do produto entram por cima.\n" +
          "- Voz de IA narrando: não tem ninguém falando em vídeo. Suas fotos e vídeos tocam em sequência e uma voz de IA narra por cima. Aí você escolhe se a IA escreve a fala ou se você digita o texto.\n\n" +
          "Qual dos dois?",
      },
      {
        texto:
          "etapa 2, é um produto? Ela começa no Não, que é o caso mais comum (corte, meme, vídeo informativo), e aí a única pergunta é se você quer a fala do vídeo escrita na tela (a legenda sai da transcrição do próprio áudio, que continua ligado) ou o vídeo sem legenda nenhuma. " +
          "No Sim aparecem o nome e o preço do produto, e o resto depende de onde o vídeo parte:\n\n" +
          "- Vídeo com fala: a fala do vídeo já é a narração, então a escolha é só entre Transcrever fala (legenda no tempo certo da fala, som original ligado) e Nenhum (sem legenda).\n" +
          "- Voz de IA narrando: a IA escreve a copy a partir da descrição do produto, e você escolhe o tom dela e onde vai vender (Shopee ou outro). Se na etapa 1 você marcou 'A IA escreve', o produto é obrigatório: é dele que ela tira o assunto.\n\n" +
          "Escolheu?",
      },
      {
        texto:
          "etapa 3, as mídias. No vídeo com fala, sobe primeiro esse vídeo e depois as fotos e vídeos do produto, que são as cenas de apoio. " +
          "Na voz de IA, sobe tudo junto na ordem em que quer que apareça. Aqui também dá pra escrever textos que aparecem na tela.\n\n" +
          "Nesta mesma etapa, embaixo de cada mídia tem um campo pra dizer o que aparece nela. É isso que faz a cena entrar no ponto certo da fala, e a que ficar sem descrição fica marcada em âmbar. " +
          "No vídeo com fala toda cena de apoio PRECISA de descrição pra continuar. Escrever você mesmo é de graça; cada cena tem um botão de varinha (e embaixo da lista tem o botão em lote) pra IA olhar e escrever por você, a 1 crédito por cena. " +
          "No vídeo com fala vale descrever também o vídeo principal: a IA escuta a fala, mas não enxerga a imagem, então dizer o que aparece nele ajuda ela a encaixar as cenas na hora certa. Subiu?",
      },
      {
        texto:
          "etapa 4, som e acabamento: cortar as partes sem fala (já vem ligado em 0,5s), música de fundo (suba a sua, ou ligue a chave 'Usar músicas da plataforma', que vem desligada, e aí dá pra escolher a trilha da biblioteca ou deixar a IA sortear; sem nenhuma das duas o vídeo sai sem trilha), volume de cada coisa e a edição avançada, " +
          "que é o zoom lento nas fotos, a transição entre as cenas e a IA escolhendo o melhor pedaço de cada apoio. O som das cenas de apoio vem desligado, porque o barulho delas costuma atrapalhar a fala. Fez?",
      },
      {
        texto:
          "etapa 5, a aprovação. Depois de posicionar, a tela vira um editor: o vídeo fica em cima e embaixo vem a linha do tempo com duas linhas (a de cima são as cenas de apoio, cada uma com a miniatura da mídia, no segundo em que entra; a de baixo é o vídeo base, a fala, num bloco só). " +
          "Ali dá pra ajustar sem gastar crédito: arraste a cena pra outro momento (uma nunca fica em cima da outra: o bloco encosta e para), puxe as alças das pontas pra mudar quanto tempo ela fica na tela e toque nela pra abrir os ajustes finos (segundo exato e, em vídeo com sobra de corte, qual pedaço do arquivo aparece; ali também tem o 'abrir nas mídias'). " +
          "Tocar na régua de segundos leva a prévia praquele ponto. Confere e clica em Aprovar e gerar. Chegou aqui?",
      },
      {
        texto:
          "pronto, agora é esperar uns minutos. O vídeo montado aparece em Meus vídeos, no botão abaixo.",
        rota: "/painel",
        nome: "Meus vídeos",
      },
    ],
  },
  {
    chave: "criar-corte",
    nome: "Criar um Corte",
    passos: [
      {
        texto:
          "abra o Criar um Corte pelo botão abaixo e me diz quando estiver na tela, que a gente faz junto.",
        rota: "/painel/criar-corte",
        nome: "Criar um Corte",
      },
      {
        texto:
          "sobe o vídeo que está no seu computador. Aqui não entra IA nenhuma: é só pra limpar a sua gravação. Conseguiu subir?",
      },
      {
        texto:
          "agora os pedaços que saem. Ande na barra do vídeo até onde o trecho ruim começa, toque em Começar a cortar aqui, ande até onde ele acaba e feche o corte. " +
          "O que fica vermelho na barra some, e a prévia já pula esses trechos. Pode marcar quantos quiser. Marcou?",
      },
      {
        texto:
          "se quiser, ligue o Cortar partes sem fala: todo trecho calado por mais tempo que você escolher sai fora sozinho, imagem e som juntos. Escolheu?",
      },
      {
        texto:
          "manda gerar. O corte aparece em Meus vídeos em poucos minutos, no botão abaixo.",
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
          "cola o link do vídeo do YouTube. Só YouTube por enquanto, e o vídeo precisa ser público: privado, não listado ou com restrição de idade não baixa. Colou?",
      },
      {
        texto:
          "agora a duração de cada corte: 30 segundos, 1 minuto ou 1 minuto e meio. Escolheu?",
      },
      {
        texto:
          "agora a legenda, que você liga ou desliga. Ligada, dá pra escolher a cor (amarelo, branco ou verde) e a posição (em cima, no meio ou embaixo). Fez?",
      },
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
          "abra a tela Novo influenciador pelo botão abaixo e me diz quando estiver nela, que a gente faz junto.",
        rota: "/painel/meus-avatares/criar",
        nome: "Novo influenciador",
      },
      {
        texto:
          "a tela tem 3 cartões:\n\n" +
          "- Do zero, sem foto: um quiz de 7 perguntas e a IA desenha a pessoa.\n" +
          "- A partir de uma foto real: você manda o rosto e ele vira o seu influenciador.\n" +
          "- Junto com um produto: ele já nasce segurando o que você vende.\n\n" +
          `Os três custam ${CUSTO_AVATAR} créditos. Qual deles?`,
      },
      {
        texto:
          "agora as perguntas da tela: identidade (nome, idade e gênero), tom de pele, tipo físico, cor do cabelo, estilo do cabelo, " +
          "detalhes como barba, óculos e sardas, e a camisa. Dica: camisa lisa e escura, porque estampa rouba a atenção do produto. Terminou?",
      },
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
  // Cortar o MEU arquivo (tirar pedaço ruim, tirar silêncio) é o "Criar um Corte".
  // Vem antes das outras duas porque "cortar meu vídeo" casaria com o Editor pelo
  // "meu video" e com os Cortes pelo "cortar", e não é nenhum dos dois.
  if (casa(/silencio|parte ruim|pedaco ruim|trecho ruim|criar um corte/) ||
      (casa(/cortar|corte|tirar|limpar/) &&
       casa(/meu video|minha gravacao|meu arquivo|meu computador|que eu gravei/)))
    return achar("criar-corte");
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

/**
 * "pronto, o que faço?" e parentes.
 *
 * A lista fechada só pega a frase exata, então "pronto" entrava e "pronto, o
 * que faço?" caía no modelo. Foi assim que, num teste real, ele pulou do passo
 * 1 direto pro "clique em gerar": a pessoa avisou que estava na tela e ele
 * respondeu no vácuo. Confirmação com pergunta grudada é a mesma coisa que
 * "pode seguir", então é da guia.
 *
 * O casamento é ANCORADO (do começo ao fim da frase, sem sobra) de propósito:
 * "o que faço se der erro" é dúvida de verdade e continua indo pro modelo.
 */
const OK = "sim|ok|blz|beleza|certo|pronto|prontinho|feito|fiz|ja fiz|abri|ja abri|entrei|cheguei|isso|aham|uhum|e|entao|agora|ta|ta bom";
const PEDE_PROXIMO = new RegExp(
  `^(?:(?:${OK})\\s+)*(?:` +
    `(?:o\\s+que|que|oq|como)\\s+(?:eu\\s+)?(?:faco|fazer|faz|sigo|prossigo)(?:\\s+(?:agora|entao|depois|primeiro))?` +
    `|(?:e\\s+)?(?:agora|depois|entao)` +
    `)$`,
);

export function querSeguir(texto: string): boolean {
  const t = simplificar(texto);
  if (SEGUIR.has(t) || PEDE_PROXIMO.test(t)) return true;
  return t.length <= 60 && PEDE_CONDUCAO.test(t);
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

/**
 * O lembrete de "você está no passo N" que vai junto do prompt quando quem
 * responde é o MODELO.
 *
 * Sem isto ele responde no vácuo: num teste real, com a pessoa parada no passo
 * 1 do Labs, ele mandou "agora clique em Gerar e espere alguns minutos", ou
 * seja, pulou sete telas que ela ainda não tinha visto. A guia só assume a
 * conversa em frases fechadas ("pode seguir"); em qualquer outra o modelo
 * precisa saber onde a conversa está, senão chuta.
 *
 * `null` quando não há passo a passo rolando (aí o prompt normal basta).
 */
export function contextoDoPasso(historico: FalaBot[]): string | null {
  const onde = ondeParou(historico);
  if (!onde) return null;

  const { guia, indice } = onde;
  const total = guia.passos.length;
  const atual = guia.passos[indice];
  const proximo = guia.passos[indice + 1];

  const linhas = [
    `=== ONDE A CONVERSA ESTÁ (vale mais que qualquer exemplo acima) ===`,
    `Você está conduzindo o passo a passo do caminho "${guia.nome}" e a última coisa que mandou foi o Passo ${indice + 1} de ${total}.`,
    `Passo ${indice + 1}, o que a pessoa está fazendo AGORA: ${atual.texto}`,
    proximo
      ? `Passo ${indice + 2}, o próximo, só depois que ela disser que fez o de cima: ${proximo.texto}`
      : `Esse era o último passo: se ela disser que deu certo, comemore em uma frase e ofereça ajuda com outra coisa.`,
    `É PROIBIDO pular passo. Nada de "manda gerar", "clique em gerar" ou "espere ficar pronto" enquanto faltar passo pra fazer.`,
    `Se ela perguntou alguma coisa, responda a dúvida dela e termine lembrando o que falta fazer NESTE passo, com as opções da tela.`,
    `Se ela disse que já fez, mande o próximo passo acima, com as opções dele.`,
  ];
  return linhas.join("\n");
}
