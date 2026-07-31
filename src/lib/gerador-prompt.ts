import "server-only";

import { gerarTextoComImagens, geminiConfigurado } from "@/lib/gemini-vision";

/**
 * GERADOR DE PROMPT (aba do estúdio): escreve o melhor prompt possível pro vídeo
 * da pessoa, seguindo a metodologia do material da aula (identidade bloqueada,
 * realismo sem cara de IA, formato UGC). A IA OLHA as fotos anexadas (avatar e
 * produto), descobre sozinha o que o produto é (creme? tênis? vestido?) e monta
 * o prompt em texto corrido (UGC) ou em JSON (melhor pra Gemini/Grok).
 * Motor: GPT com visão (OPENAI_API_KEY); se falhar, cai pro Gemini.
 */

export type ImagemVisao = { mime: string; base64: string };

export type OpcoesGerador = {
  temAvatar: boolean; // a 1ª imagem é a pessoa/avatar?
  descricao?: string; // o que a pessoa quer no vídeo (opcional)
  formato: "normal" | "json";
  duracaoSeg: number;
  comFala: boolean;
  idiomaFala: string; // ex: "português do Brasil"
};

/** A metodologia da aula, resumida pro modelo seguir à risca. */
function instrucaoBase(o: OpcoesGerador): string {
  const fala = o.comFala
    ? `5. FALA: toda fala deve ser SÓ em ${o.idiomaFala}, sem misturar outro idioma. Natural e animada, como uma influenciadora de verdade: começa com um gancho forte e termina com uma chamada pra ação clara. Escreva o ROTEIRO exato da fala, cabendo na duração (~2,5 palavras por segundo).`
    : "5. SEM FALA: a pessoa NÃO fala e NÃO mexe a boca como se falasse. Ela só mostra e valoriza o produto com gestos naturais e expressões (sorriso, aprovação). Sem voz, sem legendas.";

  return `Você é um diretor de criação especialista em prompts pra gerar vídeos UGC com IA (Grok Imagine, Gemini/Veo, Sora). Sua missão: escrever um prompt PROFISSIONAL E COMPLETO, no estilo ficha técnica de estúdio, seguindo esta metodologia à risca:

1. IDENTIDADE BLOQUEADA (regra mais importante): as fotos anexadas são REFERÊNCIA RÍGIDA. ${o.temAvatar ? "A pessoa do vídeo tem que ser IDÊNTICA à 1ª foto (mesmo rosto, cabelo, pele, corpo, proporções). " : ""}O produto tem que ser IDÊNTICO às fotos dele. O prompt deve dizer explicitamente: não utilize conhecimento interno sobre o produto, não invente detalhes, não recrie, não estilize, não simplifique, copie exatamente o que está nas fotografias. E deve listar, item por item, o que é proibido alterar (cores exatas, material, modelagem, costuras, caimento, textura, brilho, logos, etiquetas, estampas, bordados, proporções e o que mais existir NESTE produto específico).
2. PRODUTO: olhe as fotos e descubra o que o produto é (ex: creme de cabelo, tênis, vestido, fone) e a melhor forma de ele aparecer (segurando na mão, vestindo, passando no cabelo ou rosto, nos pés, ao lado na bancada). Descreva os detalhes REAIS que você vê nas fotos (cor exata, material, formato, marca ou logo se visível).
3. REALISMO SEM CARA DE IA: use vocabulário técnico de fotografia: photorealistic, ultra-realistic, RAW candid style, textura de pele real com poros visíveis, imperfeições sutis da pele, fios de cabelo realistas, dobras reais do tecido, granulação natural de filme, luz natural, câmera de celular na mão com leve tremida, sem filtros de beleza.
4. FORMATO UGC: vídeo vertical 9:16, estilo caseiro autêntico de creator brasileiro, cenário real do dia a dia.
${fala}
6. LISTA NEGATIVA: o prompt precisa ter uma seção EVITAR com tudo que é proibido: CGI, cartoon, estilização, aparência de IA, artefatos de IA, retoque de beleza, harmonização facial, mudança de identidade (facial drift, body drift), proporções irreais, texto na tela, legendas, marca d'água, distorções, nitidez exagerada, inventar detalhes do produto.
7. VALIDAÇÃO: o prompt termina mandando comparar o resultado com as fotos de referência e descartar/refazer se qualquer detalhe da pessoa ou do produto estiver diferente.

DURAÇÃO: o vídeo terá cerca de ${o.duracaoSeg} segundos. A ação descrita precisa caber com folga nesse tempo (pouca ação em 6s; mais completa em 15s).
Não use o caractere travessão no texto; use hífen ou dois-pontos.`;
}

