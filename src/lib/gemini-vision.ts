import "server-only";

import { registrarGeminiTokens } from "@/lib/gastos-api";
import { extrairJSON } from "@/lib/llm";

/**
 * Gemini (visão) pro Vídeo com avatar. analisarProduto olha 1 a 3 fotos e descobre
 * o produto (nome, tipo, descrição fiel em inglês, sugestão de apresentação) -> é
 * o que deixa o prompt de imagem fiel ao produto real. Rotaciona as chaves se uma
 * falhar.
 */

/**
 * MODELO DO SITE (não confundir com os do `bot shopee/`, que são outros).
 *
 * Era `gemini-2.5-flash` até 06/08/2026, quando o Editor parou de funcionar. O
 * Google aposentou aquele modelo: fechou pra conta nova (chave nova recebe 404
 * "no longer available to new users") e deixou quem já usava com a cota do plano
 * gratuito, 20 pedidos por DIA por projeto e POR MODELO. Estourou os 20, o
 * Editor inteiro trava, porque posicionar as cenas virou passo obrigatório.
 *
 * O `gemini-3.5-flash-lite` foi escolhido por preço: entrada e saída no MESMO
 * valor do 2.5-flash ($0,30 e $2,50 por milhão), e o áudio a $0,30 em vez de
 * $1,00. Como o "Posicionar cenas" manda o áudio inteiro da fala, ele é o que
 * mais pesa aqui, então a troca sai mais barata que o modelo anterior.
 *
 * A cota é por MODELO: trocar o nome aqui já zera o contador, mesmo na chave
 * antiga. Se um dia isto travar de novo com 429, é cota do plano gratuito, e a
 * saída é billing no projeto do Google, não trocar de modelo outra vez.
 */
const MODELO = "gemini-3.5-flash-lite";

/**
 * As chaves de API do Google que dá pra usar aqui.
 *
 * O filtro aceita DOIS formatos: o antigo `AIza...` e o novo `AQ.A...`, que o
 * Google AI Studio passou a emitir. Antes ele exigia `AIza`, e o efeito era
 * cruel: com uma chave nova e válida no `.env`, a lista saía VAZIA e a
 * plataforma respondia "a análise está fora do ar" como se não houvesse chave
 * nenhuma (pego em 06/08/2026, na análise de cenas do Editor). O `bot shopee/`
 * nunca teve esse problema porque o Python não filtra por prefixo.
 *
 * O filtro continua existindo pra barrar valor vazio e placeholder ("sua-chave",
 * "cole-aqui"), que é o que faria a chamada estourar 400 sem explicação.
 */
function chaves(): string[] {
  const brutas = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
  ];
  return brutas
    .map((k) => (k ?? "").trim())
    .filter((k) => k.length >= 20 && (k.startsWith("AIza") || k.startsWith("AQ.")));
}

export function geminiConfigurado(): boolean {
  return chaves().length > 0;
}

/** Quem gerou o gasto (só contabilidade da aba Finanças; opcional). */
type QuemGastou = { userId?: string | null; origem?: string };

/**
 * POR QUE A CHAMADA AO GOOGLE NÃO DEU CERTO.
 *
 * Até 06/08/2026 o `gerar()` engolia qualquer falha e devolvia "" calado: cota
 * do dia estourada, chave inválida, modelo aposentado e Google fora do ar
 * viravam todos a mesma coisa. Quem sentia isso era o dono, no
 * /admin/diagnostico: toda falha do Editor aparecia como "Gemini respondeu, mas
 * nada aproveitável", que é MENTIRA quando o Google recusou o pedido na porta.
 * Investigar aquilo levava a procurar defeito no áudio, na descrição das cenas
 * ou no prompt, e o motivo real (429 de cota) só aparecia chamando a API na mão.
 */
export type FalhaGemini = {
  /** cota/limite estourado: tentar de novo AGORA não resolve, só amanhã */
  cota: boolean;
  /** uma linha por chave tentada, com o status e o que o Google respondeu */
  detalhe: string;
};

/**
 * Caixinha que o chamador passa pra receber o motivo quando a chamada falha.
 *
 * É caixa e não valor de retorno porque `gerar()` já devolve o texto, e mexer na
 * assinatura obrigaria a mudar os usos que não querem saber do motivo (avatar,
 * gerador de prompt). Quem passa a caixa lê `falha` depois; quem não passa
 * continua exatamente como antes.
 */
