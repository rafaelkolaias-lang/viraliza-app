import "server-only";

import { prisma } from "@/lib/prisma";
import { PRECO_USD, USD_BRL, type Consumo } from "@/lib/precos";

/**
 * Gasto REAL com as APIs pagas (visão do ADMIN na aba Finanças).
 *
 * Cada consumo de API vira uma linha na tabela GastoApi: quem gastou, qual API,
 * quanto do recurso (tokens, caracteres, segundos, imagens) e o custo estimado
 * em MILÉSIMOS de centavo de R$ (100000 = R$ 1,00) pra não perder precisão em
 * consumos minúsculos. Nada aqui cobra o usuário: crédito é com lib/creditos;
 * esta tabela é só contabilidade de custo do dono.
 *
 * OpenAI tem endpoint OFICIAL de custo (fatura real): quando OPENAI_ADMIN_KEY
 * estiver no env, o card da OpenAI usa o valor da fatura em vez da estimativa.
 */

export type ApiPaga = "openai" | "gemini" | "veo" | "eleven" | "grok";

// Cotação e preços ajustáveis por env (sem deploy). Padrões combinados com o dono.
const CAMBIO = Number(process.env.USD_BRL || "") || USD_BRL; // R$ por US$ (padrão 5,50)
const PRECOS = {
  // Veo (cena animada da fábrica): US$ por segundo de vídeo (veo 2 = 0.35)
  veoUsdSeg: Number(process.env.VEO_USD_SEG || "") || 0.35,
  // OpenAI texto (roteiros/falas/fichas): US$ por 1M tokens, taxa média in+out
  openaiTxtUsdMTok: Number(process.env.OPENAI_TXT_USD_MTOK || "") || 0.6,
  // OpenAI imagem (gpt-image, avatares): US$ por imagem gerada
  openaiImgUsd: Number(process.env.OPENAI_IMG_USD || "") || 0.06,
  // Grok (assinatura): média em CENTAVOS por vídeo de 10s (pedido do dono: R$ 0,61)
  grokCentavos10s: Number(process.env.GROK_CUSTO_10S_CENTAVOS || "") || 61,
  // Grok imagem: centavos por imagem (0 = coberto pela assinatura, ajustar se quiser)
  grokCentavosImg: Number(process.env.GROK_CUSTO_IMAGEM_CENTAVOS || "") || 0,
  // OpenAI gpt-5-mini (robô de suporte): US$ por 1M tokens, SEPARADO por tipo.
  // Aqui não dá pra usar a taxa média do `openaiTxtUsdMTok`: a conversa do
  // suporte é 85% prompt fixo, que a OpenAI serve do cache por 1/10 do preço.
  // Uma taxa média cobraria ~10x a mais do que sai de verdade.
  openaiMiniEntradaUsdMTok: Number(process.env.OPENAI_MINI_IN_USD_MTOK || "") || 0.25,
  openaiMiniCacheUsdMTok: Number(process.env.OPENAI_MINI_CACHE_USD_MTOK || "") || 0.025,
  openaiMiniSaidaUsdMTok: Number(process.env.OPENAI_MINI_OUT_USD_MTOK || "") || 2.0,
};

/** Marca de origem do robô de suporte na tabela GastoApi. Mora aqui pra rota que
 *  grava e painel que soma usarem a MESMA string (o campo tem 32 caracteres). */
export const ORIGEM_SUPORTE = "suporte-chat";

const miliDeUsd = (usd: number) => Math.max(0, Math.round(usd * CAMBIO * 100_000));
const miliDeCentavos = (c: number) => Math.max(0, Math.round(c * 1000));

type NovoGasto = {
  userId?: string | null;
  jobId?: string | null;
  api: ApiPaga;
  recurso: "tokens" | "tokens_img" | "chars" | "segundos" | "imagens";
  quantidade: number;
  custoMili: number;
  origem?: string;
};

