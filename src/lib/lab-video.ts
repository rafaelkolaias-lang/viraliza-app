/**
 * Regras do vídeo do Viraliza Lab. Client-safe (a tela usa pra montar os campos).
 *
 * O motor (Grok) gera no máximo 15s por geração, então vídeo maior é feito em
 * TAKES: cada take é uma geração de 15s partindo da MESMA imagem base, e a fala
 * é escrita em pedaços que se emendam. O texto de cada take precisa terminar
 * "puxando" o próximo, senão o vídeo final parece três vídeos colados.
 */

export type DuracaoLab = {
  chave: string;
  segundos: number; // duração de CADA take
  takes: number;
  total: number; // segundos no fim
  label: string;
  nota: string;
  comFala: boolean;
};

// palavras que cabem por segundo de fala natural em pt-BR (medido nos vídeos que
// já saíram: ~2,3 palavras/s dá um ritmo bom, sem atropelar)
const PALAVRAS_POR_SEG = 2.3;

export function limitePalavras(segundos: number): number {
  return Math.round(segundos * PALAVRAS_POR_SEG);
}

export const DURACOES_LAB: DuracaoLab[] = [
  {
    chave: "6s",
    segundos: 6,
    takes: 1,
    total: 6,
    label: "6 segundos",
    nota: "Sem fala, só o produto aparecendo. Ideal pra capa e anúncio curto.",
    comFala: false,
  },
  {
    chave: "10s",
    segundos: 10,
    takes: 1,
    total: 10,
    label: "10 segundos",
    nota: "Uma frase de venda. O básico bem feito.",
    comFala: true,
  },
  {
    chave: "15s",
    segundos: 15,
    takes: 1,
    total: 15,
    label: "15 segundos",
    nota: "Fala completa: gancho, benefício e chamada. O mais usado.",
    comFala: true,
  },
  {
    chave: "2takes",
    segundos: 15,
    takes: 2,
    total: 30,
    label: "30 segundos",
    nota: "2 takes emendados: dá pra mostrar o produto e explicar direito.",
    comFala: true,
  },
  {
    chave: "3takes",
    segundos: 15,
    takes: 3,
    total: 45,
    label: "45 segundos",
    nota: "3 takes: review completo, do gancho até a chamada final.",
    comFala: true,
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

/** Papel de cada take na narrativa: é o que dá conexão lógica entre eles. */
export const PAPEL_TAKE = [
  {
    titulo: "Gancho",
    resumo: "Chama a atenção e apresenta o produto",
    exemplo: "Gente, olha o que eu achei e não consigo mais viver sem",
  },
  {
    titulo: "Prova",
    resumo: "Mostra o benefício e o que muda na prática",
    exemplo: "Já uso faz duas semanas e a diferença é absurda",
  },
  {
    titulo: "Chamada",
    resumo: "Fecha mandando comprar",
    exemplo: "Corre no carrinho laranja antes que acabe a promoção",
  },
];

/** O que a pessoa vê como dica no campo de cada take. */
export function dicaDoTake(indice: number, total: number) {
  if (total === 1) return PAPEL_TAKE[0];
  if (indice === 0) return PAPEL_TAKE[0];
  if (indice === total - 1) return PAPEL_TAKE[2];
  return PAPEL_TAKE[1];
}