export type CaixaFalha = { falha: FalhaGemini | null };

/** Resume numa linha o erro que o Google devolveu. NUNCA levanta exceção: isto
 *  roda no meio do tratamento de um erro. */
async function motivoHttp(res: Response): Promise<{ resumo: string; cota: boolean }> {
  let msg = "";
  try {
    const bruto = (await res.text()).slice(0, 4000);
    try {
      const j = JSON.parse(bruto) as { error?: { message?: string } };
      msg = String(j?.error?.message ?? bruto);
    } catch {
      msg = bruto; // veio HTML/texto puro (proxy, 5xx do Google)
    }
  } catch {
    // corpo ilegível: o status sozinho já diz muita coisa
  }
  // o Google enche a mensagem de "saiba mais em <link>", e era justamente isso
  // que sobrava depois do corte, empurrando pra fora a única parte que importa
  // (qual cota estourou e qual o limite). Fora os links, cabe tudo.
  msg = msg
    .replace(/(For more information|To monitor)[^:]*:\s*https?:\/\/\S+/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  const cota = res.status === 429 || /quota|RESOURCE_EXHAUSTED|rate limit/i.test(msg);
  return { resumo: `HTTP ${res.status}${msg ? ` - ${msg}` : ""}`, cota };
}

/** Chamada base do Gemini: recebe as parts (texto e/ou imagem) e devolve o texto.
 *  Rotaciona as chaves quando uma estoura/limita. "" se todas falharem, e aí o
 *  motivo de CADA uma fica na `caixa` (quando o chamador passar uma). */
async function gerar(
  parts: Record<string, unknown>[],
  temperature: number,
  quem?: QuemGastou,
  caixa?: CaixaFalha,
): Promise<string> {
  const ks = chaves();
  const body = { contents: [{ parts }], generationConfig: { temperature } };
  // a caixa vale por chamada: sucesso de agora apaga a falha da chamada anterior
  if (caixa) caixa.falha = null;
  const motivos: string[] = [];
  let cota = false;
  for (let n = 0; n < ks.length; n++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${ks[n]}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(45_000),
        },
      );
      if (!res.ok) {
        const { resumo, cota: ehCota } = await motivoHttp(res);
        cota = cota || ehCota;
        motivos.push(`chave ${n + 1}: ${resumo}`);
        continue;
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
        usageMetadata?: { totalTokenCount?: number };
      };
      // contabilidade do dono (aba Finanças): tokens usados nesta chamada
      await registrarGeminiTokens(
        quem?.userId ?? null,
        data.usageMetadata?.totalTokenCount ?? 0,
        quem?.origem ?? "web-vision",
      ).catch(() => {});
      const txt =
        data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (txt.trim()) return txt;
      // 200 e mesmo assim sem texto: quase sempre corte de segurança do Google
      motivos.push(
        `chave ${n + 1}: HTTP 200 sem texto (motivo do fim: ${
          data.candidates?.[0]?.finishReason ?? "não informado"
        }${data.promptFeedback?.blockReason ? `, bloqueio: ${data.promptFeedback.blockReason}` : ""})`,
      );
    } catch (e) {
      // rede/timeout: tenta a próxima chave, mas guarda o porquê
      motivos.push(
        `chave ${n + 1}: ${(e as Error)?.name ?? "Erro"} - ${(e as Error)?.message ?? String(e)}`,
      );
    }
  }
  if (caixa) {
    caixa.falha = {
      cota,
      detalhe: motivos.length
        ? `modelo ${MODELO}; ${motivos.join(" | ")}`
        : "Nenhuma chave do Google configurada no ambiente do site.",
    };
  }
  return "";
}

/** Chamada genérica: instrução + imagens -> texto. Usada pelo gerador de prompt
 *  como plano B quando o GPT falha. "" se todas as chaves falharem. */
export async function gerarTextoComImagens(
  instrucao: string,
  imagens: { mime: string; base64: string }[],
  temperature = 0.7,
  quem?: QuemGastou,
): Promise<string> {
  const parts: Record<string, unknown>[] = [{ text: instrucao }];
  for (const img of imagens.slice(0, 4)) {
    parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
  }
  return gerar(parts, temperature, quem);
}

