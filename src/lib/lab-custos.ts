import { duracaoPorChave } from "@/lib/lab-video";

/**
 * Custos do Viraliza Lab (créditos = centavos). Client-safe: a tela mostra o
 * valor antes de gerar.
 *
 * A imagem sai barata porque o motor gasta pouquíssimo pra gerá-la, bem diferente
 * do vídeo, que consome a cota por SEGUNDO gerado.
 */
export const CUSTO_IMAGEM_LAB = 20;

/**
 * Custo do vídeo do Lab: vem da duração escolhida (6s=50, 10s=70, 15s=95).
 * A cota do motor é medida em SEGUNDOS, então o preço acompanha a duração.
 * O Viral Boost usa esta mesma tabela (10s e 15s).
 */
export function custoVideoLab(chave?: string | null): number {
  return duracaoPorChave(chave)?.custo ?? 0;
}