/** Como o modelo deve responder, por formato de saída. */
function instrucaoSaida(o: OpcoesGerador): string {
  if (o.formato === "json") {
    return `RESPONDA SOMENTE com um JSON válido (sem markdown, sem crases, sem texto fora do JSON), completo e detalhado, neste formato:
{
  "titulo": "NOME DO PRODUTO - VIDEO UGC - IDENTIDADE BLOQUEADA",
  "formato": "video vertical 9:16, UGC gravado no celular",
  "duracao_segundos": ${o.duracaoSeg},
  "objetivo": "o que o video precisa alcancar",
  "identidade_bloqueada": {
    "regra": "as fotos anexadas sao referencia rigida: nao inventar, nao recriar, nao estilizar, nao simplificar, copiar exatamente",
    "proibido_alterar": ["lista item por item dos detalhes REAIS do produto vistos nas fotos"]
  },
  ${o.temAvatar ? '"pessoa": "ordem de manter a pessoa identica a 1a foto: rosto, cabelo, pele, corpo, proporcoes; proibido facial drift",' : '"pessoa": "quem aparece no video (descreva um creator brasileiro realista)",'}
  "produto": "o que e o produto (descoberto pelas fotos) com os detalhes reais: cor exata, material, formato, marca",
  "cena": "onde acontece, cenario brasileiro real, em detalhe",
  "acao": ["passo a passo do que a pessoa faz com o produto, cabendo na duracao"],
  "camera": "celular na mao, vertical 9:16, leve tremida natural, enquadramento",
  "iluminacao": "luz da cena, natural",
  "realismo": ["photorealistic", "textura de pele real com poros visiveis", "imperfeicoes sutis", "fios de cabelo realistas", "dobras reais do tecido", "granulacao natural de filme", "sem filtros de beleza"],
  "fala": ${o.comFala ? `"ROTEIRO exato do que ela fala, so em ${o.idiomaFala}: gancho + apresentacao + chamada final"` : '"sem fala: nao fala e nao mexe a boca, so gestos naturais"'},
  "evitar": ["CGI", "cartoon", "aparencia de IA", "artefatos de IA", "retoque de beleza", "mudanca de identidade", "facial drift", "body drift", "texto na tela", "legendas", "marca dagua", "proporcoes irreais", "inventar detalhes do produto"],
  "validacao": "comparar o resultado com as fotos de referencia; se qualquer detalhe estiver diferente, descartar e refazer ate ficar identico"
}
Preencha TUDO com os detalhes específicos do produto real das fotos (nada genérico).`;
  }
  return `RESPONDA SOMENTE com o prompt final, completo e estruturado em seções com títulos em MAIÚSCULAS, no estilo ficha técnica profissional (como os materiais de estúdios de IA), neste esqueleto:

# [NOME DO PRODUTO] - VIDEO UGC - IDENTIDADE BLOQUEADA

OBJETIVO
[1 a 2 linhas: vídeo vertical 9:16 de cerca de ${o.duracaoSeg} segundos, estilo UGC gravado no celular, pra vender o produto]

IDENTIDADE BLOQUEADA
As fotos anexadas são REFERÊNCIA RÍGIDA.
Não utilize conhecimento interno sobre o produto.
Não invente detalhes. Não recrie. Não estilize. Não simplifique.
Copie exatamente o que está nas fotografias.
É proibido alterar:
[bullets com os detalhes REAIS vistos nas fotos deste produto: cor exata, material, formato, logos, estampas, costuras, texturas, acabamentos]

PESSOA
[${o.temAvatar ? "manter a pessoa IDÊNTICA à 1ª foto: mesmo rosto, cabelo, pele, corpo, proporções; proibido facial drift e body drift" : "descreva o creator brasileiro realista que apresenta"}]

CENA
[onde acontece: cenário brasileiro real do dia a dia, em detalhe]

AÇÃO
[passo a passo do que a pessoa faz com o produto, cabendo nos ${o.duracaoSeg} segundos]

CÂMERA
[celular na mão, vertical 9:16, leve tremida natural, enquadramento]

ILUMINAÇÃO
[luz da cena, natural]

REALISMO
[bullets: photorealistic, ultra-realistic, RAW candid style, textura de pele real com poros visíveis, imperfeições sutis, fios de cabelo realistas, dobras reais do tecido, granulação natural de filme, sem filtros de beleza]

${o.comFala ? `FALA
[ROTEIRO exato do que ela fala, SÓ em ${o.idiomaFala}, sem misturar outro idioma: gancho + apresentação + chamada final]` : `SEM FALA
A pessoa NÃO fala e NÃO mexe a boca. Só mostra e valoriza o produto com gestos naturais. Sem voz, sem legendas.`}

EVITAR
[bullets: CGI, cartoon, estilização, aparência de IA, artefatos de IA, retoque de beleza, harmonização facial, mudança de identidade, facial drift, body drift, proporções irreais, texto na tela, legendas, marca d'água, distorções, inventar detalhes do produto]

VALIDAÇÃO
Compare o resultado com as fotos anexadas. Se qualquer detalhe da pessoa ou do produto estiver diferente da referência, descarte e refaça até ficar idêntico.

Regras da resposta: preencha TUDO com os detalhes específicos do produto real das fotos (nada genérico), em português. Sem explicações fora do prompt, sem cercas de código.`;
}