// ---- Análise das cenas de apoio do Editor automático (visão) ----

/** Uma cena mandada pra IA olhar: os quadros já vêm extraídos pelo navegador. */
export type CenaParaAnalisar = {
  /** índice do clipe na lista da tela (volta igual na resposta) */
  i: number;
  tipo: "video" | "image";
  /** JPEG em base64, na ordem do começo pro fim do trecho cortado */
  quadros: string[];
};

/**
 * Contexto opcional do produto (06/08/2026, pedido do dono): quando "É um
 * produto? Sim", a IA que descreve as cenas fica sabendo DO QUE o vídeo trata.
 * "Close no tecido da blusa" vira "close no tecido da Blusa Térmica X". Só
 * contexto: a instrução continua proibindo inventar o que não dá pra ver.
 */
export type ProdutoContexto = {
  nome?: string;
  preco?: string;
  descricao?: string;
};

export type CenaAnalisada = {
  /** o que a cena mostra, numa frase */
  mostra: string;
  /**
   * Qual pedaço do clipe vale a pena mostrar, de 0 (começo do corte) a 1 (fim).
   * É o que evita entregar os 30 segundos inteiros de um apoio: a cena entra no
   * momento em que ela é forte. Em foto vem sempre 0.
   */
  melhor: number;
};

/** Cenas por chamada. Cada cena leva até 5 quadros, então 3 já são 15 imagens
 *  numa requisição só: mais que isso a resposta começa a embolar as cenas. */
const CENAS_POR_LOTE = 3;
/** Teto da FRASE que a IA escreve (ela é instruída a no máximo 12 palavras).
 *  O campo da tela aceita mais (640, `MAX_DESCRICAO_CHARS` do montagem.ts):
 *  este aqui é só o corte de segurança da resposta do modelo. */
const MAX_DESCRICAO = 160;

const INSTRUCAO_CENAS = `Estas são cenas de apoio de um vídeo vertical de venda: elas entram POR CIMA da pessoa que fala, em tela cheia, no momento em que a fala dela combinar com o que a cena mostra.

Para CADA cena responda duas coisas:
1) "mostra": UMA frase curta (no máximo 12 palavras), em português do Brasil, dizendo o que aparece na tela. Diga o que se VÊ: o objeto, a parte em destaque e a ação (ex.: "close no tecido da legging sendo esticado"). Nos vídeos, compare os quadros na ordem pra captar o MOVIMENTO. Não invente marca, preço nem material que não dê pra ver, e nada de opinião ou copy de venda.
2) "melhor": um número de 0 a 1 dizendo em que ponto do clipe está o quadro MAIS FORTE (0 = o primeiro quadro que você recebeu, 1 = o último). O clipe inteiro não vai pro vídeo: só uns segundos a partir desse ponto, então escolha onde a ação acontece de verdade e não onde a câmera ainda está se ajustando. Em foto responda 0.

Use o mesmo número que veio no rótulo "CENA N". Responda SOMENTE JSON:
{"cenas": [{"cena": 0, "mostra": "close no tecido sendo esticado", "melhor": 0.4}]}`;

/**
 * Olha os quadros de cada cena de apoio e escreve o que ela mostra + em que ponto
 * dela está o melhor pedaço.
 *
 * É o que salva a cena que a pessoa subiu SEM descrever: sem nenhuma pista do
 * conteúdo, o encaixe do apoio só consegue espalhar as cenas pelo ritmo, em vez
 * de casar com o trecho da fala que combina com aquela imagem.
 *
 * Roda ANTES de gerar (na etapa de aprovação do Editor), e não no render: assim
 * a pessoa lê o que a IA entendeu e corrige antes de gastar o vídeo. A frase vai
 * junto no roteiro, então a fábrica não descreve de novo e ninguém paga duas vezes.
 *
 * Lote que falhar fica de fora e o resto vale: descrição é melhoria, não requisito.
 */
