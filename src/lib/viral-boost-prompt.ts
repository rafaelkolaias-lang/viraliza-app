import "server-only";

import {
  cenarioFrutaPorChave,
  type Batida,
  type FrutaPersonagem,
  type Historinha,
} from "@/lib/viral-boost";

/**
 * Prompts do Viral Boost (historinha de fruta).
 *
 * São dois: o da CENA (imagem com as frutas no cenário) e o do VÍDEO de 10s que
 * anima essa cena. A cena vem antes de propósito: o motor só aceita UMA imagem
 * de referência num vídeo de 15s, então juntar as frutas numa foto só é o que
 * permite historinha de casal e de triângulo.
 *
 * Os blocos vieram da engenharia que levantamos, com dois que valem pra qualquer
 * geração e são os melhores do material:
 *  - ESCALA ancorada em número e depois em interação ("1,60m a 1,80m" e "fica
 *    atrás do balcão, não em cima"). Só dizer "do tamanho de uma pessoa" não
 *    convence o modelo; a lista de interações convence.
 *  - SAÍDA LIMPA com regra de desempate ("na dúvida, não coloque").
 */

const UNIVERSO = [
  "MUNDO SEM HUMANOS: todos os personagens são frutas antropomórficas vivendo vida de gente normal.",
  "As frutas são PERSONAGENS DO TAMANHO DE PESSOAS DE VERDADE (1,60m a 1,80m de altura), com corpo humano: braços, pernas e mãos. Andam em pé, gesticulam, sentam em cadeira, encostam no balcão, abrem porta.",
  "Elas ocupam o espaço NA ESCALA DE UM ADULTO: ficam ATRÁS do balcão e não em cima dele, sentam à mesa, encostam na parede.",
  "NUNCA mostre fruta pequena em cima da bancada, dentro de fruteira, de cesto ou de geladeira, como item de mercado.",
  "NUNCA mostre mão, braço, rosto, corpo ou sombra de ser humano, em nenhum quadro, nem ao fundo.",
  "Se a cena pedir gente ao fundo, são OUTRAS FRUTAS antropomórficas em tamanho humano (uma laranja conversando, uma melancia passando). Nunca humanos.",
].join(" ");

const FIDELIDADE = [
  "FIDELIDADE ÀS IMAGENS DE REFERÊNCIA, PRIORIDADE MÁXIMA: as imagens anexadas mostram exatamente como cada personagem deve aparecer. Elas são a verdade absoluta.",
  "Copie fielmente a forma da fruta, a cor exata, a textura, o brilho, o rosto, o formato e a posição dos olhos, a boca e as proporções (relação cabeça e corpo).",
  "Mantenha o MESMO ESTILO da referência: mesma renderização 3D, mesmo sombreamento, mesma paleta, mesmo acabamento. Trate a imagem como o desenho oficial do personagem.",
  "Só podem mudar a pose, o gesto, a expressão e a roupa leve. Se a descrição escrita brigar com a imagem, a IMAGEM ANEXADA SEMPRE VENCE.",
].join(" ");

const LIMPEZA_VIDEO =
  "SAÍDA TOTALMENTE LIMPA, REGRA INEGOCIÁVEL: proibido qualquer texto na tela (legenda, caption, marca d'água, crédito, nome, logo), qualquer efeito sobreposto (brilho, partícula, estrelinha, coração, faísca, glitter, lens flare, glitch, zoom artificial), qualquer adesivo, seta, balão de fala, ícone ou interface de aplicativo, e qualquer som artificial (whoosh, ding, música de fundo). Só a cena, como uma novela filmada com câmera normal, com a voz das frutas e o som natural do ambiente. Na dúvida entre colocar um efeito ou não, NÃO coloque: cena limpa sempre vence.";

/**
 * Textura de pele do formato "senhora". É o bloco que decide se sai uma pessoa
 * de verdade ou uma propaganda de margarina, e o que mais importa nele são as
 * NEGATIVAS do fim: o padrão do modelo é pele lisa de catálogo, e isso precisa
 * ser desligado na mão.
 */
const TEXTURA_PESSOA = [
  "APARÊNCIA, CRÍTICO PRO REALISMO: pele com poros visíveis e textura real, rugas de verdade em volta dos olhos e da boca, de quem sorriu a vida toda, manchas de idade nas mãos e nos braços.",
  "Cabelo preso de qualquer jeito, com fios soltos no rosto, nada de penteado de salão. Roupa simples e um pouco desbotada, de uso.",
  "Aparência natural e sem retoque: NÃO alisada, NÃO suavizada, NÃO com filtro de beleza, NÃO glamourosa. Ela parece uma pessoa real filmada num celular, não uma modelo.",
].join(" ");

/**
 * Calibragem de idade: modelo envelhece idoso demais (pede 72, entrega 90). A
 * defesa é NOMEAR o erro em vez de só pedir o acerto.
 */
