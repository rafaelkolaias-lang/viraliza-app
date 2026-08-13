import "server-only";

/**
 * Motor do robô de suporte: OpenAI `gpt-5-mini` (12/08/2026).
 *
 * ANTES rodava no LLM da casa (`lib/llm.ts`, qwen2.5:14b no Ollama da máquina do
 * dono). Saiu de lá por três motivos, nesta ordem:
 *  1. **Obediência.** Metade do código de suporte é remendo pra falha do qwen:
 *     `suporte-guia.ts` inteiro existe porque ele chutava o número do passo,
 *     `podeMostrarBotao` porque ele grudava botão em toda resposta e
 *     `limparTexto` porque ele vazava `/painel/...` no meio da frase.
 *  2. **Espera.** O Ollama descarrega o modelo depois de uns minutos parado e
 *     recarregar levava ~45s, o que obrigava a rota a um `maxDuration` de 300s e
 *     a uma engenhoca de aquecimento (`GET` na rota + mapa `aquecidos`), tudo
 *     aposentado junto com esta troca.
 *  3. **Preço.** ~85% do prompt é FIXO (o material da Central de Ajuda, ~30 mil
 *     caracteres). O gpt-5-mini cobra 10x menos no token que já está em cache
 *     ($0,025 contra $0,25 por 1M) e sem taxa de armazenamento por hora, o que
 *     deixa a conversa em ~R$ 0,04 - menos da metade do Gemini Flash-Lite.
 *
 * **NÃO reordene o prompt de sistema.** O cache da OpenAI casa por PREFIXO: o
 * material fixo tem que vir primeiro e o que muda a cada pergunta (o passo da
 * guia, os dados do usuário) por último. Jogar o contexto do usuário pro começo
 * fura o cache e multiplica a conta por dez.
 *
 * O `lib/llm.ts` continua vivo e não foi tocado: o minerador ainda usa o modelo
 * da casa, que lá não custa nada por chamada.
 */

/** Tokens de uma resposta, separados porque cada tipo tem preço próprio. */
export type UsoChat = {
  /** entrada nova (não estava em cache) */
  entrada: number;
  /** entrada servida do cache de prompt da OpenAI (10x mais barata) */
  entradaCache: number;
  /** saída, INCLUINDO os tokens de raciocínio (a OpenAI cobra os dois igual) */
  saida: number;
};

export type RespostaIa = { texto: string; uso: UsoChat };

const MODELO = process.env.SUPORTE_MODELO || "gpt-5-mini";
/**
 * Suporte não é lugar de pensar muito: a resposta certa está no material, e cada
 * token de raciocínio é cobrado como saída ($2/1M). "low" foi o que o resto do
 * projeto já usa nas chamadas de gpt-5 (ver `api/lab/cena`).
 */
const ESFORCO = process.env.SUPORTE_ESFORCO || "low";
/**
 * Teto de saída. Parece exagero pra uma resposta de 3 linhas, mas nos modelos
 * gpt-5 o raciocínio SAI DESTE MESMO balde: apertar aqui não encurta a resposta,
 * corta ela no meio depois de o modelo já ter gasto o orçamento pensando. Quem
 * cuida do tamanho é a regra 1 do prompt, não este número.
 */
const MAX_SAIDA = 2000;
const ESPERA_MS = 45_000;

export type MsgIa = { role: "system" | "user" | "assistant"; content: string };

export function suporteIaConfigurado(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Uma resposta do robô. Devolve o texto cru (quem separa os `LINKS:` é o
 * `suporte-base.separarLinks`) e o consumo, pra contabilidade do dono.
 *
 * Lança em qualquer falha: a rota trata e devolve a mensagem de erro do chat.
 */
export async function responderSuporte(mensagens: MsgIa[]): Promise<RespostaIa> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY ausente");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODELO,
      messages: mensagens,
      // sem `temperature`: os modelos gpt-5 recusam o parâmetro
      max_completion_tokens: MAX_SAIDA,
      reasoning_effort: ESFORCO,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(ESPERA_MS),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    };
  };

  const prompt = data.usage?.prompt_tokens ?? 0;
  const cache = data.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const uso: UsoChat = {
    // `prompt_tokens` já INCLUI os cacheados: somar os dois contaria em dobro
    entrada: Math.max(0, prompt - cache),
    entradaCache: cache,
    saida: data.usage?.completion_tokens ?? 0,
  };

  const texto = data.choices?.[0]?.message?.content?.trim() ?? "";
  return { texto, uso };
}
