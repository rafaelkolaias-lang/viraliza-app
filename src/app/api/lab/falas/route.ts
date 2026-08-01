import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { limitePalavras, TONS_LAB } from "@/lib/lab-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escreve a fala de cada TAKE do vídeo do Lab. O ponto todo é a EMENDA: o take 1
 * termina em aberto, o do meio continua sem cumprimentar e o último fecha com a
 * chamada. Roda no gpt-5-mini (cota diária), então não cobra crédito.
 */

const MODELOS = [process.env.OPENAI_PROMPT_MODEL || "gpt-5-mini", "gpt-4o-mini"];

function sistema(takes: number, limite: number, tomLabel: string) {
  return `Você escreve falas de vídeos UGC brasileiros que vendem produto (Shopee, TikTok Shop), do jeito que um criador de conteúdo fala de verdade.

Escreva ${takes} fala${takes > 1 ? "s" : ""}, uma por take, com NO MÁXIMO ${limite} palavras cada.

Tom: ${tomLabel}.

Regras que não podem ser quebradas:
- Português do Brasil, linguagem falada, sem palavra difícil e sem gerundismo.
- Nada de emoji, nada de aspas, nada de hashtag, nada de nome de marca inventado.
- Não descreva o produto com características que você não sabe (cor, tecido, tamanho): fale do benefício e da sensação de usar.
${
  takes > 1
    ? `- CONTINUIDADE: as falas são o MESMO vídeo cortado em ${takes} partes. A fala 1 abre com um gancho e termina no meio do assunto, puxando a próxima. As falas do meio começam já continuando (sem "oi", sem "gente" de novo, sem se apresentar). A última fecha chamando pra comprar no carrinho laranja ou no link.
- Cada fala precisa fazer sentido emendada na anterior, como se fosse uma pessoa falando sem parar.`
    : "- Uma fala só: gancho rápido, o benefício e a chamada pra comprar no fim."
}

Responda SOMENTE com um JSON assim, sem texto em volta: {"falas":["...","..."]}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { produto?: string; takes?: number; segundos?: number; tom?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const takes = Math.min(5, Math.max(1, Number(body.takes) || 1));
  const segundos = Math.min(15, Math.max(6, Number(body.segundos) || 15));
  const limite = limitePalavras(segundos);
  const tom = TONS_LAB.find((t) => t.chave === body.tom) ?? TONS_LAB[0];
  const produto = String(body.produto ?? "").trim().slice(0, 200);

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ erro: "Gerador indisponível." }, { status: 503 });

  const usuario = `Produto: ${produto || "um produto que a pessoa está divulgando"}
Escreva as ${takes} fala${takes > 1 ? "s" : ""} agora.`;

  for (const modelo of MODELOS) {
    const ehG5 = modelo.startsWith("gpt-5");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: "system", content: sistema(takes, limite, tom.label) },
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
      const json = JSON.parse(cru) as { falas?: unknown };
      const falas = Array.isArray(json.falas)
        ? json.falas.map((f) => String(f ?? "").trim()).filter(Boolean)
        : [];
      if (falas.length) {
        // completa se vier menos do que pedimos (nunca devolve buraco)
        while (falas.length < takes) falas.push("");
        return NextResponse.json({ ok: true, falas: falas.slice(0, takes) });
      }
    } catch {
      // tenta o próximo modelo
    }
  }

  return NextResponse.json(
    { erro: "Não consegui escrever as falas agora. Tente de novo." },
    { status: 502 },
  );
}
