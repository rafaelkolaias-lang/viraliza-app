import "server-only";

/**
 * Gasto com anúncios na Meta (Facebook/Instagram Ads) - custo de tráfego.
 *
 * NÃO confundir com `meta-capi.ts`: aquele MANDA a venda pro pixel (atribuição);
 * este LÊ quanto a conta de anúncios gastou. São credenciais diferentes:
 *   - META_ADS_ACCOUNT_ID = id numérico da conta de anúncios (sem o "act_")
 *   - META_ADS_TOKEN      = token de usuário do sistema da BM com permissão
 *                           `ads_read` (Configurações do negócio > Usuários do
 *                           sistema > Gerar token). Esse tipo de token não vence.
 *
 * Falha aqui NUNCA quebra a página de Finanças: o card só mostra o motivo.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const TOKEN = process.env.META_ADS_TOKEN || "";
// aceita tanto "act_123" quanto "123" no env (é o erro de digitação mais comum)
const CONTA = (process.env.META_ADS_ACCOUNT_ID || "").trim().replace(/^act_/i, "");

export function metaAdsConfigurado(): boolean {
  return !!(TOKEN && CONTA);
}

export type GastoAnuncios = {
  configurado: boolean;
  centavos: number;
  /** moeda que a conta devolveu; se não for BRL o número não é em reais */
  moeda: string | null;
  /** mensagem pro admin quando não deu pra buscar (null = ok) */
  erro: string | null;
  /** janela realmente consultada, pra legenda do card (ex: "05/07 a 04/08") */
  janela: string | null;
};

// o dia precisa ser o do Brasil, senão o servidor em UTC vira o dia às 21h
const fmtDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // -> "2026-08-04"
const fmtCurto = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
});

const DIA_MS = 86_400_000;

// cache curtinho: a página é force-dynamic e o admin fica dando F5. A Meta tem
// limite de chamadas por hora, então não vale bater a cada refresh.
let cache: { chave: string; valor: GastoAnuncios; em: number } | null = null;

function semConfig(): GastoAnuncios {
  return { configurado: false, centavos: 0, moeda: null, erro: null, janela: null };
}

/**
 * Gasto do período em CENTAVOS de R$. `nDias` é o mesmo número de dias que a
 * página de Finanças desenha no gráfico (1 = só hoje), então o card sempre bate
 * com o filtro que o admin escolheu.
 *
 * ARMADILHA: a Meta só aceita janela em dias inteiros e interpreta as datas no
 * fuso da CONTA DE ANÚNCIOS, não no nosso. A conta da BM Viraliza está em
 * America/Los_Angeles (o fuso é escolhido na criação e não dá pra trocar
 * depois), então o dia dela vira ~4h depois do dia de Brasília. Montamos a
 * janela em horário de Brasília mesmo, pra casar com o resto da página, e
 * avisamos a diferença na legenda do card.
 */
export async function getGastoAnuncios(nDias: number): Promise<GastoAnuncios> {
  if (!metaAdsConfigurado()) return semConfig();

  const dias = Math.max(1, Math.floor(nDias) || 1);
  const agora = Date.now();
  const since = fmtDia.format(new Date(agora - (dias - 1) * DIA_MS));
  const until = fmtDia.format(new Date(agora));
  const janela =
    since === until
      ? fmtCurto.format(new Date(agora))
      : `${fmtCurto.format(new Date(agora - (dias - 1) * DIA_MS))} a ${fmtCurto.format(new Date(agora))}`;

  const chave = `${since}:${until}`;
  if (cache && cache.chave === chave && agora - cache.em < 5 * 60_000) return cache.valor;

  const falha = (erro: string): GastoAnuncios => ({
    configurado: true,
    centavos: 0,
    moeda: null,
    erro,
    janela,
  });

  const chamar = async (campos: string) => {
    const u = new URL(`${GRAPH}/act_${CONTA}/insights`);
    u.searchParams.set("fields", campos);
    u.searchParams.set("level", "account");
    u.searchParams.set("time_range", JSON.stringify({ since, until }));
    const r = await fetch(u, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return { r, j: await r.json().catch(() => null) };
  };

  try {
    let { r, j } = await chamar("spend,account_currency");
    // se a moeda for recusada por qualquer motivo, o gasto sozinho ainda serve:
    // melhor perder a checagem de moeda do que mostrar erro com o número em mãos
    if (!r.ok && r.status === 400) ({ r, j } = await chamar("spend"));

    if (!r.ok) {
      const codigo = j?.error?.code;
      const msg = String(j?.error?.message || `HTTP ${r.status}`);
      console.error("[meta-ads] insights falhou", r.status, codigo, msg.slice(0, 300));
      // 190 = token inválido/expirado; 100 = parâmetro errado (conta trocada);
      // 200/10 = o token não tem permissão de leitura nessa conta.
      if (codigo === 190) return falha("O token da Meta expirou ou foi revogado.");
      if (codigo === 200 || codigo === 10)
        return falha("O token não tem permissão de leitura nessa conta de anúncios.");
      if (codigo === 100) return falha("Conta de anúncios não encontrada (confira o ID no env).");
      if (r.status === 429 || codigo === 17 || codigo === 4)
        return falha("A Meta limitou as consultas agora. Tenta de novo em alguns minutos.");
      return falha("Não consegui buscar o gasto de anúncios agora.");
    }

    const linha = Array.isArray(j?.data) ? j.data[0] : null;
    // período sem veiculação volta lista vazia - isso é zero, não é erro
    const gasto = Number(linha?.spend ?? 0);
    const moeda = String(linha?.account_currency || "BRL").toUpperCase();

    const valor: GastoAnuncios = {
      configurado: true,
      centavos: Number.isFinite(gasto) ? Math.round(gasto * 100) : 0,
      moeda,
      erro: null,
      janela,
    };
    cache = { chave, valor, em: agora };
    return valor;
  } catch (e) {
    console.error("[meta-ads] erro de rede ao buscar insights", e);
    return falha("Não consegui falar com a Meta agora.");
  }
}
