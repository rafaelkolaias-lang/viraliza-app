import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { limitePalavras, TONS_LAB } from "@/lib/lab-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escreve a fala do vídeo do Lab: uma só, do tamanho exato que cabe na duração
 * escolhida (gancho, benefício e chamada). Roda no gpt-5-mini (cota diária),
 * então não cobra crédito.
 */

const MODELOS = [process.env.OPENAI_PROMPT_MODEL || "gpt-5-mini", "gpt-4o-mini"];

function sistema(limite: number, tomLabel: string) {
  return `Você escreve falas de vídeos UGC brasileiros que vendem produto (Shopee, TikTok Shop), do jeito que um criador de conteúdo fala de verdade.

Escreva UMA fala com NO MÁXIMO ${limite} palavras.

Tom: ${tomLabel}.

Regras que não podem ser quebradas:
- Português do Brasil, linguagem falada, sem palavra difícil e sem gerundismo.
- Nada de emoji, nada de aspas, nada de hashtag, nada de nome de marca inventado.
- Não descreva o produto com características que você não sabe (cor, tecido, tamanho): fale do benefício e da sensação de usar.
- Estrutura: gancho rápido que prende, o benefício e a chamada pra comprar no carrinho laranja ou no link.
- Termina em frase completa: nada de deixar palavra pela metade.

Responda SOMENTE com um JSON assim, sem texto em volta: {"fala":"..."}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { produto?: string; segundos?: number; tom?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const segundos = Math.min(15, Math.max(6, Number(body.segundos) || 15));
  const limite = limitePalavras(segundos);
  const tom = TONS_LAB.find((t) => t.chave === body.tom) ?? TONS_LAB[0];
  const produto = String(body.produto ?? "").trim().slice(0, 200);

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ erro: "Gerador indisponível." }, { status: 503 });

  const usuario = `Produto: ${produto || "um produto que a pessoa está divulgando"}
Escreva a fala agora.`;

  for (const modelo of MODELOS) {
    const ehG5 = modelo.startsWith("gpt-5");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: "system", content: sistema(limite, tom.label) },
            { role: "user", content: usuario },
          ],
          response_format: { type: "json_object" },
          ...(ehG5
            ? { max_completion_tokens: 1200, reasoning_effort: "low" }
            : { temperature: 0.8, max_tokens: 400 }),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const cru = data.choices?.[0]?.message?.content?.trim();
      if (!cru) continue;
      const json = JSON.parse(cru) as { fala?: unknown; falas?: unknown };
      // aceita as duas formas: o modelo às vezes devolve a lista antiga
      const fala = String(
        (typeof json.fala === "string" && json.fala) ||
          (Array.isArray(json.falas) ? (json.falas[0] ?? "") : ""),
      ).trim();
      if (fala) return NextResponse.json({ ok: true, fala });
    } catch {
      // tenta o próximo modelo
    }
  }

  return NextResponse.json(
    { erro: "Não consegui escrever a fala agora. Tente de novo." },
    { status: 502 },
  );
}
