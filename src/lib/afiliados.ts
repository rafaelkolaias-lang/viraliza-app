import "server-only";
import { listarPedidos, type PedidoLista } from "@/lib/cakto";
import { prisma } from "@/lib/prisma";

/**
 * Ranking do Indique e Ganhe.
 *
 * A Cakto não tem endpoint de afiliados (testado: /affiliates/, /commissions/ e
 * relatórios devolvem 404). O que existe é a comissão DENTRO de cada pedido:
 * toda venda traz um "producer" (o Lucas) e, quando veio de indicação, um
 * "affiliate" com o e-mail e a fatia de quem indicou. Então o ranking é montado
 * aqui, agrupando os pedidos pagos por e-mail do afiliado.
 *
 * Consultar a Cakto é lento (pagina de 100 em 100), e essa tela é aberta por
 * qualquer pessoa: por isso o resultado fica guardado por alguns minutos.
 */

export type Afiliado = {
  posicao: number;
  /** e-mail já mascarado: a tela é pública pra base inteira */
  apelido: string;
  vendas: number;
  comissaoCentavos: number;
};

export type MinhaVenda = {
  refId: string;
  quando: string;
  produto: string;
  comissaoCentavos: number;
  /** paid, refunded, chargedback... (reembolsada não vale comissão) */
  status: string;
};

export type MinhaAfiliacao = {
  /** e-mail que a gente procurou na Cakto (o mesmo da conta aqui) */
  email: string;
  vendas: MinhaVenda[];
  totalCentavos: number;
  posicao: number | null;
};

const CACHE_MS = 5 * 60_000;
let cache: { em: number; dias: number; lista: Afiliado[] } | null = null;

/**
 * A listagem da Cakto pagina de 100 em 100 e essa tela é aberta pela base toda:
 * sem cache, cada visita varreria 90 dias de pedidos. Guarda a lista crua por
 * alguns minutos e serve tanto o ranking quanto o histórico de cada pessoa.
 */
let cachePedidos: { em: number; dias: number; lista: PedidoLista[] } | null = null;

async function pedidosRecentes(dias: number): Promise<PedidoLista[]> {
  if (cachePedidos && cachePedidos.dias >= dias && Date.now() - cachePedidos.em < CACHE_MS) {
    return cachePedidos.lista;
  }
  const fim = new Date(Date.now() + 60_000).toISOString();
  const ini = new Date(Date.now() - dias * 86_400_000).toISOString();
  try {
    const lista = await listarPedidos(ini, fim);
    cachePedidos = { em: Date.now(), dias, lista };
    return lista;
  } catch {
    // Cakto fora do ar não pode derrubar a tela: usa o que tiver guardado
    return cachePedidos?.lista ?? [];
  }
}

/**
 * É comissão de indicação?
 *
 * A gente só tem certeza de um rótulo: "producer" é o dono do produto (o Lucas),
 * que aparece em toda venda. Qualquer OUTRA fatia da mesma venda é de quem
 * indicou. Testar pelo que NÃO é produtor deixa a tela funcionar mesmo que a
 * Cakto chame o afiliado de "affiliate", "afiliado" ou "coproducer" (ainda não
 * tivemos venda de afiliado pra confirmar o nome).
 */
function ehIndicacao(tipo: string) {
  return !!tipo && tipo !== "producer";
}

/**
 * Ajuste MANUAL por afiliado: venda real que veio SEM o link (a pessoa divulgou
 * o link errado, mas a venda foi dela). Como a Cakto não tem a comissão, o
 * ajuste soma aqui — no ranking e na tela da pessoa.
 *
 * Fica na tabela Configuracao, uma linha por e-mail:
 *   chave: afiliado_ajuste:<email>   valor: {"vendas":1,"centavos":4821}
 */
type AjusteAfiliado = { vendas: number; centavos: number };

async function ajustesManuais(): Promise<Map<string, AjusteAfiliado>> {
  const out = new Map<string, AjusteAfiliado>();
  try {
    const linhas = await prisma.configuracao.findMany({
      where: { chave: { startsWith: "afiliado_ajuste:" } },
    });
    for (const l of linhas) {
      const email = l.chave.slice("afiliado_ajuste:".length).trim().toLowerCase();
      try {
        const v = JSON.parse(l.valor) as AjusteAfiliado;
        const vendas = Math.max(0, Number(v?.vendas) || 0);
        const centavos = Math.max(0, Number(v?.centavos) || 0);
        if (email && (vendas || centavos)) out.set(email, { vendas, centavos });
      } catch {
        // valor torto não derruba o ranking
      }
    }
  } catch {
    // banco fora do ar: segue só com a Cakto
  }
  return out;
}