export async function descreverCenas(
  cenas: CenaParaAnalisar[],
  quem?: QuemGastou,
  produto?: ProdutoContexto,
  caixa?: CaixaFalha,
): Promise<Record<number, CenaAnalisada>> {
  if (!chaves().length || !cenas.length) return {};
  // uma linha de contexto sobre o produto, montada uma vez e usada em todo lote
  const pedacos = [
    produto?.nome?.trim() &&
      `o produto divulgado é "${produto.nome.trim().slice(0, 120)}"`,
    produto?.preco?.trim() && `vendido por R$ ${produto.preco.trim().slice(0, 20)}`,
    produto?.descricao?.trim() &&
      `sobre ele: "${produto.descricao.trim().slice(0, 300)}"`,
  ].filter(Boolean);
  const contextoProduto = pedacos.length
    ? `Contexto do vídeo: ${pedacos.join(", ")}. Use isso só pra reconhecer e nomear o que aparece nas cenas; continue descrevendo apenas o que dá pra VER.`
    : "";
  const out: Record<number, CenaAnalisada> = {};
  for (let k = 0; k < cenas.length; k += CENAS_POR_LOTE) {
    const lote = cenas.slice(k, k + CENAS_POR_LOTE);
    const parts: Record<string, unknown>[] = [];
    let esperadas = 0;
    for (const c of lote) {
      const quadros = (c.quadros ?? []).filter(Boolean);
      if (!quadros.length) continue;
      esperadas += 1;
      parts.push({
        text:
          c.tipo === "image" || quadros.length === 1
            ? `CENA ${c.i} (foto parada):`
            : `CENA ${c.i} (${quadros.length} quadros do MESMO trecho de vídeo, na ordem do começo pro fim):`,
      });
      for (const q of quadros) {
        parts.push({ inline_data: { mime_type: "image/jpeg", data: q } });
      }
    }
    if (!esperadas) continue;
    if (contextoProduto) parts.push({ text: contextoProduto });
    parts.push({ text: INSTRUCAO_CENAS });

    const txt = await gerar(parts, 0.2, quem ?? { origem: "editor-cenas" }, caixa);
    const j = extrairJSON<{
      cenas?: { cena?: unknown; mostra?: unknown; melhor?: unknown }[];
    }>(txt);
    for (const item of j?.cenas ?? []) {
      const i = Number(item?.cena);
      const mostra = String(item?.mostra ?? "").trim().slice(0, MAX_DESCRICAO);
      if (!Number.isInteger(i) || !mostra) continue;
      const bruto = Number(item?.melhor);
      const melhor = Number.isFinite(bruto) ? Math.max(0, Math.min(1, bruto)) : 0;
      out[i] = { mostra, melhor };
    }
  }
  return out;
}

// ---- Posicionar as cenas de apoio na linha do tempo (áudio + descrições) ----

/** Uma cena de apoio esperando um lugar na linha do tempo do vídeo. */
export type CenaParaPosicionar = {
  /** índice do clipe na lista da tela (volta igual na resposta) */
  i: number;
  tipo: "video" | "image";
  /** o que a cena mostra (escrito pela pessoa ou pela IA de visão) */
  descricao: string;
  /** quanto tempo ela vai ficar na tela, em segundos */
  dur: number;
};

export type CenaPosicionada = {
  /** em que segundo da base a cena entra */
  entra: number;
  /** por que a IA escolheu esse momento (uma frase curta, pra pessoa conferir) */
  porque: string;
};

/** Áudio do vídeo principal, extraído no navegador (WAV 16 kHz mono, base64). */
export type AudioBase = { mime: string; base64: string };

const MAX_PORQUE = 120;

const INSTRUCAO_POSICIONAR = `Você está montando um vídeo vertical de venda. O ÁUDIO acima é a fala do vídeo principal, do começo ao fim. Por cima dessa pessoa entram cenas de apoio em tela cheia, cada uma por poucos segundos, e depois a imagem volta pra ela.

Sua tarefa: ouvir a fala e dizer, para CADA cena da lista, em que SEGUNDO ela deve entrar.

Regras:
- A cena entra no momento em que a fala fala DAQUILO que a cena mostra. Se a pessoa diz "olha o tecido" no segundo 7, a cena do tecido entra por volta do segundo 7.
- Encoste o momento numa pausa da fala (fim de frase) sempre que der: cortar no meio de uma palavra incomoda.
- As cenas NÃO podem se sobrepor nem passar do fim do vídeo. Respeite a duração de cada uma.
- Se a fala não tiver nada a ver com a cena, espalhe ela num trecho vazio, longe das outras.
- Se a pessoa escreveu um pedido explícito na descrição ("quando eu falar de X, entre aqui"), OBEDEÇA.

Responda SOMENTE JSON, usando o mesmo número que veio em "CENA N":
{"cenas": [{"cena": 0, "entra": 7.4, "porque": "ela fala do tecido nesse ponto"}]}`;

