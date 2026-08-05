import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { registrarOpenAITokens } from "@/lib/gastos-api";
import { formatoPorChave, duracaoBoost, limitePalavras } from "@/lib/viral-boost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escreve a HISTORINHA da pessoa: ela dá a ideia numa frase e a IA devolve as
 * três batidas (abertura, clímax e chamada) já no orçamento de tempo do vídeo
 * (15s com um personagem, 10s com dois ou três).
 *
 * As regras do sistema são as que a gente aprendeu escrevendo as nossas: abrir
 * no meio da ação (sem "oi gente"), clímax que só funciona com AQUELE
 * personagem, e chamada barata pra quem assiste. Roda no gpt-5-mini (cota
 * diária), então não cobra crédito.
 */

const MODELOS = [process.env.OPENAI_PROMPT_MODEL || "gpt-5-mini", "gpt-4o-mini"];

function sistema(formato: string, personagens: string, qtd: number) {
  // o orçamento de fala muda com a duração, que vem da quantidade de personagens
  const duracao = duracaoBoost(qtd);
  const limite = limitePalavras(duracao);
  const universo =
    formato === "senhora"
      ? "O formato é SENHORA BRASILEIRA: uma senhora de verdade, em casa, falando com a câmera como se um neto tivesse começado a filmar de surpresa. Registro caloroso, humilde, sem drama de novela."
      : "O formato é HISTORINHA DE FRUTA: frutas do tamanho de gente vivendo drama de novela brasileira. O humor vem do atrito entre a emoção real e o veículo absurdo.";

  return `Você escreve roteiros curtíssimos de vídeo viral em português do Brasil.

${universo}

Personagens desta cena (${qtd}): ${personagens}

Escreva TRÊS batidas: Abertura, Clímax e Chamada. Cada batida tem:
- "acao": o que acontece na cena, em uma frase, citando o personagem pelo nome (vira direção de atuação).
- "fala": o que a pessoa fala, EXATAMENTE como vai ser dito.

Regras que não podem ser quebradas:
- A soma das TRÊS falas tem no máximo ${limite} palavras. O vídeo tem ${duracao} segundos.
- A ABERTURA começa no meio da ação. Nada de "oi gente", nada de se apresentar, nada de explicar contexto.
- O CLÍMAX só pode funcionar na boca DESSE personagem. ${
    formato === "senhora"
      ? "Use a vivência dela."
      : "Use trocadilho de fruta: se a mesma frase funcionaria na boca de um humano, está fraco."
  }
- A CHAMADA pede a coisa mais barata possível pra quem assiste: preferir cliffhanger ou "marca alguém" a "comenta sua história".
${qtd > 1 ? '- Com mais de um personagem, comece cada fala com o nome dele e dois pontos (ex: "Moranguinha: ...").' : ""}
- Português do Brasil falado, sem emoji, sem hashtag, sem aspas dentro da fala.

Responda SOMENTE com este JSON:
{"nome":"título curto","sinopse":"uma frase","tom":"como soa","batidas":[{"rotulo":"Abertura","acao":"...","fala":"..."},{"rotulo":"Clímax","acao":"...","fala":"..."},{"rotulo":"Chamada","acao":"...","fala":"..."}]}`;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { ideia?: string; formato?: string; personagens?: { nome: string; jeito: string }[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const ideia = String(body.ideia ?? "").trim().slice(0, 400);
  if (ideia.length < 5) {
    return NextResponse.json({ erro: "Conte em uma frase o que acontece." }, { status: 400 });
  }
  const formato = formatoPorChave(body.formato).chave;
  const lista = (body.personagens ?? []).slice(0, 3);
  if (!lista.length) {
    return NextResponse.json({ erro: "Escolha os personagens primeiro." }, { status: 400 });
  }
  const personagens = lista.map((p) => `${p.nome} (${p.jeito})`).join("; ");

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ erro: "Assistente indisponível." }, { status: 503 });

  for (const modelo of MODELOS) {
    const ehG5 = modelo.startsWith("gpt-5");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: "system", content: sistema(formato, personagens, lista.length) },
            { role: "user", content: `A ideia é: ${ideia}` },
          ],
          response_format: { type: "json_object" },
          ...(ehG5
            ? { max_completion_tokens: 1600, reasoning_effort: "low" }
            : { temperature: 0.9, max_tokens: 600 }),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
      };
      // contabilidade do dono (aba Finanças): tokens usados nesta chamada
      await registrarOpenAITokens(user.id, data.usage?.total_tokens ?? 0, "boost-roteiro").catch(() => {});
      const cru = data.choices?.[0]?.message?.content?.trim();
      if (!cru) continue;
      const j = JSON.parse(cru) as {
        nome?: string;
        sinopse?: string;
        tom?: string;
        batidas?: { rotulo?: string; acao?: string; fala?: string }[];
      };
      const batidas = (j.batidas ?? []).slice(0, 3);
      if (batidas.length === 3 && batidas.every((b) => b?.fala)) {
        return NextResponse.json({
          ok: true,
          roteiro: {
            nome: j.nome ?? "Minha historinha",
            sinopse: j.sinopse ?? "",
            tom: j.tom ?? "",
            batidas: batidas.map((b, i) => ({
              rotulo: b.rotulo ?? ["Abertura", "Clímax", "Chamada"][i],
              acao: b.acao ?? "",
              fala: b.fala ?? "",
            })),
          },
        });
      }
    } catch {
      // tenta o próximo modelo
    }
  }

  return NextResponse.json(
    { erro: "Não consegui escrever agora. Tente de novo." },
    { status: 502 },
  );
}
