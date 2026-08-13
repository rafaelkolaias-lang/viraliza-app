/**
 * Tabela de preços da PRODUÇÃO (em créditos). 1 crédito = R$ 0,01.
 *
 * ⚠️ VALORES PROVISÓRIOS: calibrar com o custo real do Gemini/ElevenLabs + o
 *    worker (ver reminder.md). Servem agora pra: (a) estimar "usará no máximo X
 *    créditos" antes de gerar e (b) o preço fixo das ferramentas sem API.
 *
 * Este módulo é puro (sem "server-only") pra poder estimar também no cliente.
 */

// Estimativa por SEGUNDO de vídeo (limite superior; o débito real costuma ser menor).
// Calibrado com dados reais (ex.: ~21s de voz custou ~46 créditos ≈ 2,2/seg); deixamos
// uma folga de segurança acima disso. Ainda PROVISÓRIO (ver reminder.md).
export const CREDITOS_POR_SEG = {
  legenda: 2, // vídeo com legenda: Gemini (texto + análise de imagens)
  voz: 4, // vídeo com voz narrada: Gemini + ElevenLabs (caracteres da fala)
} as const;

// Preço FIXO ("custo de processamento") das ferramentas que NÃO usam API de IA.
// Definidos pelo dono em 05/08/2026. Não são iguais entre si de propósito: o que
// pesa em cada um é diferente (carimbar vídeo é rápido, montar vídeo inteiro sem
// IA ocupa a fila, e o garimpo de leads gasta o acesso ao Google Maps).
// ATENÇÃO: mexer aqui muda a cobrança E os textos que citam o preço nas telas.
// Revisar `ajuda-ferramentas.tsx`, `lote-em-massa.tsx` e `suporte-base.ts` junto.
export const CREDITOS_FIXO = {
  lote: 5, // Aplicar marca em lote (só FFmpeg), POR VÍDEO carimbado
  leads: 50, // MapsLeads (scraper), por busca
  editorManual: 30, // Editor no modo sem IA (clipes + texto manual)
  /**
   * Analisar UMA cena de apoio com a IA de visão (Editor automático PRO, etapa de
   * aprovação): ela olha 5 quadros do clipe, escreve o que a cena mostra e aponta
   * o melhor pedaço pra ir pra tela.
   *
   * Conta do custo real (05/08/2026): 5 quadros de 512px em 9:16 dão ~2 ladrilhos
   * de 258 tokens cada no gemini-2.5-flash (~2.580 tokens) mais uns 500 de
   * instrução e resposta, ~3.100 tokens por cena. A US$0,30 por milhão isso é
   * US$0,00093 = R$0,0051 com o dólar a 5,50, e R$0,0061 com a margem de 20%.
   * Arredonda pra 1 crédito (R$0,01). Mexeu em `QUADROS_ANALISE` (montagem.ts),
   * refaça esta conta.
   */
  analiseCena: 1,
  /**
   * Posicionar UMA cena de apoio na linha do tempo (Editor, etapa de resumo):
   * a IA ouve o áudio do vídeo principal e diz em que segundo aquela cena
   * encaixa, pra a pessoa ver e corrigir ANTES de mandar renderizar.
   *
   * Conta do custo real (06/08/2026): é uma chamada só pro lote inteiro. O áudio
   * pesa 32 tokens por segundo no gemini-2.5-flash, então 2 minutos de base dão
   * ~3.840 tokens, mais ~600 de instrução e resposta: ~4.500 tokens por PEDIDO,
   * não por cena. A US$0,30 por milhão dá US$0,00135 = R$0,0074 com o dólar a
   * 5,50, e R$0,0089 com a margem de 20%. Como o áudio é cobrado uma vez só e as
   * cenas dividem esse custo, 1 crédito por cena cobre com folga.
   */
  posicionarCena: 1,
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

/**
 * Quanto custa mandar a IA olhar N cenas de apoio (etapa de aprovação do Editor).
 * Cena que a pessoa mesma descreveu não entra na conta: ela nem é enviada.
 */
export function custoAnaliseCenas(cenas: number): number {
  return Math.max(0, Math.floor(cenas)) * CREDITOS_FIXO.analiseCena;
}

/** Créditos pra a IA posicionar N cenas de apoio na linha do tempo. */
export function custoPosicionarCenas(cenas: number): number {
  return Math.max(0, Math.floor(cenas)) * CREDITOS_FIXO.posicionarCena;
}

/** Texto pronto pra UI: "no máximo 1.234 créditos". */
export function textoEstimativa(creditos: number): string {
  return `no máximo ${creditos.toLocaleString("pt-BR")} créditos`;
}

// ---------------------------------------------------------------------------
// CUSTO REAL: converte o "consumo" que o worker reporta em créditos (+20%).
// ⚠️ PREÇOS PROVISÓRIOS (USD): calibrar com a tabela atual do Gemini/ElevenLabs.
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
  /** segundos de cena animada no Veo (a fábrica só gera quando "gerar_cena: sim").
   *  Por enquanto entra SÓ no custo do admin (gastos-api); não é cobrado do
   *  usuário em custoCreditos até calibrarmos os preços (ver reminder.md). */
  veoSegundos?: number;
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
