import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { estiloPorChave } from "@/lib/estilos-camera";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Assistente da cena do Viraliza Lab: recebe o produto, o estilo de câmera e as
 * respostas rápidas da pessoa e devolve UMA frase pronta descrevendo a cena.
 * É de graça (gpt-5-mini, cota diária), então não cobra crédito. Se a IA falhar,
 * a rota devolve uma frase montada na mão: a pessoa nunca fica sem saída.
 */

const MODELOS = [process.env.OPENAI_PROMPT_MODEL || "gpt-5-mini", "gpt-4o-mini"];

const SISTEMA = `Você escreve, em português do Brasil, UMA frase curta (no máximo 35 palavras) dizendo COMO a pessoa e o produto ficam posicionados numa foto de divulgação (UGC).

REGRA MAIS IMPORTANTE: o produto da foto enviada tem que sair IDÊNTICO. Então você NUNCA descreve o produto em si: nada de cor, tecido, material, modelo, marca, tamanho ou detalhes ("calça jeans azul", "frasco âmbar", "etiqueta frontal"). Fale sempre "o produto" ou "a peça". Se você inventar qualquer característica, a IA de imagem vai mudar o produto e a foto fica errada.

O que você DEVE descrever:
- a posição e a pose (segurando, vestindo, apoiado, mãos onde)
- o enquadramento (corpo inteiro, meio corpo, close)
- para onde o produto está virado e o que precisa estar visível
- quando fizer sentido: usar apenas uma unidade/variante do que aparece na foto

Nada de marketing, emoji, aspas ou fala. Responda apenas com a frase, sem título e sem explicação.`;

async function viaOpenAI(usuario: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  for (const modelo of MODELOS) {
    const ehG5 = modelo.startsWith("gpt-5");
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: "system", content: SISTEMA },
            { role: "user", content: usuario },
          ],
          ...(ehG5
            ? { max_completion_tokens: 900, reasoning_effort: "low" }
            : { temperature: 0.7, max_tokens: 200 }),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const out = data.choices?.[0]?.message?.content?.trim();
      if (out) return out.replace(/^["']|["']$/g, "").trim();
    } catch {
      // tenta o próximo modelo
    }
  }
  return null;
}

/** Frase de emergência quando a IA não responde (nunca deixa a pessoa travada).
 *  Fala sempre "o produto da foto": nada de característica inventada. */
function fraseReserva(estiloChave: string, detalhe: string): string {
  const base: Record<string, string> = {
    de_frente:
      "Segurando o produto da foto na altura do peito com as duas mãos, virado para a câmera e totalmente visível",
    selfie:
      "Segurando o produto da foto ao lado do rosto, em close de selfie, com a frente virada para a câmera",
    maos: "Somente as mãos aparecem segurando o produto da foto, em primeira pessoa, mostrando de perto",
    vestindo:
      "Vestindo a peça da foto, de corpo inteiro, mostrando como ela fica no corpo",
    espelho:
      "Vestindo a peça da foto e tirando selfie no espelho, corpo inteiro visível no reflexo",
  };
  const frase = base[estiloChave] ?? base.de_frente;
  return detalhe ? `${frase}, ${detalhe}` : frase;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: {
    produto?: string;
    estilo?: string;
    detalhe?: string; // o que a pessoa respondeu nas perguntas rápidas
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const produto = String(body.produto ?? "").trim().slice(0, 300);
  const detalhe = String(body.detalhe ?? "").trim().slice(0, 300);
  const estilo = estiloPorChave(body.estilo);
  if (!produto || !estilo) {
    return NextResponse.json({ erro: "Escolha o produto e o estilo antes." }, { status: 400 });
  }

  // o título vai só pra IA entender o TIPO do produto (roupa? frasco? eletrônico?)
  // e escolher a pose certa. Ela não pode repetir características dele na frase.
  const usuario = `Tipo do produto (apenas para você entender a pose certa, NÃO repita características dele): ${produto}
Estilo de câmera escolhido: ${estilo.label} (${estilo.descricao})
${detalhe ? `O que a pessoa quer destacar: ${detalhe}` : "A pessoa não deu detalhes: escolha o enquadramento que mais vende esse tipo de produto."}
${estilo.chave === "maos" ? "ATENÇÃO: neste estilo NÃO aparece o rosto nem o corpo, apenas as mãos segurando o produto." : ""}

Escreva a frase da cena agora, chamando o produto de "o produto" ou "a peça".`;

  const texto = (await viaOpenAI(usuario)) ?? fraseReserva(estilo.chave, detalhe);
  return NextResponse.json({ ok: true, texto });
}