/** "marcosrogeriom92@gmail.com" -> "marcos•••@gmail.com" */
function mascarar(email: string): string {
  const [nome, dominio] = email.split("@");
  if (!nome || !dominio) return "afiliado";
  const visivel = nome.slice(0, Math.min(6, Math.max(2, nome.length - 3)));
  return `${visivel}•••@${dominio}`;
}

function ehPago(p: PedidoLista) {
  return p.status === "paid";
}

export async function rankingAfiliados(dias = 30, topN = 10): Promise<Afiliado[]> {
  if (cache && cache.dias === dias && Date.now() - cache.em < CACHE_MS) return cache.lista;

  const pedidos = await pedidosRecentes(Math.max(dias, 90));

  const por = new Map<string, { vendas: number; centavos: number }>();
  for (const p of pedidos) {
    if (!ehPago(p)) continue;
    const daIndicacao = (p.comissoes ?? []).filter((c) => ehIndicacao(c.tipo));
    if (!daIndicacao.length) continue;

    for (const c of daIndicacao) {
      // o e-mail não vem na comissão, vem na lista de comissionados: casa pelo
      // id quando dá, senão usa o primeiro que não seja o produtor
      const dono = (p.comissionados ?? []).find((u) => String(u.id ?? "") === (c.userId ?? ""));
      const email = (dono?.email ?? "").trim().toLowerCase();
      if (!email) continue;
      const atual = por.get(email) ?? { vendas: 0, centavos: 0 };
      atual.vendas += 1;
      atual.centavos += c.valorCentavos;
      por.set(email, atual);
    }
  }

  // vendas confirmadas fora do link entram por cima do que a Cakto conta
  for (const [email, aj] of await ajustesManuais()) {
    const atual = por.get(email) ?? { vendas: 0, centavos: 0 };
    atual.vendas += aj.vendas;
    atual.centavos += aj.centavos;
    por.set(email, atual);
  }

  const lista = [...por.entries()]
    .sort((a, b) => b[1].centavos - a[1].centavos)
    .slice(0, topN)
    .map(([email, v], i) => ({
      posicao: i + 1,
      apelido: mascarar(email),
      vendas: v.vendas,
      comissaoCentavos: v.centavos,
    }));

  cache = { em: Date.now(), dias, lista };
  return lista;
}

/**
 * As indicações DESTA pessoa. O casamento é pelo e-mail: a gente procura, nas
 * comissões de afiliado da Cakto, o mesmo e-mail que ela usa aqui. Quem se
 * afiliar com outro e-mail não aparece, e a tela avisa isso.
 */
export async function minhasIndicacoes(email: string, dias = 90): Promise<MinhaAfiliacao> {
  const alvo = email.trim().toLowerCase();
  const vazio: MinhaAfiliacao = { email: alvo, vendas: [], totalCentavos: 0, posicao: null };
  if (!alvo) return vazio;

  const pedidos = await pedidosRecentes(dias);

  const vendas: MinhaVenda[] = [];
  let total = 0;
  for (const p of pedidos) {
    const meu = (p.comissoes ?? []).find((c) => {
      if (!ehIndicacao(c.tipo)) return false;
      const dono = (p.comissionados ?? []).find((u) => String(u.id ?? "") === (c.userId ?? ""));
      return (dono?.email ?? "").trim().toLowerCase() === alvo;
    });
    if (!meu) continue;
    vendas.push({
      refId: p.refId ?? p.id,
      quando: p.created_at ?? "",
      produto: p.product?.name ?? "Viraliza",
      comissaoCentavos: meu.valorCentavos,
      status: p.status,
    });
    // reembolso e chargeback não entram no total: a Cakto estorna a comissão
    if (ehPago(p)) total += meu.valorCentavos;
  }

  // ajuste manual desta pessoa: aparece como venda normal no histórico dela
  const meuAjuste = (await ajustesManuais()).get(alvo);
  if (meuAjuste && meuAjuste.vendas > 0) {
    const cada = Math.round(meuAjuste.centavos / meuAjuste.vendas);
    for (let i = 0; i < meuAjuste.vendas; i++) {
      vendas.push({
        refId: `ajuste-${i + 1}`,
        quando: "",
        produto: "Viraliza (venda confirmada pelo suporte)",
        comissaoCentavos: cada,
        status: "paid",
      });
    }
    total += meuAjuste.centavos;
  }

  vendas.sort((a, b) => (a.quando < b.quando ? 1 : -1));
  const rank = await rankingAfiliados(30, 50);
  const eu = rank.find((r) => r.apelido === mascarar(alvo));
  return { email: alvo, vendas, totalCentavos: total, posicao: eu?.posicao ?? null };
}
