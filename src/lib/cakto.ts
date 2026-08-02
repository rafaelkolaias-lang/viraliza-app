import "server-only";

/**
 * Integração com a Cakto (checkout) - migração da Kiwify. Mesmo modelo de
 * segurança: o webhook só nos avisa o pedido; a gente SEMPRE confirma o pedido na
 * API da Cakto (valor + status reais) antes de creditar, assim ninguém forja um
 * crédito. Isso é ainda mais importante aqui porque a Cakto não assina o webhook
 * (só manda um "secret" no corpo, que é fraco). 1 crédito = R$ 0,01, então os
 * créditos concedidos = valor pago em centavos (R$ 100 -> 10.000 créditos).
 *
 * Atenção: a Cakto devolve valores em REAIS decimais (ex.: "34.35"), diferente da
 * Kiwify que já vinha em centavos. Por isso convertemos tudo com reaisParaCentavos.
 */

const API = "https://api.cakto.com.br/public_api";

const CLIENT_ID = process.env.CAKTO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.CAKTO_CLIENT_SECRET || "";
const WEBHOOK_SECRET = process.env.CAKTO_WEBHOOK_SECRET || "";

export function caktoConfigurada() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

/** Converte valor da Cakto (reais, string "34.35" ou número) para centavos (Int). */
export function reaisParaCentavos(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// cache do token OAuth em memória (dura ~10h; renova com folga). A Cakto não tem
// endpoint de refresh: quando expira, pedimos um token novo.
let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${API}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Cakto OAuth falhou: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = (data.expires_in ?? 36_000) * 1000;
  tokenCache = { token: data.access_token, exp: Date.now() + ttl };
  return data.access_token;
}

/**
 * Pedido normalizado da Cakto. Mantém a MESMA forma da KiwifySale (id, status,
 * net_amount, payment.charge_amount, customer, product) de propósito, pra os
 * consumidores (reembolsos, Meta, webhook) trocarem de fonte com o mínimo de atrito.
 * Valores já em CENTAVOS.
 */
export type CaktoPedido = {
  id: string; // UUID do pedido (data.id) - é o que a API de consulta usa
  refId?: string; // id curto (data.refId), útil só pra log
  status: string; // "paid" | "refunded" | "chargedback" | "refund_requested" | ...
  net_amount?: number; // centavos líquidos (amount - fees)
  payment?: { charge_amount?: number }; // centavos que o cliente pagou (amount)
  customer?: { email?: string; full_name?: string; mobile?: string };
  product?: { id?: string; name?: string; type?: string }; // type: "subscription" | "unique"
};

type OrderApi = {
  id?: string;
  refId?: string;
  status?: string;
  amount?: string | number; // bruto pago pelo cliente (pode incluir taxa do comprador)
  baseAmount?: string | number; // preço do produto antes de taxas/desconto
  fees?: string | number; // taxa da Cakto
  commissions?: Array<{
    type?: string; // "producer" (você) ou "affiliate" (quem indicou)
    userId?: string | number;
    commissionPercentage?: number;
    commissionValue?: string | number;
  }>;
  commissionedUsers?: Array<{ id?: number; email?: string }>;
  paymentMethod?: string;
  createdAt?: string;
  paidAt?: string | null;
  refundedAt?: string | null;
  chargedbackAt?: string | null;
  canceledAt?: string | null;
  customer?: { name?: string; email?: string; phone?: string };
  product?: { id?: string; name?: string; type?: string };
  error?: string;
  detail?: string;
};

/**
 * Líquido REAL que a conta recebe (em centavos). A Cakto informa isso na comissão
 * do produtor (`commissions[].commissionValue`) - é o número do "Valor líquido" do
 * painel. NÃO é `amount - fees`, porque o `amount` pode trazer uma taxa que o
 * comprador paga por cima. Fallback (se não vier comissão): bruto - taxa.
 */
function liquidoCentavos(o: OrderApi): number {
  const coms = o.commissions;
  if (Array.isArray(coms) && coms.length) {
    const doProdutor = coms
      .filter((c) => (c?.type || "").toLowerCase() === "producer")
      .reduce((soma, c) => soma + reaisParaCentavos(c?.commissionValue), 0);
    if (doProdutor > 0) return doProdutor;
  }
  const bruto = reaisParaCentavos(o.amount);
  const taxa = reaisParaCentavos(o.fees);
  return Math.max(0, bruto - taxa);
}

