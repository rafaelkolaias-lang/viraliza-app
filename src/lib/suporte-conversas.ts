/**
 * Conversas do chat de suporte, guardadas no NAVEGADOR da pessoa.
 *
 * Por que não no banco: é papo com um robô sobre a documentação, não é dado de
 * negócio. Guardar no navegador não custa tabela, não custa migração e não põe
 * texto de usuário no servidor. O preço é que a conversa não segue a pessoa
 * quando ela troca de aparelho ou de navegador, o que aqui é aceitável.
 *
 * Cada conversa vale 24h a partir da ÚLTIMA mensagem: passou disso, ela some
 * sozinha na próxima abertura do widget.
 */

export type LinkTela = { rota: string; nome: string };
export type Entrega = "enviando" | "entregue" | "lido";

export type Msg = {
  id: number;
  autor: "user" | "bot";
  texto: string;
  links?: LinkTela[];
  hora?: string;
  entrega?: Entrega;
};

export type Conversa = {
  id: string;
  criadaEm: number;
  atualizadaEm: number;
  mensagens: Msg[];
};

const CHAVE = "suporte_conversas";
export const VALIDADE_MS = 24 * 60 * 60 * 1000;
/** teto de conversas guardadas: passou disso, a mais velha cai */
const MAX_CONVERSAS = 12;

export const SAUDACAO: Msg = {
  id: 0,
  autor: "bot",
  texto:
    "Oi! Aqui é o suporte do Viraliza. Posso explicar como criar vídeo, quanto custa cada coisa e onde fica cada tela. Pode perguntar à vontade, não gasta crédito.",
};

function novoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `c${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  }
}

export function conversaNova(): Conversa {
  const agora = Date.now();
  return { id: novoId(), criadaEm: agora, atualizadaEm: agora, mensagens: [SAUDACAO] };
}

/** Lê o que está guardado, já jogando fora o que passou de 24h. */
export function carregarConversas(): Conversa[] {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return [];
    const lista = JSON.parse(cru) as Conversa[];
    if (!Array.isArray(lista)) return [];
    const limite = Date.now() - VALIDADE_MS;
    return lista
      .filter((c) => c && Array.isArray(c.mensagens) && c.atualizadaEm > limite)
      .sort((a, b) => b.atualizadaEm - a.atualizadaEm);
  } catch {
    return [];
  }
}

export function salvarConversas(lista: Conversa[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, MAX_CONVERSAS)));
  } catch {
    /* cota cheia ou modo privado: a conversa segue só na tela */
  }
}

/** Nome da conversa na lista: a primeira coisa que a pessoa perguntou. */
export function tituloDaConversa(c: Conversa): string {
  const primeira = c.mensagens.find((m) => m.autor === "user");
  if (!primeira) return "Conversa nova";
  return primeira.texto.length > 42 ? `${primeira.texto.slice(0, 42)}...` : primeira.texto;
}

/** Tamanho alvo de cada balão. Acima disso vira parede de texto. */
const TAMANHO_BALAO = 170;
/** Teto de balões por resposta: mais que isso vira metralhadora de notificação. */
const MAX_BALOES = 4;

/**
 * Quebra a resposta do robô em balões, como uma pessoa digitando.
 *
 * Regras que importam:
 * - parágrafo é a divisão natural, então respeita as linhas em branco primeiro;
 * - **lista nunca é quebrada**: mandar "- Bronze: 5" e "- Prata: 12" em balões
 *   separados fica ilegível, a lista inteira vira um balão só;
 * - parágrafo comprido é cortado no fim de FRASE, nunca no meio;
 * - estourou o teto de balões, o resto todo entra no último.
 */
export function partirResposta(texto: string): string[] {
  const blocos = texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const pedacos: string[] = [];

  for (const bloco of blocos) {
    const ehLista = /^\s*([-*•]|\d+[.)])\s/m.test(bloco);
    if (ehLista || bloco.length <= TAMANHO_BALAO) {
      pedacos.push(bloco);
      continue;
    }
    // parágrafo comprido: junta frases até encher um balão
    const frases = bloco.split(/(?<=[.!?])\s+/);
    let atual = "";
    for (const frase of frases) {
      const junto = atual ? `${atual} ${frase}` : frase;
      if (junto.length > TAMANHO_BALAO && atual) {
        pedacos.push(atual);
        atual = frase;
      } else {
        atual = junto;
      }
    }
    if (atual) pedacos.push(atual);
  }

  if (pedacos.length === 0) return [texto.trim()];
  if (pedacos.length <= MAX_BALOES) return pedacos;
  return [
    ...pedacos.slice(0, MAX_BALOES - 1),
    pedacos.slice(MAX_BALOES - 1).join("\n\n"),
  ];
}

/** "agora", "há 20 min", "há 3 h", "ontem". */
export function quandoFoi(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return "ontem";
}
