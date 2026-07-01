import "server-only";

import crypto from "node:crypto";

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
const WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN || "";

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
  customer?: { email?: string; full_name?: string };
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
  return (await res.json()) as KiwifySale;
}

/** Valor pago pelo cliente (centavos) = nº de créditos a conceder. */
export function creditosDaVenda(sale: KiwifySale): number {
  return Math.max(0, sale.payment?.charge_amount ?? sale.net_amount ?? 0);
}

const STATUS_PAGO = new Set(["paid", "approved", "authorized", "completed"]);
const STATUS_ESTORNO = new Set(["refunded", "chargedback", "chargeback", "refund"]);

export function vendaEstaPaga(sale: KiwifySale) {
  return STATUS_PAGO.has((sale.status || "").toLowerCase());
}
export function vendaEstornada(sale: KiwifySale) {
  return STATUS_ESTORNO.has((sale.status || "").toLowerCase());
}

/**
 * Validação (defesa extra) da assinatura do webhook: HMAC-SHA1 do corpo cru com o
 * token do webhook, comparado ao ?signature= da URL. Se não houver token/assinatura
 * configurados, não bloqueia (a segurança real é a confirmação na API da Kiwify).
 */
export function assinaturaValida(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_TOKEN || !signature) return true; // sem token -> confia na verificação por API
  const esperado = crypto
    .createHmac("sha1", WEBHOOK_TOKEN)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Extrai o id do pedido do payload do webhook (nomes variam entre eventos). */
export function orderIdDoPayload(body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  const cand =
    b.order_id ?? b.id ?? (b.Order as Record<string, unknown> | undefined)?.id ?? b.orderId;
  return cand ? String(cand) : "";
}
