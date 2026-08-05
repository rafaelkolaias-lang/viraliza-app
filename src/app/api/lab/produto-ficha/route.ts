import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { registrarOpenAITokens } from "@/lib/gastos-api";
import { baixarImagemEntrada, dataUrlParaEntrada } from "@/lib/imagem-entrada";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FICHA VISUAL DO PRODUTO: a IA olha a foto e descreve o que o produto É de
 * verdade (formato, cor, material, rótulo, se é kit, o que IGNORAR na foto).
 *
 * Existe porque o título do acervo Shopee quase nunca é o nome do produto: vem
 * "QUEIMA DE ESTOQUE 🆘", "Aproveita que acaba rápido!". Sem isso, o prompt fica
 * cego e a IA inventa um produto genérico. Com a ficha, ela sabe exatamente o
 * que desenhar e o que deixar de fora (preço, fundo, itens extras da foto).
 *
 * Roda no gpt-5-mini com visão (cota diária), então não cobra crédito.
 */

const MODELOS = [process.env.OPENAI_PROMPT_MODEL || "gpt-5-mini", "gpt-4o-mini"];

const SISTEMA = `Você olha a foto de um produto de e-commerce e descreve o PRODUTO em si, para outra IA conseguir desenhá-lo igualzinho.

Responda SOMENTE com este JSON, sem texto em volta:
{
  "nome": "nome curto e real do produto em português (ex: Bota feminina de cano alto)",
  "descricao": "uma frase objetiva com o que dá pra ver: formato, cor, material, acabamento, rótulo ou estampa",
  "comoMostrar": "como o produto deve aparecer na cena (ex: em pé com o rótulo virado pra câmera)",
  "evitar": "o que aparece na foto e NÃO deve entrar na cena (preço, fundo, outros itens, texto promocional)",
  "ehKit": true ou false,
  "variantes": "se aparecem várias cores ou tamanhos, diga quais e qual usar; senão string vazia",
  "categoria": "roupa | calcado | acessorio | beleza | eletronico | casa | suplemento | outro"
}

Regras:
- Descreva SÓ o que você vê. Nada de inventar marca, tamanho ou ingrediente.
- Se o texto do rótulo estiver legível, cite; se não, diga apenas que tem rótulo.
- Português do Brasil, sem emoji.`;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: { imagem?: string; titulo?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const img =
    (await baixarImagemEntrada(body.imagem)) ?? dataUrlParaEntrada(body.imagem);
  if (!img) {
    return NextResponse.json({ erro: "Não consegui ler a foto do produto." }, { status: 400 });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ erro: "Análise indisponível." }, { status: 503 });

  const titulo = String(body.titulo ?? "").trim().slice(0, 200);
  const conteudo = [
    {
      type: "text",
      text: titulo
        ? `O anúncio veio com este título (pode ser só chamada de venda, ignore se não ajudar): "${titulo}". Descreva o produto da foto.`
        : "Descreva o produto da foto.",
    },
    { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } },
  ];

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
            { role: "user", content: conteudo },
          ],
          response_format: { type: "json_object" },
          ...(ehG5
            ? { max_completion_tokens: 1500, reasoning_effort: "low" }
            : { temperature: 0.3, max_tokens: 500 }),
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
      await registrarOpenAITokens(user.id, data.usage?.total_tokens ?? 0, "produto-ficha").catch(() => {});
      const cru = data.choices?.[0]?.message?.content?.trim();
      if (!cru) continue;
      const ficha = JSON.parse(cru) as Record<string, unknown>;
      if (ficha && typeof ficha === "object") {
        return NextResponse.json({ ok: true, ficha });
      }
    } catch {
      // tenta o próximo modelo
    }
  }

  return NextResponse.json({ erro: "Não consegui analisar a foto agora." }, { status: 502 });
}