const CALIBRAGEM_IDADE =
  "CALIBRAGEM DE IDADE: ela tem EXATAMENTE 72 anos. Uma falha comum é fazer a pessoa idosa parecer de 85 a 95 anos, frágil e curvada. NÃO faça isso. Ela é ativa, forte, de pé, trabalhando. Calibre rugas, postura e pele para uma mulher de 72 anos saudável e ativa.";

/**
 * Descrição de um personagem dentro do prompt.
 *
 * O corpo depende do FORMATO: no universo das frutas ele é uma fruta do tamanho
 * de gente; no formato senhora é uma pessoa de verdade. Chamar tudo de "fruta
 * antropomórfica" brigava com o bloco de textura de pele e estragava justamente
 * o formato que mais depende de realismo.
 */
function personagem(
  f: FrutaPersonagem,
  papel: string,
  indice: number,
  frutinha: boolean,
): string {
  const corpo = frutinha
    ? "fruta antropomórfica do tamanho de uma pessoa adulta (~1,70m), corpo humanoide com braços, pernas e mãos"
    : "pessoa real brasileira, corpo e rosto humanos comuns, nada de estilização";
  return `${indice + 1}. ${f.nome.toUpperCase()} (${papel}): ${corpo}. Visual, rosto, proporção e estilo EXATAMENTE como na imagem de referência ${indice + 1} anexada. Jeito: ${f.jeito}. Só a pose, o gesto e a expressão mudam conforme a cena.`;
}

export type OpcoesBoost = {
  /** a historinha já resolvida (nossa ou escrita pela pessoa) */
  h: Historinha;
  frutas: FrutaPersonagem[];
  cenario: string;
  formato: string; // frutas | senhora
};