/** Grava um gasto. NUNCA derruba a geração: falha aqui só perde a linha do extrato. */
export async function registrarGasto(g: NovoGasto): Promise<void> {
  if (g.quantidade <= 0 && g.custoMili <= 0) return;
  try {
    await prisma.gastoApi.create({
      data: {
        userId: g.userId || null,
        jobId: g.jobId || null,
        api: g.api,
        recurso: g.recurso,
        quantidade: g.quantidade,
        custoMili: g.custoMili,
        origem: g.origem?.slice(0, 32) || null,
      },
    });
  } catch (e) {
    console.error("[gastos-api] falhou ao registrar gasto", g.api, e);
  }
}

/** Consumo que o worker reporta ao concluir um job (fábrica ou cortes).
 *  Idempotente por jobId: re-envio do worker não duplica as linhas. */
export async function registrarConsumoJob(
  userId: string,
  jobId: string,
  consumo: Consumo,
  origem: string,
): Promise<void> {
  try {
    const ja = await prisma.gastoApi.findFirst({ where: { jobId }, select: { id: true } });
    if (ja) return;
  } catch {
    return; // sem leitura confiável, melhor não arriscar duplicar
  }
  const flash = consumo.geminiFlashTokens ?? 0;
  const img = consumo.geminiImgTokens ?? 0;
  const chars = consumo.elevenChars ?? 0;
  const veoSeg = consumo.veoSegundos ?? 0;
  if (flash > 0) {
    await registrarGasto({
      userId, jobId, api: "gemini", recurso: "tokens", quantidade: flash,
      custoMili: miliDeUsd((flash / 1_000_000) * PRECO_USD.geminiFlashPorMTokens), origem,
    });
  }
  if (img > 0) {
    await registrarGasto({
      userId, jobId, api: "gemini", recurso: "tokens_img", quantidade: img,
      custoMili: miliDeUsd((img / 1_000_000) * PRECO_USD.geminiImgPorMTokens), origem,
    });
  }
  if (chars > 0) {
    await registrarGasto({
      userId, jobId, api: "eleven", recurso: "chars", quantidade: chars,
      custoMili: miliDeUsd((chars / 1000) * PRECO_USD.elevenPorMilChars), origem,
    });
  }
  if (veoSeg > 0) {
    await registrarGasto({
      userId, jobId, api: "veo", recurso: "segundos", quantidade: veoSeg,
      custoMili: miliDeUsd(veoSeg * PRECOS.veoUsdSeg), origem,
    });
  }
}

/** Vídeo gerado no Grok: média de R$ 0,61 a cada 10s (configurável no env). */
export async function registrarGrokVideo(
  userId: string,
  jobId: string | null,
  segundos: number,
  origem: string,
): Promise<void> {
  const seg = Math.max(1, segundos);
  await registrarGasto({
    userId, jobId, api: "grok", recurso: "segundos", quantidade: seg,
    custoMili: miliDeCentavos((seg / 10) * PRECOS.grokCentavos10s), origem,
  });
}

/** Imagem gerada no robô do Grok (assinatura; custo padrão 0, ajustável no env). */
export async function registrarGrokImagem(userId: string, origem: string): Promise<void> {
  await registrarGasto({
    userId, api: "grok", recurso: "imagens", quantidade: 1,
    custoMili: miliDeCentavos(PRECOS.grokCentavosImg), origem,
  });
}

/** Tokens de uma chamada de chat da OpenAI (roteiro, falas, cena, ficha...). */
export async function registrarOpenAITokens(
  userId: string | null,
  totalTokens: number,
  origem: string,
): Promise<void> {
  if (!totalTokens || totalTokens <= 0) return;
  await registrarGasto({
    userId, api: "openai", recurso: "tokens", quantidade: totalTokens,
    custoMili: miliDeUsd((totalTokens / 1_000_000) * PRECOS.openaiTxtUsdMTok), origem,
  });
}

/**
 * Uma resposta do robô de suporte (gpt-5-mini), com os três tipos de token
 * cobrados por preços diferentes. Grava UMA linha, com a quantidade somada e o
 * custo já calculado direito - a tabela só tem um campo de quantidade, e o que
 * interessa no painel é o dinheiro.
 */