/** Normaliza o objeto cru da API da Cakto para o nosso CaktoPedido (em centavos). */
function normalizarPedido(o: OrderApi): CaktoPedido {
  const bruto = reaisParaCentavos(o.amount);
  return {
    id: String(o.id ?? ""),
    refId: o.refId,
    status: (o.status || "").toLowerCase(),
    payment: { charge_amount: bruto },
    net_amount: liquidoCentavos(o),
    customer: {
      email: o.customer?.email,
      full_name: o.customer?.name,
      mobile: o.customer?.phone,
    },
    product: { id: o.product?.id, name: o.product?.name, type: o.product?.type },
  };
}

/** Busca o pedido por id (UUID) na API da Cakto (fonte da verdade). null se não achar. */
export async function buscarPedido(orderId: string): Promise<CaktoPedido | null> {
  const token = await getToken();
  const res = await fetch(`${API}/orders/${encodeURIComponent(orderId)}/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cakto orders/${orderId} falhou: ${res.status}`);
  const data = (await res.json()) as OrderApi;
  if (!data || data.error || data.detail || (!data.id && !data.status)) return null;
  return normalizarPedido(data);
}

// Só os PACOTES DE CRÉDITO creditam. Na Cakto eles se chamam "Viraliza N Créditos"
// (ex.: "Viraliza 10.000 Créditos" -> 10.000 créditos, que bate com R$ 100,00
// pago). A regex casa o número que vem antes da palavra "créditos". Os planos de
// entrada ("Viraliza - Editor automático & 20.000 produtos virais") e outros
// produtos NÃO casam (o número deles não é seguido de "créditos") e não creditam.
const PACOTE_RE = /([\d.]+)\s*cr[eé]ditos?/i;