/** Prompt da CENA: a foto que depois vira o vídeo. */
export function montarPromptCenaFruta(o: OpcoesBoost): string {
  const h = o.h;
  const frutinha = o.formato !== "senhora";
  if (!h || !o.frutas.length) return "";
  const cen = cenarioFrutaPorChave(o.cenario);
  const nomes = o.frutas.map((f) => f.nome);
  const primeira = h.batidas(nomes)[0];

  return [
    frutinha
      ? `Gere UMA fotografia vertical 9:16 de uma cena de novela brasileira estrelada por ${
          o.frutas.length === 1 ? "um personagem-fruta" : `${o.frutas.length} personagens-fruta`
        }.`
      : "Gere UMA fotografia vertical 9:16, realista, tipo foto tirada de celular por um parente, de uma cena da vida real brasileira.",
    FIDELIDADE,
    frutinha ? UNIVERSO : `${TEXTURA_PESSOA} ${CALIBRAGEM_IDADE}`,
    `PERSONAGENS NA CENA: ${o.frutas.map((f, i) => personagem(f, h.papeis[i] ?? "personagem", i, frutinha)).join(" ")}`,
    `CENÁRIO: ${cen.descricao}. Toda a cena acontece dentro desse ambiente, com luz e som coerentes com ele.`,
    `MOMENTO RETRATADO: ${primeira.acao}`,
    o.frutas.length > 1
      ? "Todos os personagens aparecem JUNTOS no mesmo quadro, inteiros, sem ninguém cortado pela borda, em escala humana coerente entre si."
      : "O personagem aparece inteiro no quadro, centralizado, em escala humana coerente com o ambiente.",
    frutinha
      ? "ESTILO: render 3D de animação, rosto cartoon muito expressivo, iluminação realista de novela com sombras suaves que dão profundidade, câmera na altura dos olhos, plano médio."
      : "ESTILO: foto real de celular, luz natural do ambiente, sem luz artificial, leve profundidade de campo, câmera na altura do peito a uns 1,5 metro, plano médio da cintura pra cima.",
    "LIMPO: sem texto, sem legenda, sem logo, sem marca d'água, sem moldura, sem adesivo e sem efeito sobreposto. Na dúvida entre colocar algo em cima da foto ou não, NÃO coloque.",
    `CONFIRA NO FIM: cada fruta tem que ser idêntica à sua imagem de referência, todas do tamanho de gente, nenhum humano em cena e nenhum texto na imagem. Uma única foto vertical 9:16.`,
  ]
    .join(" ")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

/** Prompt do VÍDEO (animando a cena ou as fotos dos personagens). */
/**
 * Diz ao motor o que é cada foto anexada quando NÃO existe cena montada: uma
 * foto por personagem, na ordem. Sem isso ele mistura os personagens ou copia o
 * enquadramento da amostra em vez de montar a cena.
 */
function blocoFotosSoltas(o: OpcoesBoost): string {
  const lista = o.frutas
    .map((f, i) => `Referência ${i + 1} = ${f.nome.toUpperCase()}`)
    .join(", ");
  return [
    `FOTOS DE REFERÊNCIA (${o.frutas.length}), uma por personagem: ${lista}.`,
    "Cada foto define APENAS a aparência daquele personagem (cor, formato, rosto, proporção). Não copie o fundo, o enquadramento nem a pose das fotos: monte a cena descrita abaixo do zero, com todos juntos no mesmo ambiente.",
    o.frutas.length > 1
      ? "Todos aparecem no MESMO quadro, inteiros, em escala coerente entre si."
      : "O personagem aparece inteiro no quadro.",
  ].join(" ");
}

export function montarPromptVideoFruta(
  o: OpcoesBoost & { comCena?: boolean; duracaoSeg?: 10 | 15 },
): string {
  const h = o.h;
  // 15s quando vai uma imagem so pro motor, 10s quando vao varias
  const dur = o.duracaoSeg ?? 10;
  const marcos = dur === 15 ? [0, 5, 10, 15] : [0, 3, 7, 10];
  const frutinha = o.formato !== "senhora";
  if (!h || !o.frutas.length) return "";
  const cen = cenarioFrutaPorChave(o.cenario);
  const nomes = o.frutas.map((f) => f.nome);
  const batidas: Batida[] = h.batidas(nomes);

  const falas = batidas
    .map((b, i) => `${i + 1}. ${b.fala}`)
    .join(" ");

  return [
    // idioma primeiro: é a regra que mais escapa
    "IDIOMA OBRIGATÓRIO, PRIORIDADE MÁXIMA: toda fala e narração devem ser EXCLUSIVAMENTE em português do Brasil, com sotaque brasileiro natural e ritmo de novela. Nenhuma palavra em inglês ou outro idioma, MESMO QUE alguma parte deste pedido esteja escrita em inglês. Se sair palavra em outro idioma, o vídeo está errado.",
    frutinha
      ? `Anime esta foto em um vídeo VERTICAL 9:16 de ${dur} segundos, uma cena de novela brasileira com personagens-fruta. Formato horizontal ou quadrado é proibido.`
      : `Anime esta foto em um vídeo VERTICAL 9:16 de ${dur} segundos, gravado de celular na mão com leve tremida natural, como se um parente estivesse filmando de surpresa. Formato horizontal ou quadrado é proibido.`,
    "A FOTO É A VERDADE: mantenha exatamente os mesmos personagens da imagem (forma, cor, rosto, proporção, roupa) e o mesmo cenário. Não troque ninguém, não redesenhe e não mude o estilo.",
    frutinha ? UNIVERSO : `${TEXTURA_PESSOA} ${CALIBRAGEM_IDADE}`,
    `HISTÓRIA: "${h.nome}". ${h.sinopse} Tom: ${h.tom}.`,
    `CENÁRIO: ${cen.descricao}.`,
    o.comCena ? "" : blocoFotosSoltas(o),
    // as três batidas viram a linha do tempo do vídeo
    `ROTEIRO DOS ${dur} SEGUNDOS, nesta ordem exata. ${marcos[0]}s a ${marcos[1]}s, ${batidas[0].rotulo}: ${batidas[0].acao} ${marcos[1]}s a ${marcos[2]}s, ${batidas[1].rotulo}: ${batidas[1].acao} ${marcos[2]}s a ${marcos[3]}s, ${batidas[2].rotulo}: ${batidas[2].acao}`,
    "ENCENAÇÃO OBRIGATÓRIA: cada ação acontece no momento certo do vídeo, não só no último quadro. Se um personagem entra em cena, ele entra no começo ou no meio, com tempo de reagir e falar, nunca no último segundo. Quem fala só fala depois de estar visível.",
    `FALAS EXATAS, em português do Brasil, nesta ordem, palavra por palavra: ${falas}`,
    o.frutas.length > 1
      ? `ATRIBUIÇÃO DE FALA, REGRA ABSOLUTA: cada fala sai da boca do personagem indicado nela, na ordem listada. A boca de quem fala anima em sincronia perfeita com cada palavra, e a boca dos outros fica FECHADA na vez deles. Vozes diferentes por personagem (timbre e gênero coerentes com cada um). Trocar quem fala invalida o vídeo.`
      : "A boca do personagem anima em sincronia perfeita com cada palavra da fala.",
    `VOZES: ${o.frutas
      .map((f) => `${f.nome} tem voz ${f.genero === "f" ? "feminina" : "masculina"} brasileira, ${f.jeito}`)
      .join("; ")}.`,
    frutinha
      ? "ESTILO: câmera vertical na altura dos olhos, plano médio ou close, movimentos sutis (leve aproximação, pequeno tilt). Os personagens ocupam boa parte do quadro. Rosto cartoon muito expressivo, micro movimentos o tempo todo (respira, balança, vibra de emoção). Iluminação realista de novela."
      : "ESTILO: celular na mão com tremida leve e natural, plano médio da cintura pra cima, câmera parada com pequena deriva. Movimento natural o tempo todo: ela respira, pisca, muda o peso do corpo. Nada de movimento dramático.",
    "ÁUDIO: só a voz das frutas em português do Brasil e o som natural do ambiente. Sem música de fundo e sem efeito sonoro.",
    LIMPEZA_VIDEO,
    `LEIA POR ÚLTIMO E OBEDEÇA ACIMA DE TUDO: vídeo vertical 9:16 de ${dur} segundos, os mesmos personagens das fotos, falas exatas em português do Brasil na ordem dada, nenhum humano em cena e nenhum texto na tela.`,
  ]
    .join(" ")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}