export async function registrarOpenAIChat(
  userId: string | null,
  uso: { entrada: number; entradaCache: number; saida: number },
  origem: string,
): Promise<void> {
  const total = uso.entrada + uso.entradaCache + uso.saida;
  if (total <= 0) return;
  const usd =
    (uso.entrada / 1_000_000) * PRECOS.openaiMiniEntradaUsdMTok +
    (uso.entradaCache / 1_000_000) * PRECOS.openaiMiniCacheUsdMTok +
    (uso.saida / 1_000_000) * PRECOS.openaiMiniSaidaUsdMTok;
  await registrarGasto({
    userId, api: "openai", recurso: "tokens", quantidade: total,
    custoMili: miliDeUsd(usd), origem,
  });
}

/** Imagens do gpt-image (avatares). */
export async function registrarOpenAIImagem(
  userId: string | null,
  quantidade: number,
  origem: string,
): Promise<void> {
  if (!quantidade || quantidade <= 0) return;
  await registrarGasto({
    userId, api: "openai", recurso: "imagens", quantidade,
    custoMili: miliDeUsd(quantidade * PRECOS.openaiImgUsd), origem,
  });
}

/** Tokens do Gemini chamados direto da web (visão do avatar, plano B do prompt). */
export async function registrarGeminiTokens(
  userId: string | null,
  totalTokens: number,
  origem: string,
): Promise<void> {
  if (!totalTokens || totalTokens <= 0) return;
  await registrarGasto({
    userId, api: "gemini", recurso: "tokens", quantidade: totalTokens,
    custoMili: miliDeUsd((totalTokens / 1_000_000) * PRECO_USD.geminiFlashPorMTokens), origem,
  });
}

// ---------------------------------------------------------------------------
// Fatura REAL da OpenAI (endpoint oficial de custos; precisa de OPENAI_ADMIN_KEY)
// ---------------------------------------------------------------------------

export function openaiAdminConfigurada(): boolean {
  return !!process.env.OPENAI_ADMIN_KEY;
}

// cache curtinho: a página é force-dynamic e o admin pode ficar dando F5
let cacheOpenAI: { chave: string; valor: number | null; em: number } | null = null;

/** Custo REAL da OpenAI no período, em CENTAVOS de R$. null = sem chave ou falha. */
export async function custoOpenAIRealCentavos(
  inicioMs: number,
  fimMs: number,
): Promise<number | null> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) return null;

  const start = Math.floor(inicioMs / 1000);
  const end = Math.ceil(fimMs / 1000);
  const chave = `${start}-${end}`;
  if (cacheOpenAI && cacheOpenAI.chave === chave && Date.now() - cacheOpenAI.em < 5 * 60_000) {
    return cacheOpenAI.valor;
  }

  let totalUsd = 0;
  let page: string | undefined;
  try {
    // buckets diários; "page" pagina quando o período passa do limite por request
    for (let i = 0; i < 10; i++) {
      const u = new URL("https://api.openai.com/v1/organization/costs");
      u.searchParams.set("start_time", String(start));
      u.searchParams.set("end_time", String(end));
      u.searchParams.set("limit", "180");
      if (page) u.searchParams.set("page", page);
      const r = await fetch(u, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) {
        console.error("[gastos-api] OpenAI costs falhou", r.status);
        cacheOpenAI = { chave, valor: null, em: Date.now() };
        return null;
      }
      const d = (await r.json()) as {
        data?: { results?: { amount?: { value?: number } }[] }[];
        has_more?: boolean;
        next_page?: string;
      };
      for (const bucket of d.data ?? []) {
        for (const res of bucket.results ?? []) totalUsd += res.amount?.value ?? 0;
      }
      if (!d.has_more || !d.next_page) break;
      page = d.next_page;
    }
  } catch (e) {
    console.error("[gastos-api] OpenAI costs erro de rede", e);
    cacheOpenAI = { chave, valor: null, em: Date.now() };
    return null;
  }

  const centavos = Math.round(totalUsd * CAMBIO * 100);
  cacheOpenAI = { chave, valor: centavos, em: Date.now() };
  return centavos;
}

// ---------------------------------------------------------------------------
// Agregação pro painel de Finanças
// ---------------------------------------------------------------------------