/** Mensagem do usuário: o pedido + o mapa de quais fotos são o quê. */
function mensagemUsuario(o: OpcoesGerador, totalImagens: number): string {
  const mapa = o.temAvatar
    ? `A 1ª imagem anexada é a PESSOA (avatar) do vídeo.${totalImagens > 1 ? ` As outras ${totalImagens - 1} são o PRODUTO.` : ""}`
    : `As ${totalImagens} imagens anexadas são o PRODUTO.`;
  const desc = (o.descricao ?? "").trim();
  return `${mapa}
${desc ? `O que eu quero no vídeo: ${desc}` : "Não tenho pedido específico: decida a melhor cena possível pra vender esse produto."}
Escreva o prompt agora.`;
}

/** GPT com visão (chat completions). Tenta o modelo principal e depois o reserva.
 *  A conta tem tokens grátis diários nos minis (data sharing ativado), então o
 *  padrão é o gpt-5-mini (mais esperto, mesmo balde grátis do gpt-4o-mini).
 *  null se faltar chave ou tudo falhar. */
async function viaOpenAI(sistema: string, usuario: string, imagens: ImagemVisao[]): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const conteudo: Record<string, unknown>[] = [{ type: "text", text: usuario }];
  for (const img of imagens.slice(0, 4)) {
    conteudo.push({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } });
  }
  const modelos = [...new Set([process.env.OPENAI_PROMPT_MODEL || "gpt-5-mini", "gpt-4o-mini"])];

  for (const modelo of modelos) {
    // gpt-5*: raciocina antes de responder; não aceita temperature custom e usa
    // max_completion_tokens (com folga pro raciocínio). gpt-4o*: parâmetros clássicos.
    const ehG5 = modelo.startsWith("gpt-5");
    const body: Record<string, unknown> = {
      model: modelo,
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: conteudo },
      ],
      ...(ehG5
        ? { max_completion_tokens: 5000, reasoning_effort: "low" }
        : { temperature: 0.7, max_tokens: 2500 }),
    };
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[gerador-prompt] openai falhou", modelo, res.status, txt.slice(0, 300));
        continue; // tenta o próximo modelo
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const out = data.choices?.[0]?.message?.content?.trim();
      if (out) return out;
    } catch (e) {
      console.error("[gerador-prompt] openai erro de rede/timeout", modelo, e);
    }
  }
  return null;
}

/** Limpa cercas de markdown que os modelos às vezes teimam em colocar. As quebras
 *  de linha FICAM (a ficha é estruturada); quem manda pro Grok troca por espaço. */
function limpar(texto: string, formato: "normal" | "json"): string {
  let t = texto.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (formato === "normal") {
    t = t.replace(/^["']|["']$/g, "").trim();
  }
  return t;
}

/** Gera o prompt: GPT primeiro; se falhar, Gemini. null se os dois falharem. */
export async function gerarPromptIA(
  imagens: ImagemVisao[],
  opcoes: OpcoesGerador,
): Promise<string | null> {
  const sistema = `${instrucaoBase(opcoes)}

${instrucaoSaida(opcoes)}`;
  const usuario = mensagemUsuario(opcoes, imagens.length);

  const doGpt = await viaOpenAI(sistema, usuario, imagens);
  if (doGpt) return limpar(doGpt, opcoes.formato);

  if (geminiConfigurado()) {
    const doGemini = await gerarTextoComImagens(`${sistema}

${usuario}`, imagens, 0.7);
    if (doGemini.trim()) return limpar(doGemini, opcoes.formato);
  }
  return null;
}