/**
 * Ouve o áudio do vídeo principal e decide em que segundo cada cena de apoio
 * entra, ANTES de mandar renderizar.
 *
 * Por que o áudio e não a transcrição: o Whisper mora no worker Python, não no
 * servidor web. O Gemini lê áudio direto, então o navegador extrai a faixa do
 * arquivo local (WAV 16 kHz mono, que é leve) e uma chamada só faz as duas
 * coisas: entender o que está sendo dito e casar com o que cada cena mostra.
 *
 * O que sai daqui vai pro campo `entra` de cada apoio, então o render obedece a
 * posição em vez de decidir por conta própria. Falha devolve `{}` e a tela cai
 * na distribuição por ritmo de sempre, sem cobrar nada.
 */
export async function posicionarCenas(
  audio: AudioBase | null,
  cenas: CenaParaPosicionar[],
  durBase: number,
  quem?: QuemGastou,
  contexto?: { base?: string; produto?: ProdutoContexto },
  caixa?: CaixaFalha,
): Promise<Record<number, CenaPosicionada>> {
  if (!chaves().length || !cenas.length || durBase <= 0) return {};

  const parts: Record<string, unknown>[] = [];
  if (audio?.base64) {
    parts.push({ text: "ÁUDIO da fala do vídeo principal:" });
    parts.push({ inline_data: { mime_type: audio.mime, data: audio.base64 } });
  } else {
    // sem áudio (vídeo mudo, ou o navegador não conseguiu ler a faixa): a IA
    // ainda distribui pelas descrições, só que sem casar com a fala
    parts.push({
      text: "Este vídeo não tem fala pra ouvir: distribua as cenas de forma equilibrada ao longo do tempo, respeitando o que cada uma mostra.",
    });
  }

  const linhas = [
    `O vídeo principal dura ${durBase.toFixed(1)} segundos.`,
    contexto?.base?.trim() && `Na imagem do vídeo principal aparece: "${contexto.base.trim().slice(0, 400)}".`,
    contexto?.produto?.nome?.trim() &&
      `O produto divulgado é "${contexto.produto.nome.trim().slice(0, 120)}"${
        contexto.produto.preco?.trim() ? `, vendido por R$ ${contexto.produto.preco.trim().slice(0, 20)}` : ""
      }.`,
    "",
    "CENAS DE APOIO:",
    ...cenas.map(
      (c) =>
        `CENA ${c.i} (${c.tipo === "image" ? "foto" : "vídeo"}, fica ${c.dur.toFixed(1)}s na tela): ${
          c.descricao.trim().slice(0, 400) || "sem descrição"
        }`,
    ),
  ].filter(Boolean);
  parts.push({ text: linhas.join("\n") });
  parts.push({ text: INSTRUCAO_POSICIONAR });

  const txt = await gerar(parts, 0.2, quem ?? { origem: "editor-posicionar" }, caixa);
  const j = extrairJSON<{
    cenas?: { cena?: unknown; entra?: unknown; porque?: unknown }[];
  }>(txt);

  const out: Record<number, CenaPosicionada> = {};
  for (const item of j?.cenas ?? []) {
    const i = Number(item?.cena);
    const entra = Number(item?.entra);
    if (!Number.isInteger(i) || !Number.isFinite(entra)) continue;
    out[i] = {
      entra: Math.max(0, Math.min(durBase, entra)),
      porque: String(item?.porque ?? "").trim().slice(0, MAX_PORQUE),
    };
  }
  return out;
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
  quem?: QuemGastou,
): Promise<AnaliseProduto | null> {
  if (!chaves().length || !imagens.length) return null;
  const parts: Record<string, unknown>[] = [{ text: INSTRUCAO_PRODUTO }];
  for (const img of imagens.slice(0, 3)) {
    parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
  }
  const txt = await gerar(parts, 0.2, quem ?? { origem: "avatar-analise" });
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