export type GastoApiResumo = {
  api: ApiPaga;
  label: string;
  custoCentavos: number;
  /** true = valor da fatura oficial; false = estimativa interna */
  real: boolean;
  detalhe: string; // "1,2M tokens", "34 vídeos (380s)", ...
};

export type GastoUsuarioLinha = {
  userId: string;
  nome: string;
  email: string;
  custoCentavos: number; // custo real (APIs) que esse usuário gerou
  creditosCentavos: number; // créditos que ele pagou (débitos no período)
  margemCentavos: number; // créditos - custo (negativo = dá prejuízo)
};

/**
 * Recorte do robô de suporte dentro do gasto da OpenAI.
 *
 * É uma FATIA, não uma parcela nova: estas linhas já estão somadas no card da
 * OpenAI e no total. Existe separado porque o suporte é o único gasto de API que
 * não tem contrapartida em crédito (a conversa é de graça pro usuário), então o
 * dono precisa ver o número sozinho pra saber se vale o que custa.
 */
export type GastoSuporte = {
  custoCentavos: number;
  tokens: number;
  /** quantas respostas o robô deu no período (1 linha = 1 chamada ao modelo) */
  respostas: number;
};

export type PainelGastos = {
  /** desde quando existe registro interno (as linhas começam no deploy desta feature) */
  registroDesde: string | null;
  openaiConfigurada: boolean; // OPENAI_ADMIN_KEY presente
  porApi: GastoApiResumo[];
  totalCentavos: number;
  porUsuario: GastoUsuarioLinha[];
  sistemaCentavos: number; // gastos sem usuário (rotinas internas)
  suporte: GastoSuporte; // fatia do robô de suporte (JÁ dentro de porApi/total)
};

const LABELS: Record<ApiPaga, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
  veo: "Veo",
  eleven: "ElevenLabs",
  grok: "Grok",
};

