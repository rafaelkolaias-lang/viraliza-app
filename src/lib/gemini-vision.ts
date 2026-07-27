import "server-only";

import { extrairJSON } from "@/lib/llm";

/**
 * Gemini (visão) pro Vídeo com avatar. analisarProduto olha 1 a 3 fotos e descobre
 * o produto (nome, tipo, descrição fiel em inglês, sugestão de apresentação) -> é
 * o que deixa o prompt de imagem fiel ao produto real. Usa só as chaves REST do
 * Google (formato AIza...); rotaciona se uma falhar.
 */

const MODELO = "gemini-2.5-flash";

function chaves(): string[] {
  const brutas = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
  ];
  return brutas.filter((k): k is string => !!k && k.startsWith("AIza"));
}

export function geminiConfigurado(): boolean {
  return chaves().length > 0;
}

/** Chamada base do Gemini: recebe as parts (texto e/ou imagem) e devolve o texto.
 *  Rotaciona as chaves quando uma estoura/limita. "" se todas falharem. */
async function gerar(
  parts: Record<string, unknown>[],
  temperature: number,
): Promise<string> {
  const ks = chaves();
  const body = { contents: [{ parts }], generationConfig: { temperature } };
  for (const key of ks) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(45_000),
        },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const txt =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (txt.trim()) return txt;
    } catch {
      // rede/timeout: tenta a próxima chave
    }
  }
  return "";
}

// ---- Análise de produto (visão) ----

export type AnaliseProduto = {
  nome: string;
  tipo: string;
  descricao: string; // descrição fiel EM INGLÊS (vai pro prompt de imagem)
  sugestao: string; // apresentação: mao|corpo|pes|rosto|pulso|lado
};

const INSTRUCAO_PRODUTO = `Você analisa produtos de e-commerce por imagem. Olhe a(s) foto(s) e responda SOMENTE um JSON, sem texto fora dele:
{
 "nome": "nome curto do produto em português",
 "tipo": "categoria em português (ex: calçado, roupa, cosmético, eletrônico, utensílio de cozinha, acessório, alimento, brinquedo)",
 "descricao_en": "descrição visual FIEL e detalhada do produto EM INGLÊS (cor exata, material, formato, marca ou logo se visível, detalhes), do jeito que permita reproduzir o produto exatamente numa geração de imagem",
 "apresentacao": "uma opção entre: mao, corpo, pes, rosto, pulso, lado - como faz mais sentido mostrar esse produto junto de uma pessoa"
}
Não invente nada que não dê pra ver na foto.`;

export async function analisarProduto(
  imagens: { mime: string; base64: string }[],
): Promise<AnaliseProduto | null> {
  if (!chaves().length || !imagens.length) return null;
  const parts: Record<string, unknown>[] = [{ text: INSTRUCAO_PRODUTO }];
  for (const img of imagens.slice(0, 3)) {
    parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
  }
  const txt = await gerar(parts, 0.2);
  const j = extrairJSON<{
    nome?: string;
    tipo?: string;
    descricao_en?: string;
    apresentacao?: string;
  }>(txt);
  if (!j || !j.descricao_en) return null;
  return {
    nome: String(j.nome ?? "").trim(),
    tipo: String(j.tipo ?? "").trim(),
    descricao: String(j.descricao_en ?? "").trim(),
    sugestao: String(j.apresentacao ?? "").trim().toLowerCase(),
  };
}
