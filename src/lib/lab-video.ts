/**
 * Regras do vídeo do Viraliza Lab. Client-safe (a tela usa pra montar os campos).
 *
 * São três durações e ponto: 6s SEMPRE sem fala (capa/anúncio), 10s com uma frase
 * de venda e 15s com a fala completa. O motor gera até 15s por vez, então nada
 * aqui é montado em pedaços: um vídeo = uma geração.
 *
 * `comFala` na duração diz o que ela ACEITA, não o que ela vai ser: 10s e 15s
 * também podem sair mudos quando a pessoa quiser só o movimento (é a escolha
 * `semFala` da tela).
 */

export type DuracaoLab = {
  chave: string;
  segundos: number;
  label: string;
  nota: string;
  comFala: boolean;
  custo: number; // créditos (centavos), cobrados só quando o vídeo fica pronto
};

// palavras que cabem por segundo de fala natural em pt-BR (medido nos vídeos que
// já saíram: ~2,3 palavras/s dá um ritmo bom, sem atropelar)
const PALAVRAS_POR_SEG = 2.3;

export function limitePalavras(segundos: number): number {
  return Math.round(segundos * PALAVRAS_POR_SEG);
}

/** Conta palavras de um texto (mesma conta que a tela mostra). */
export function contarPalavrasFala(t: string): number {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

/**
 * A fala cabe no tempo do vídeo? Fala maior que o orçamento sai atropelada ou
 * cortada no meio, e o crédito é cobrado do mesmo jeito, então isso trava o
 * botão de gerar em vez de só avisar.
 */
export function falaCabeNoTempo(fala: string, duracao: string, semFala = false): boolean {
  const d = duracaoPorChave(duracao);
  if (!d || !d.comFala || semFala) return true;
  return contarPalavrasFala(fala) <= limitePalavras(d.segundos);
}

/** O vídeo vai ter fala? Depende da duração E da escolha da pessoa. */
export function vaiTerFala(duracao: string, semFala?: boolean): boolean {
  const d = duracaoPorChave(duracao);
  return !!d?.comFala && !semFala;
}

export const DURACOES_LAB: DuracaoLab[] = [
  {
    chave: "6s",
    segundos: 6,
    label: "6 segundos",
    nota: "Sem fala, só o produto aparecendo. Ideal pra capa e anúncio curto.",
    comFala: false,
    custo: 50,
  },
  {
    chave: "10s",
    segundos: 10,
    label: "10 segundos",
    nota: "Uma frase de venda. O básico bem feito.",
    comFala: true,
    custo: 70,
  },
  {
    chave: "15s",
    segundos: 15,
    label: "15 segundos",
    nota: "Fala completa: gancho, benefício e chamada. O mais usado.",
    comFala: true,
    custo: 95,
  },
];

export function duracaoPorChave(chave?: string | null) {
  return DURACOES_LAB.find((d) => d.chave === chave) ?? null;
}

/** Tom da fala (entra no prompt e guia a IA a improvisar no ritmo certo). */
export const TONS_LAB = [
  { chave: "animado", label: "Animado", desc: "Vibrante e empolgado", en: "excited and upbeat, high energy" },
  { chave: "calmo", label: "Calmo", desc: "Suave e tranquilo", en: "calm, gentle and reassuring" },
  { chave: "urgente", label: "Urgente", desc: "Dinâmico e impactante", en: "urgent and punchy, creating a sense of scarcity" },
  { chave: "divertido", label: "Divertido", desc: "Casual e descontraído", en: "playful and casual, like talking to a friend" },
] as const;

/** Voz: gênero + tonalidade. O Grok usa a voz que combina com o avatar da cena. */
export const VOZES_LAB = [
  { chave: "feminina", label: "Feminina", en: "a natural female voice" },
  { chave: "masculina", label: "Masculina", en: "a natural male voice" },
] as const;

export const TONALIDADES_LAB = [
  { chave: "media", label: "Média", desc: "Equilibrada e neutra", en: "a medium natural pitch" },
  { chave: "grave", label: "Grave", desc: "Mais baixa e profunda", en: "a lower, deeper pitch" },
  { chave: "aguda", label: "Aguda", desc: "Mais alta e clara", en: "a higher, brighter pitch" },
  { chave: "doce", label: "Doce", desc: "Suave e acolhedora", en: "a soft, warm and welcoming voice" },
  { chave: "energetica", label: "Energética", desc: "Vibrante e animada", en: "a vibrant, energetic voice" },
  { chave: "seria", label: "Séria", desc: "Profissional e firme", en: "a serious, professional and firm voice" },
] as const;

/**
 * A estrutura que vende, dentro do MESMO vídeo: prende, mostra e chama. É a dica
 * que aparece embaixo do campo da fala.
 */
export const ESTRUTURA_FALA = [
  { titulo: "Gancho", resumo: "Prende nos 2 primeiros segundos" },
  { titulo: "Benefício", resumo: "O que o produto resolve" },
  { titulo: "Chamada", resumo: "Manda comprar no fim" },
];

export const EXEMPLO_FALA =
  "Gente, olha o que eu achei: uso todo dia e não largo mais. Corre no carrinho laranja que tá em promoção.";
