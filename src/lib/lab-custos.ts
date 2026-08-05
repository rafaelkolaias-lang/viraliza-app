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
 * Gerador de prompt (a IA com visão escreve a ficha técnica do vídeo).
 *
 * Era DE GRAÇA até 05/08/2026, quando o dono pôs preço: mesmo sendo só texto, a
 * chamada manda até 4 fotos pro modelo de visão, e isso consome token de verdade
 * na conta do dono. Preço simbólico, só pra não virar torneira aberta.
 *
 * Não mora no `CREDITOS_FIXO` de `precos.ts` de propósito: lá é o preço das
 * ferramentas que NÃO usam IA. Esta usa, e é do Labs, então fica com as irmãs.
 */
export const CUSTO_PROMPT_LAB = 5;

/**
 * Custo do vídeo do Lab: vem da duração escolhida (6s=50, 10s=70, 15s=95).
 * A cota do motor é medida em SEGUNDOS, então o preço acompanha a duração.
 * O Viral Boost usa esta mesma tabela (10s e 15s).
 */
export function custoVideoLab(chave?: string | null): number {
  return duracaoPorChave(chave)?.custo ?? 0;
}
