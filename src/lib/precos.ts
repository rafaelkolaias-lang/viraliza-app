/**
 * Tabela de preços da PRODUÇÃO (em créditos). 1 crédito = R$ 0,01.
 *
 * ⚠️ VALORES PROVISÓRIOS — calibrar com o custo real do Gemini/ElevenLabs + o
 *    worker (ver reminder.md). Servem agora pra: (a) estimar "usará no máximo X
 *    créditos" antes de gerar e (b) o preço fixo das ferramentas sem API.
 *
 * Este módulo é puro (sem "server-only") pra poder estimar também no cliente.
 */

// Estimativa por SEGUNDO de vídeo (limite superior — o débito real costuma ser menor).
// Calibrado com dados reais (ex.: ~21s de voz custou ~46 créditos ≈ 2,2/seg); deixamos
// uma folga de segurança acima disso. Ainda PROVISÓRIO (ver reminder.md).
export const CREDITOS_POR_SEG = {
  legenda: 2, // vídeo com legenda: Gemini (texto + análise de imagens)
  voz: 4, // vídeo com voz narrada: Gemini + ElevenLabs (caracteres da fala)
} as const;

// Preço FIXO ("custo de processamento") das ferramentas que NÃO usam API de IA.
export const CREDITOS_FIXO = {
  lote: 50, // Aplicar marca em lote (só FFmpeg)
  leads: 50, // MapsLeads (scraper)
  editorManual: 50, // Editor sem IA (clipes + texto manual)
} as const;

// Quando não há duração conhecida (ex.: formulário simples), assume este teto por vídeo.
export const DURACAO_NOMINAL_SEG = 35;

/** Estimativa (limite superior) de créditos pra um vídeo, pelo tempo. */
export function estimarCreditos(
  formato: "legenda" | "voz",
  duracaoSeg: number,
  variantes = 1,
): number {
  const seg = Math.max(1, Math.round(duracaoSeg || DURACAO_NOMINAL_SEG));
  const taxa = formato === "voz" ? CREDITOS_POR_SEG.voz : CREDITOS_POR_SEG.legenda;
  return Math.ceil(seg * taxa) * Math.max(1, variantes);
}

/** Texto pronto pra UI: "no máximo 1.234 créditos". */
export function textoEstimativa(creditos: number): string {
  return `no máximo ${creditos.toLocaleString("pt-BR")} créditos`;
}

// ---------------------------------------------------------------------------
// CUSTO REAL — converte o "consumo" que o worker reporta em créditos (+20%).
// ⚠️ PREÇOS PROVISÓRIOS (USD) — calibrar com a tabela atual do Gemini/ElevenLabs.
// ---------------------------------------------------------------------------
export const PRECO_USD = {
  geminiFlashPorMTokens: 0.3, // gemini-2.5-flash: $/1M tokens
  geminiImgPorMTokens: 15.0, // gemini-2.5-flash-image: $/1M tokens (saída cara)
  elevenPorMilChars: 0.18, // ElevenLabs: $/1000 caracteres
} as const;

export const USD_BRL = 5.5; // provisório
export const MARGEM = 1.2; // +20%

/** O que o worker mede e reporta por job. */
export type Consumo = {
  geminiFlashTokens?: number;
  geminiImgTokens?: number;
  elevenChars?: number;
};

/** Converte o consumo real em CRÉDITOS (1 crédito = R$ 0,01), já com +20%. */
export function custoCreditos(c: Consumo): number {
  const flash =
    ((c.geminiFlashTokens ?? 0) / 1_000_000) * PRECO_USD.geminiFlashPorMTokens;
  const img =
    ((c.geminiImgTokens ?? 0) / 1_000_000) * PRECO_USD.geminiImgPorMTokens;
  const eleven = ((c.elevenChars ?? 0) / 1000) * PRECO_USD.elevenPorMilChars;
  const usd = flash + img + eleven;
  const reais = usd * USD_BRL * MARGEM;
  return Math.max(0, Math.ceil(reais * 100)); // R$ -> centavos = créditos
}
