import "server-only";
import { createHash } from "crypto";

/**
 * API de Conversões da Meta (CAPI) - atribuição de vendas às campanhas.
 * Fase 1: manda a compra com email/telefone/nome HASHEADOS (sha256); a Meta
 * cruza com quem clicou no anúncio e atribui a venda à campanha no Ads Manager.
 * Uma falha aqui NUNCA pode quebrar o webhook da Kiwify - só loga e segue.
 */

const PIXEL_ID = process.env.META_PIXEL_ID || "";
const TOKEN = process.env.META_CAPI_TOKEN || "";
// opcional: código da aba "Eventos de teste" do Events Manager. Com ele setado,
// os eventos só aparecem lá (não contam de verdade) - usar pra validar e tirar.
const TEST_CODE = process.env.META_CAPI_TEST_CODE || "";

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaCapiConfigurada() {
  return !!(PIXEL_ID && TOKEN);
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Telefone BR normalizado pro padrão da Meta: só dígitos, com DDI 55. */
function hashTelefone(raw?: string | null): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length < 10) return null; // sem DDD não tem como dar match
  return sha256(d.startsWith("55") ? d : `55${d}`);
}

function hashEmail(raw?: string | null): string | null {
  const e = String(raw || "").trim().toLowerCase();
  return e.includes("@") ? sha256(e) : null;
}

type DadosVenda = {
  orderId: string;
  email?: string | null;
  telefone?: string | null;
  nome?: string | null;
  valorCentavos: number;
  produto?: string | null;
};

/** Compra confirmada na Kiwify -> evento Purchase no pixel. Idempotente na
 *  Meta via event_id = orderId (reenvios do webhook não duplicam). */
export function enviarCompraMeta(p: DadosVenda) {
  return enviarEventoVenda("Purchase", `kiwify_${p.orderId}`, p);
}

/** Reembolso/chargeback -> evento customizado "Refund" no pixel (não desconta
 *  das compras no Ads, mas fica visível como coluna personalizada). */
export function enviarReembolsoMeta(p: DadosVenda) {
  return enviarEventoVenda("Refund", `kiwify_refund_${p.orderId}`, p);
}

async function enviarEventoVenda(
  eventName: "Purchase" | "Refund",
  eventId: string,
  p: DadosVenda,
): Promise<void> {
  if (!metaCapiConfigurada()) return;

  const user_data: Record<string, string[]> = {};
  const em = hashEmail(p.email);
  const ph = hashTelefone(p.telefone);
  if (em) user_data.em = [em];
  if (ph) user_data.ph = [ph];
  // sem nenhum identificador não há match possível - nem manda
  if (!em && !ph) return;

  const nome = String(p.nome || "").trim();
  if (nome) {
    const partes = nome.split(/\s+/);
    user_data.fn = [sha256(partes[0].toLowerCase())];
    if (partes.length > 1) user_data.ln = [sha256(partes[partes.length - 1].toLowerCase())];
  }
  user_data.country = [sha256("br")];

  const evento = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: "website", // a compra acontece no checkout web da Kiwify
    user_data,
    custom_data: {
      currency: "BRL",
      value: p.valorCentavos / 100,
      order_id: p.orderId,
      ...(p.produto ? { content_name: p.produto } : {}),
    },
  };

  const body: Record<string, unknown> = { data: [evento] };
  if (TEST_CODE) body.test_event_code = TEST_CODE;

  try {
    const res = await fetch(`${GRAPH}/${PIXEL_ID}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[meta-capi] falha ao enviar ${eventName}`, p.orderId, res.status, txt.slice(0, 300));
      return;
    }
    console.log(`[meta-capi] ${eventName} enviado`, p.orderId, TEST_CODE ? "(teste)" : "");
  } catch (e) {
    console.error(`[meta-capi] erro de rede ao enviar ${eventName}`, p.orderId, e);
  }
}
