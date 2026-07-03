import "server-only";

/**
 * Integração com a Kiwify (checkout). O webhook só nos avisa o pedido; a gente
 * SEMPRE confirma o pedido na API da Kiwify (valor + status reais) antes de
 * creditar - assim ninguém forja um crédito. 1 crédito = R$ 0,01, então os
 * créditos concedidos = valor pago em centavos (R$ 100 -> 10.000 créditos).
 */

const API = "https://public-api.kiwify.com/v1";

const CLIENT_ID = process.env.KIWIFY_CLIENT_ID || "";
const CLIENT_SECRET = process.env.KIWIFY_CLIENT_SECRET || "";
const ACCOUNT_ID = process.env.KIWIFY_ACCOUNT_ID || "";

export function kiwifyConfigurada() {
  return !!(CLIENT_ID && CLIENT_SECRET && ACCOUNT_ID);
}

// cache do token OAuth em memória (o JWT dura ~1h; renova com folga).
let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kiwify OAuth falhou: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = (data.expires_in ?? 3600) * 1000;
  tokenCache = { token: data.access_token, exp: Date.now() + ttl };
  return data.access_token;
}

export type KiwifySale = {
  id: string;
  status: string; // "paid" | "refunded" | ...
  net_amount?: number; // centavos (líquido)
  payment?: { charge_amount?: number }; // centavos (o que o cliente pagou)
  customer?: { email?: string; full_name?: string; mobile?: string };
  product?: { id?: string; name?: string };
};

/** Busca a venda por id na API da Kiwify (fonte da verdade). null se não achar. */
export async function buscarVenda(orderId: string): Promise<KiwifySale | null> {
  const token = await getToken();
  const res = await fetch(`${API}/sales/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-kiwify-account-id": ACCOUNT_ID,
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Kiwify sales/${orderId} falhou: ${res.status}`);
  const data = (await res.json()) as KiwifySale & { error?: string };
  // a Kiwify responde 200 com {"error": ...} pra id inexistente (não usa 404).
  // Sem id/status reais, tratamos como "pedido não encontrado".
  if (!data || data.error || (!data.id && !data.status)) return null;
  return data;
}

// Só os produtos "Editor automatico <número>" são PACOTES DE CRÉDITO. O número no
// nome é o tanto de créditos (ex.: "Editor automatico 10.000" -> 10.000 créditos,
// que bate com R$ 100,00 pago). Qualquer outro produto (o plano de entrada de
// R$ 19,90, "Copa 2026", etc.) NÃO credita nada.
const PACOTE_RE = /editor\s+autom[aá]tico\s+([\d.]+)/i;

/** Créditos que a venda concede (0 se não for um pacote de crédito). */
export function creditosDoPacote(sale: KiwifySale): number {
  const m = (sale.product?.name || "").match(PACOTE_RE);
  if (!m) return 0;
  const n = parseInt(m[1].replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const STATUS_PAGO = new Set(["paid", "approved", "authorized", "completed"]);
const STATUS_ESTORNO = new Set(["refunded", "chargedback", "chargeback", "refund"]);
const STATUS_CHARGEBACK = new Set(["chargedback", "chargeback"]);
// status que indicam reembolso PEDIDO mas ainda não decidido (nomes variam na
// Kiwify; casamos por convenção + fallback "tem refund no nome e não é final")
const STATUS_SOLICITADO = new Set([
  "refund_requested",
  "refund_pending",
  "waiting_refund",
  "refund_in_progress",
]);

export function vendaEstaPaga(sale: KiwifySale) {
  return STATUS_PAGO.has((sale.status || "").toLowerCase());
}
export function vendaEstornada(sale: KiwifySale) {
  return STATUS_ESTORNO.has((sale.status || "").toLowerCase());
}
export function vendaChargeback(sale: KiwifySale) {
  return STATUS_CHARGEBACK.has((sale.status || "").toLowerCase());
}
/** Reembolso foi SOLICITADO (em análise)? Não é o reembolso efetivado. */
export function statusReembolsoSolicitado(status: string) {
  const s = (status || "").toLowerCase();
  if (STATUS_SOLICITADO.has(s)) return true;
  return s.includes("refund") && !STATUS_ESTORNO.has(s);
}

// ---- Listagem de vendas (pro painel de finanças) ----
// A API exige start_date/end_date em ISO (com hora) e end_date > start_date.
export type VendaLista = {
  id: string;
  reference?: string;
  status: string; // "paid" | "waiting_payment" | "refunded" | ...
  payment_method?: string;
  net_amount?: number; // centavos líquidos (o que cai pra você)
  charge_amount?: number; // centavos brutos (o que o cliente pagou)
  created_at?: string;
  updated_at?: string; // quando mudou de status (ex: data do reembolso)
  product?: { id?: string; name?: string };
  customer?: { name?: string; full_name?: string; email?: string; mobile?: string };
};

/** Lista TODAS as vendas de um período (pagina sozinho). Datas em ISO. */
export async function listarVendas(inicioISO: string, fimISO: string): Promise<VendaLista[]> {
  const token = await getToken();
  const out: VendaLista[] = [];
  let page = 1;
  // teto de segurança: 50 páginas x 100 = 5.000 vendas por consulta
  for (; page <= 50; page++) {
    const url =
      `${API}/sales?start_date=${encodeURIComponent(inicioISO)}` +
      `&end_date=${encodeURIComponent(fimISO)}&page_size=100&page_number=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "x-kiwify-account-id": ACCOUNT_ID },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Kiwify sales list falhou: ${res.status}`);
    const data = (await res.json()) as { data?: VendaLista[]; pagination?: { count?: number } };
    const lote = data.data ?? [];
    out.push(...lote);
    if (lote.length < 100) break; // última página
  }
  return out;
}

/** Confirma AO VIVO na Kiwify se este e-mail tem uma compra PAGA nos últimos N dias.
 *  Serve de rede de segurança no cadastro quando o webhook atrasa ou falha. */
export async function emailComprou(
  email: string,
  diasAtras = 14,
): Promise<{ comprou: boolean; orderId?: string; produto?: string }> {
  const e = email.trim().toLowerCase();
  if (!e || !kiwifyConfigurada()) return { comprou: false };
  const ini = new Date(Date.now() - diasAtras * 86_400_000).toISOString();
  const fim = new Date(Date.now() + 60_000).toISOString();
  let vendas: VendaLista[];
  try {
    vendas = await listarVendas(ini, fim);
  } catch {
    return { comprou: false };
  }
  const v = vendas.find(
    (s) => (s.customer?.email || "").toLowerCase() === e && vendaEstaPaga(s),
  );
  if (!v) return { comprou: false };
  return { comprou: true, orderId: v.id, produto: v.product?.name ?? undefined };
}

/** Valor da venda (bruto pago pelo cliente) em centavos. */
export function valorVenda(v: VendaLista): number {
  return v.charge_amount ?? v.net_amount ?? 0;
}
/** Valor líquido (o que cai pra você) em centavos. */
export function valorLiquido(v: VendaLista): number {
  return v.net_amount ?? v.charge_amount ?? 0;
}

/** Extrai o id do pedido do payload do webhook (nomes variam entre eventos). */
export function orderIdDoPayload(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const cand =
    b.order_id ?? b.id ?? (b.Order as Record<string, unknown> | undefined)?.id ?? b.orderId;
  return cand ? String(cand) : "";
}