const fmtQtd = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`
    : n >= 1000
      ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
      : `${Math.round(n)}`;

const fmtDia = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export async function getPainelGastos(inicioMs: number, fimMs: number): Promise<PainelGastos> {
  const vazio: PainelGastos = {
    registroDesde: null,
    openaiConfigurada: openaiAdminConfigurada(),
    porApi: [],
    totalCentavos: 0,
    porUsuario: [],
    sistemaCentavos: 0,
    suporte: { custoCentavos: 0, tokens: 0, respostas: 0 },
  };

  try {
    const de = new Date(inicioMs);
    const ate = new Date(fimMs);

    const [linhas, primeiro, custoOpenAIReal, suporteBruto] = await Promise.all([
      prisma.gastoApi.groupBy({
        by: ["api", "recurso"],
        where: { criadoEm: { gte: de, lte: ate } },
        _sum: { custoMili: true, quantidade: true },
        _count: { _all: true },
      }),
      prisma.gastoApi.findFirst({ orderBy: { criadoEm: "asc" }, select: { criadoEm: true } }),
      custoOpenAIRealCentavos(inicioMs, fimMs),
      // fatia do robô de suporte: mesma janela, filtrada pela marca de origem
      prisma.gastoApi.aggregate({
        where: { criadoEm: { gte: de, lte: ate }, origem: ORIGEM_SUPORTE },
        _sum: { custoMili: true, quantidade: true },
        _count: { _all: true },
      }),
    ]);

    const suporte: GastoSuporte = {
      custoCentavos: Math.round((suporteBruto._sum.custoMili ?? 0) / 1000),
      tokens: Math.round(suporteBruto._sum.quantidade ?? 0),
      respostas: suporteBruto._count._all,
    };

    // soma por API + partes pro texto do card
    const porApiMap = new Map<ApiPaga, { custoMili: number; partes: string[] }>();
    for (const l of linhas) {
      const api = l.api as ApiPaga;
      const atual = porApiMap.get(api) ?? { custoMili: 0, partes: [] };
      atual.custoMili += l._sum.custoMili ?? 0;
      const q = l._sum.quantidade ?? 0;
      if (q > 0) {
        if (l.recurso === "tokens") atual.partes.push(`${fmtQtd(q)} tokens`);
        else if (l.recurso === "tokens_img") atual.partes.push(`${fmtQtd(q)} tokens de imagem`);
        else if (l.recurso === "chars") atual.partes.push(`${fmtQtd(q)} caracteres`);
        else if (l.recurso === "segundos")
          atual.partes.push(`${l._count._all} vídeo(s), ${fmtQtd(q)}s`);
        else if (l.recurso === "imagens") atual.partes.push(`${fmtQtd(q)} imagem(ns)`);
      }
      porApiMap.set(api, atual);
    }

    const porApi: GastoApiResumo[] = [];
    let total = 0;
    for (const api of ["openai", "gemini", "veo", "eleven", "grok"] as ApiPaga[]) {
      const d = porApiMap.get(api);
      let custoCentavos = Math.round((d?.custoMili ?? 0) / 1000);
      let real = false;
      // OpenAI: fatura oficial manda no TOTAL do card (a estimativa vira detalhe)
      if (api === "openai" && custoOpenAIReal !== null) {
        custoCentavos = custoOpenAIReal;
        real = true;
      }
      if (custoCentavos <= 0 && !d) {
        porApi.push({ api, label: LABELS[api], custoCentavos: 0, real, detalhe: "sem uso no período" });
        continue;
      }
      porApi.push({
        api,
        label: LABELS[api],
        custoCentavos,
        real,
        detalhe: d?.partes.join(" · ") || (real ? "fatura oficial" : "sem uso registrado"),
      });
    }
    total = porApi.reduce((s, a) => s + a.custoCentavos, 0);

    // por usuário: custo real x créditos debitados no mesmo período
    const [gastoPorUser, debitosPorUser] = await Promise.all([
      prisma.gastoApi.groupBy({
        by: ["userId"],
        where: { criadoEm: { gte: de, lte: ate } },
        _sum: { custoMili: true },
      }),
      prisma.creditoTransacao.groupBy({
        by: ["userId"],
        where: {
          criadoEm: { gte: de, lte: ate },
          tipo: { in: ["debito_geracao", "debito_processamento"] },
        },
        _sum: { valor: true },
      }),
    ]);

    let sistemaCentavos = 0;
    const usuarios = new Map<string, { custoMili: number; creditos: number }>();
    for (const g of gastoPorUser) {
      const mili = g._sum.custoMili ?? 0;
      if (!g.userId) {
        sistemaCentavos += Math.round(mili / 1000);
        continue;
      }
      const u = usuarios.get(g.userId) ?? { custoMili: 0, creditos: 0 };
      u.custoMili += mili;
      usuarios.set(g.userId, u);
    }
    for (const t of debitosPorUser) {
      if (!t.userId) continue; // transação de conta excluída (auditoria #14): sem linha por pessoa
      const u = usuarios.get(t.userId) ?? { custoMili: 0, creditos: 0 };
      u.creditos += Math.abs(t._sum.valor ?? 0); // débitos são negativos no extrato
      usuarios.set(t.userId, u);
    }

    const ids = [...usuarios.keys()];
    const contas = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, nome: true, email: true },
        })
      : [];
    const contaPorId = new Map(contas.map((c) => [c.id, c]));

    const porUsuario: GastoUsuarioLinha[] = ids
      .map((id) => {
        const u = usuarios.get(id)!;
        const conta = contaPorId.get(id);
        const custoCentavos = Math.round(u.custoMili / 1000);
        return {
          userId: id,
          nome: conta?.nome || "Conta removida",
          email: conta?.email || "?",
          custoCentavos,
          creditosCentavos: u.creditos,
          margemCentavos: u.creditos - custoCentavos,
        };
      })
      .sort((a, b) => b.custoCentavos - a.custoCentavos)
      .slice(0, 100);

    return {
      registroDesde: primeiro ? fmtDia.format(primeiro.criadoEm) : null,
      openaiConfigurada: openaiAdminConfigurada(),
      porApi,
      totalCentavos: total,
      porUsuario,
      sistemaCentavos,
      suporte,
    };
  } catch (e) {
    console.error("[gastos-api] falhou ao montar painel de gastos", e);
    return vazio;
  }
}