/** Créditos que o pedido concede (0 se não for um pacote de crédito). */
export function creditosDoPacote(pedido: CaktoPedido): number {
  const m = (pedido.product?.name || "").match(PACOTE_RE);
  if (!m) return 0;
  const n = parseInt(m[1].replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Status da Cakto (ver docs.cakto.com.br). PAGO só quando "paid" (definitivo);
// "authorized" é pré-autorização de cartão e não garante liquidação.
const STATUS_PAGO = new Set(["paid"]);
const STATUS_ESTORNO = new Set(["refunded", "refund"]);
const STATUS_CHARGEBACK = new Set(["chargedback", "chargeback"]);
// reembolso PEDIDO mas ainda não decidido -> congela o saldo até a decisão.
const STATUS_SOLICITADO = new Set(["refund_requested", "refund_pending"]);

export function pedidoEstaPago(p: CaktoPedido) {
  return STATUS_PAGO.has((p.status || "").toLowerCase());
}
export function pedidoEstornado(p: CaktoPedido) {
  return STATUS_ESTORNO.has((p.status || "").toLowerCase());
}
export function pedidoChargeback(p: CaktoPedido) {
  return STATUS_CHARGEBACK.has((p.status || "").toLowerCase());
}
/** Reembolso foi SOLICITADO (em análise)? Não é o reembolso efetivado. */
export function statusReembolsoSolicitado(status: string) {
  const s = (status || "").toLowerCase();
  if (STATUS_SOLICITADO.has(s)) return true;
  // fallback: qualquer status que fale de refund e não seja o estorno final
  return s.includes("refund") && !STATUS_ESTORNO.has(s);
}

// ---- Listagem de pedidos (pro painel de finanças e rede de segurança) ----
// A API aceita filtros de data por campo com operadores __gte/__lte e paginação.
export type PedidoLista = {
  id: string;
  refId?: string;
  status: string;
  payment_method?: string;
  net_amount?: number; // centavos líquidos (o que cai pra você)
  charge_amount?: number; // centavos brutos (o que o cliente pagou)
  created_at?: string;
  updated_at?: string; // quando mudou de status (reembolso/chargeback/cancelamento)
  product?: { id?: string; name?: string };
  customer?: { name?: string; full_name?: string; email?: string; mobile?: string };
  /**
   * Quem ganhou o quê nessa venda. Sempre tem o "producer" (você); quando a
   * venda veio de um afiliado, entra também um "affiliate" com a fatia dele.
   * É por aqui que o Indique e Ganhe sabe de quem foi a indicação.
   */
  comissoes?: { tipo: string; userId?: string; percentual?: number; valorCentavos: number }[];
  comissionados?: { id?: number; email?: string }[];
};

function normalizarLista(o: OrderApi): PedidoLista {
  const bruto = reaisParaCentavos(o.amount);
  return {
    id: String(o.id ?? ""),
    refId: o.refId,
    status: (o.status || "").toLowerCase(),
    payment_method: o.paymentMethod,
    charge_amount: bruto,
    net_amount: liquidoCentavos(o),
    created_at: o.createdAt,
    updated_at:
      o.refundedAt || o.chargedbackAt || o.canceledAt || o.paidAt || o.createdAt || undefined,
    product: { id: o.product?.id, name: o.product?.name },
    customer: {
      name: o.customer?.name,
      full_name: o.customer?.name,
      email: o.customer?.email,
      mobile: o.customer?.phone,
    },
    comissoes: (o.commissions ?? []).map((c) => ({
      tipo: String(c.type ?? "").toLowerCase(),
      userId: c.userId != null ? String(c.userId) : undefined,
      percentual: typeof c.commissionPercentage === "number" ? c.commissionPercentage : undefined,
      valorCentavos: reaisParaCentavos(c.commissionValue),
    })),
    comissionados: o.commissionedUsers ?? [],
  };
}

/** Lista TODOS os pedidos criados num período (pagina sozinho). Datas em ISO/date. */
export async function listarPedidos(inicioISO: string, fimISO: string): Promise<PedidoLista[]> {
  const token = await getToken();
  const out: PedidoLista[] = [];
  const limite = 100;
  // teto de segurança: 50 páginas x 100 = 5.000 pedidos por consulta
  for (let page = 1; page <= 50; page++) {
    const url =
      `${API}/orders/?createdAt__gte=${encodeURIComponent(inicioISO)}` +
      `&createdAt__lte=${encodeURIComponent(fimISO)}&limit=${limite}&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Cakto orders list falhou: ${res.status}`);
    const data = (await res.json()) as { results?: OrderApi[]; next?: string | null };
    const lote = data.results ?? [];
    out.push(...lote.map(normalizarLista));
    if (!data.next || lote.length < limite) break; // última página
  }
  return out;
}

/** Confirma AO VIVO na Cakto se este e-mail tem uma compra PAGA nos últimos N dias.
 *  Serve de rede de segurança no cadastro quando o webhook atrasa ou falha. */
export async function emailComprou(
  email: string,
  diasAtras = 14,
): Promise<{ comprou: boolean; orderId?: string; produto?: string }> {
  const e = email.trim().toLowerCase();
  if (!e || !caktoConfigurada()) return { comprou: false };
  const ini = new Date(Date.now() - diasAtras * 86_400_000).toISOString();
  const fim = new Date(Date.now() + 60_000).toISOString();
  let pedidos: PedidoLista[];
  try {
    pedidos = await listarPedidos(ini, fim);
  } catch {
    return { comprou: false };
  }
  const v = pedidos.find(
    (p) => (p.customer?.email || "").toLowerCase() === e && STATUS_PAGO.has(p.status),
  );
  if (!v) return { comprou: false };
  return { comprou: true, orderId: v.id, produto: v.product?.name ?? undefined };
}

/** Valor do pedido (bruto pago pelo cliente) em centavos. */
export function valorPedido(v: PedidoLista): number {
  return v.charge_amount ?? v.net_amount ?? 0;
}
/** Valor líquido (o que cai pra você) em centavos. */
export function valorLiquido(v: PedidoLista): number {
  return v.net_amount ?? v.charge_amount ?? 0;
}

// ---- Webhook ----

/** Extrai o id (UUID) do pedido do payload do webhook: fica em data.id. */
export function orderIdDoPayload(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const data = (b.data ?? {}) as Record<string, unknown>;
  const cand = data.id ?? data.refId ?? b.id;
  return cand ? String(cand) : "";
}

/** Nome do evento do webhook (ex.: "purchase_approved", "refund", "chargeback"). */
export function eventoDoPayload(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  return b.event ? String(b.event) : "";
}

/**
 * Valida o webhook pelo "secret" que a Cakto manda no corpo. Se o secret não
 * estiver configurado no ambiente, não bloqueia (a confirmação real vem de buscar
 * o pedido na API); se estiver, exige que bata. A Cakto não usa assinatura HMAC.
 */
export function webhookSecretValido(body: unknown): boolean {
  if (!WEBHOOK_SECRET) return true;
  const b = (body ?? {}) as Record<string, unknown>;
  return String(b.secret ?? "") === WEBHOOK_SECRET;
}
