import "server-only";

/**
 * Cliente do LLM próprio (Ollama + Open WebUI, hospedado em llm.univershoop.com).
 * Formato OpenAI-compatível pelo passthrough do Ollama (/ollama/v1/chat/completions).
 * Sem quota, sem custo por chamada - roda na nossa infra. Ver lib/minerador.ts.
 */

const BASE = (process.env.LLM_BASE_URL || "").replace(/\/$/, "");
const KEY = process.env.LLM_API_KEY || "";
const MODEL = process.env.LLM_MODEL || "qwen2.5:14b";

export function llmConfigurado(): boolean {
  return !!(BASE && KEY);
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

/** Chat completion (bloqueante). Retorna o texto da resposta ("" se falhar). */
export async function chat(
  messages: Msg[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  if (!llmConfigurado()) throw new Error("LLM não configurado");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
      stream: false,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Extrai um objeto JSON de uma resposta do LLM (tolera cercas ```json e texto solto). */
export function extrairJSON<T = unknown>(txt: string): T | null {
  if (!txt) return null;
  const limpo = txt.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(limpo) as T;
  } catch {
    // tenta pegar o primeiro bloco {...} do texto
    const m = limpo.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
