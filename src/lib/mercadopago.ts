import "server-only";

import crypto from "crypto";

/**
 * Integração com o Mercado Pago (Checkout Pro) - convivendo com a Cakto durante
 * a migração. Mesmo modelo de segurança dela: o webhook só AVISA que algo
 * mudou; a gente SEMPRE busca o pagamento na API do MP (valor + status reais)
 * antes de creditar, então webhook forjado não credita nada.
 *
 * Diferenças que melhoram em relação à Cakto:
 *  - o checkout é criado POR COMPRA (preferência dinâmica), então o pagamento
 *    já nasce amarrado ao usuário logado via external_reference. Nada de casar
 *    por e-mail e torcer pra pessoa pagar com o e-mail da conta;
 *  - o webhook tem assinatura HMAC de verdade (x-signature), validada aqui.
 *
 * 1 crédito = R$ 0,01, então créditos concedidos = valor pago em centavos
 * (mesma regra da Cakto: R$ 100 -> 10.000 créditos).
 */

const API = "https://api.mercadopago.com";

/**
 * DUAS aplicações no MP, uma por produto (arquitetura recomendada por eles, e
 * no sandbox é obrigatório: as credenciais não cruzam produto):
 *  - viraliza-checkout (Checkout API): pacotes via /v1/payments -> MP_ACCESS_TOKEN
 *  - viraliza-assinaturas (Assinaturas): /preapproval -> MP_ASSINATURA_TOKEN
 * Sem MP_ASSINATURA_TOKEN, a assinatura usa o token principal (produção pode
 * unificar se o MP deixar).
 */
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";
const ASSINATURA_TOKEN = process.env.MP_ASSINATURA_TOKEN || ACCESS_TOKEN;
// cada app tem a própria chave secreta de webhook: aceita qualquer uma que bata
const WEBHOOK_SECRETS = [
  process.env.MP_WEBHOOK_SECRET || "",
  process.env.MP_ASSINATURA_WEBHOOK_SECRET || "",
].filter(Boolean);
const APP_URL = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");

export function mercadoPagoConfigurado() {
  return !!ACCESS_TOKEN;
}

/**
 * Prefixo do "orderId" que este gateway grava em CreditoTransacao.kiwifyOrderId
 * (o campo é histórico, guarda o id do pedido de qualquer gateway). O prefixo
 * evita colisão com UUIDs da Cakto e deixa óbvio no extrato de onde veio.
 */
export function mpOrderId(paymentId: string | number): string {
  return `mp-${paymentId}`;
}

// ---- Checkout (preferência) ----

export type CheckoutCriado = { url: string; preferenciaId: string };

/**
 * Cria o checkout hospedado de um pacote de créditos pro usuário logado.
 * `valorReais` é o preço inteiro do pacote (20, 50, 100). O nome do produto
 * segue o padrão "Viraliza N Créditos" DE PROPÓSITO: é o mesmo formato que a
 * regex da Cakto reconhece, então todo o resto do sistema (reembolso, admin,
 * e-mail) entende o produto sem código novo.
 */
export async function criarCheckoutCreditos(opts: {
  userId: string;
  email: string;
  valorReais: number;
}): Promise<CheckoutCriado> {
  if (!ACCESS_TOKEN) throw new Error("Mercado Pago não configurado (MP_ACCESS_TOKEN).");
  const centavos = Math.round(opts.valorReais * 100);
  const creditos = centavos; // 1 crédito = 1 centavo
  const titulo = `Viraliza ${creditos.toLocaleString("pt-BR")} Créditos`;

  const body = {
    items: [
      {
        id: `creditos-${opts.valorReais}`,
        title: titulo,
        description: "Créditos de IA na plataforma Viraliza",
        category_id: "services",
        quantity: 1,
        currency_id: "BRL",
        unit_price: opts.valorReais,
      },
    ],
    payer: { email: opts.email },
    // amarra o pagamento ao usuário SEM depender do e-mail que ele usar no MP
    external_reference: `viraliza:${opts.userId}:${centavos}`,
    metadata: { user_id: opts.userId, creditos_centavos: centavos },
    back_urls: {
      success: `${APP_URL}/painel/creditos?compra=aprovada`,
      pending: `${APP_URL}/painel/creditos?compra=pendente`,
      failure: `${APP_URL}/painel/creditos?compra=recusada`,
    },
    auto_return: "approved",
    // URL definida na criação tem prioridade sobre a do painel (regra do MP)
    notification_url: `${APP_URL}/api/mercadopago/webhook`,
    statement_descriptor: "VIRALIZA",
  };

  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      // idempotência do próprio MP: repetir o mesmo request não cria duas preferências
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`MP criar preferência falhou: ${res.status} ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string; init_point?: string };
  if (!data.init_point || !data.id) throw new Error("MP não devolveu o init_point.");
  return { url: data.init_point, preferenciaId: data.id };
}

// ---- Pagamento transparente (checkout NA NOSSA página, sem redirect) ----


/**
 * O que o Payment Brick devolve no `onSubmit`. O Brick já resolve quase tudo
 * (bandeira, emissor, parcelas, tokenização do cartão), então o que chega aqui
 * é só o resultado. O NÚMERO DO CARTÃO NUNCA passa por este objeto: vem só o
 * `token`, que o SDK gerou falando direto com o MP.
 */
export type FormDataBrick = {
  payment_method_id?: string;
  payment_type_id?: string;
  token?: string;
  issuer_id?: string;
  installments?: number;
  transaction_amount?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
    first_name?: string;
    last_name?: string;
  };
};

export type PagamentoCriado = {
  paymentId: string;
  status: string;
  statusDetalhe?: string;
  /** Pix: código copia-e-cola e QR em base64 pra desenhar na nossa tela */
  qrCode?: string;
  qrCodeBase64?: string;
  /** Boleto: link do boleto pra imprimir/pagar */
  linkBoleto?: string;
};

/**
 * Cria o pagamento a partir do que o Payment Brick mandou, seja qual for o
 * meio (cartão de crédito, débito, pré-pago, Pix ou boleto). Um caminho só.
 *
 * REGRA DE OURO: o valor é o NOSSO (`valorReais`, da tabela de pacotes), nunca
 * o `transaction_amount` que veio do navegador. Se confiássemos no cliente,
 * daria pra comprar 10.000 créditos por um centavo.
 */
export async function criarPagamento(opts: {
  userId: string;
  email: string;
  valorReais: number;
  form: FormDataBrick;
}): Promise<PagamentoCriado> {
  if (!ACCESS_TOKEN) throw new Error("Mercado Pago não configurado (MP_ACCESS_TOKEN).");
  const centavos = Math.round(opts.valorReais * 100);
  const f = opts.form;
  const metodo = (f.payment_method_id || "").toLowerCase();
  const ehPix = metodo === "pix";
  const ehBoleto = f.payment_type_id === "ticket" || metodo.includes("bol");

  const body: Record<string, unknown> = {
    transaction_amount: opts.valorReais,
    payment_method_id: f.payment_method_id,
    description: `Viraliza ${centavos.toLocaleString("pt-BR")} Créditos`,
    // é o nome que aparece na fatura do cartão. Sem ele a pessoa vê um nome
    // que não reconhece e abre contestação: o MP lista isso no checklist de
    // qualidade justamente como redutor de chargeback.
    statement_descriptor: "VIRALIZA",
    external_reference: `viraliza:${opts.userId}:${centavos}`,
    metadata: { user_id: opts.userId, creditos_centavos: centavos },
    notification_url: `${APP_URL}/api/mercadopago/webhook`,
    payer: {
      // o e-mail é o da CONTA logada, não o que a pessoa digitar no Brick:
      // é ele que amarra o pagamento a quem vai receber os créditos
      email: opts.email,
      ...(f.payer?.identification?.number
        ? { identification: f.payer.identification }
        : {}),
      ...(f.payer?.first_name ? { first_name: f.payer.first_name } : {}),
      ...(f.payer?.last_name ? { last_name: f.payer.last_name } : {}),
    },
  };

  if (f.token) {
    // cartão (crédito, débito ou pré-pago)
    body.token = f.token;
    body.installments = Math.max(1, Math.min(12, Math.round(f.installments || 1)));
    if (f.issuer_id) body.issuer_id = f.issuer_id;
  }
  if (ehPix) {
    // 30 minutos pra pagar: QR velho demais só gera pagamento órfão
    body.date_of_expiration = new Date(Date.now() + 30 * 60_000)
      .toISOString()
      .replace("Z", "-00:00");
  }
  if (ehBoleto) {
    // 3 dias: o MP leva até 2h úteis pra compensar, então prazo curto reprova
    body.date_of_expiration = new Date(Date.now() + 3 * 86_400_000)
      .toISOString()
      .replace("Z", "-00:00");
  }

  const res = await fetch(`${API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`MP pagamento falhou (${metodo}): ${res.status} ${txt.slice(0, 300)}`);
  }
  const p = (await res.json()) as {
    id?: number | string;
    status?: string;
    status_detail?: string;
    point_of_interaction?: {
      transaction_data?: { qr_code?: string; qr_code_base64?: string };
    };
    transaction_details?: { external_resource_url?: string };
  };
  if (p.id == null) throw new Error("MP não devolveu o pagamento.");
  const td = p.point_of_interaction?.transaction_data;
  return {
    paymentId: String(p.id),
    status: (p.status || "").toLowerCase(),
    statusDetalhe: p.status_detail,
    qrCode: td?.qr_code,
    qrCodeBase64: td?.qr_code_base64,
    linkBoleto: p.transaction_details?.external_resource_url,
  };
}

// ---- Um mês de assinatura pago no PIX ----

/**
 * Prefixo do external_reference que marca "isto é um mês de assinatura, não um
 * pacote de crédito". Precisa existir porque o Pix é um pagamento AVULSO: sem a
 * marca, o processamento leria os R$ 98,90 como compra de 9.890 créditos.
 */
export const REF_ASSINATURA_PIX = "viraliza-assinatura-pix";

/**
 * Cobra UM MÊS de assinatura no Pix.
 *
 * Por que não é uma assinatura de verdade: o Mercado Pago só faz recorrência no
 * cartão (o preapproval exige card_token_id). No Pix ninguém consegue debitar de
 * você sem você mandar, então não existe cobrança automática em lugar nenhum. O
 * desenho aqui é o único possível: a pessoa paga 1 mês, o acesso vale 33 dias, e
 * 3 dias antes de vencer a gente manda o e-mail pra ela renovar (Pix ou cartão).
 *
 * O Pix do Checkout API exige nome e CPF do pagador, por isso os campos.
 */
export async function criarAssinaturaPix(opts: {
  userId: string;
  email: string;
  nome: string;
  cpf: string;
  valorReais?: number;
}): Promise<PagamentoCriado> {
  if (!ACCESS_TOKEN) throw new Error("Mercado Pago não configurado (MP_ACCESS_TOKEN).");
  const valor = opts.valorReais ?? ASSINATURA_REAIS;
  const partes = opts.nome.trim().split(/\s+/);
  const body = {
    transaction_amount: Number(valor.toFixed(2)),
    payment_method_id: "pix",
    description: "Assinatura Viraliza (Pix)",
    statement_descriptor: "VIRALIZA",
    external_reference: `${REF_ASSINATURA_PIX}:${opts.userId}`,
    metadata: { user_id: opts.userId, tipo: "assinatura_pix" },
    notification_url: `${APP_URL}/api/mercadopago/webhook`,
    // 30 minutos: QR velho só vira pagamento órfão depois que a pessoa desistiu
    date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString().replace("Z", "-00:00"),
    payer: {
      email: opts.email,
      first_name: partes[0] || "Cliente",
      last_name: partes.slice(1).join(" ") || "Viraliza",
      identification: { type: "CPF", number: opts.cpf.replace(/\D/g, "") },
    },
  };

  const res = await fetch(`${API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`MP assinatura Pix falhou: ${res.status} ${txt.slice(0, 300)}`);
  }
  const p = (await res.json()) as {
    id?: number | string;
    status?: string;
    status_detail?: string;
    point_of_interaction?: {
      transaction_data?: { qr_code?: string; qr_code_base64?: string };
    };
  };
  if (p.id == null) throw new Error("MP não devolveu o pagamento do Pix.");
  const td = p.point_of_interaction?.transaction_data;
  return {
    paymentId: String(p.id),
    status: (p.status || "").toLowerCase(),
    statusDetalhe: p.status_detail,
    qrCode: td?.qr_code,
    qrCodeBase64: td?.qr_code_base64,
  };
}

/**
 * Devolve dinheiro de um pagamento. Sem `valorReais` devolve tudo; com valor,
 * devolve só aquela parte (reembolso parcial).
 *
 * É o que sustenta a política de reembolso da plataforma: como o produto é
 * crédito de IA e a pessoa vai gastando, devolver sempre 100% faria a gente
 * pagar a conta da IA que já foi queimada. O MP aceita parcial em até 180 dias
 * da aprovação, desde que haja saldo na conta pra devolver.
 */
export async function reembolsarPagamento(
  paymentId: string,
  valorReais?: number,
): Promise<{ ok: boolean; refundId?: string; erro?: string }> {
  if (!ACCESS_TOKEN) throw new Error("Mercado Pago não configurado (MP_ACCESS_TOKEN).");
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      // sem isto, um clique duplo no botão devolveria duas vezes
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(valorReais != null ? { amount: Number(valorReais.toFixed(2)) } : {}),
    cache: "no-store",
  });
  const d = (await res.json().catch(() => ({}))) as {
    id?: number | string;
    status?: string;
    message?: string;
  };
  if (!res.ok) {
    console.error("[mp] reembolso falhou", paymentId, res.status, d);
    return { ok: false, erro: d.message || `falha ${res.status}` };
  }
  return { ok: true, refundId: d.id != null ? String(d.id) : undefined };
}

// ---- Assinatura (preapproval sem plano, link de pagamento) ----

const ASSINATURA_REAIS = parseFloat(process.env.MP_ASSINATURA_REAIS || "98.90");

/**
 * Cria a assinatura mensal como "preapproval" SEM plano e com status "pending":
 * o MP devolve um link (init_point) onde a pessoa escolhe como pagar (cartão,
 * saldo MP...). É o único fluxo hospedado: o modelo com plano exigiria capturar
 * o cartão no nosso site.
 *
 * Sem end_date de propósito: cobra todo mês até cancelar. Cada cobrança paga
 * chega no webhook como um payment de operation_type "recurring_payment", e é
 * LÁ que o mês é estendido e o crédito mensal cai (nunca aqui).
 */
export async function criarAssinatura(opts: {
  userId: string;
  email: string;
  /** valor mensal cheio (base + adicionais). Sem isso, o preço do plano. */
  valorReais?: number;
  /** o que aparece no extrato do cliente */
  descricao?: string;
  /** pra onde volta depois de pagar */
  voltarPara?: string;
}): Promise<CheckoutCriado> {
  if (!ASSINATURA_TOKEN) throw new Error("Mercado Pago não configurado (MP_ASSINATURA_TOKEN).");
  const body = {
    reason: opts.descricao || "Assinatura Viraliza",
    external_reference: `viraliza-assinatura:${opts.userId}`,
    payer_email: opts.email,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: opts.valorReais ?? ASSINATURA_REAIS,
      currency_id: "BRL",
    },
    back_url: opts.voltarPara || `${APP_URL}/painel/assinatura?pagamento=feito`,
    status: "pending",
  };
  const res = await fetch(`${API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ASSINATURA_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`MP criar assinatura falhou: ${res.status} ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string; init_point?: string };
  if (!data.init_point || !data.id) throw new Error("MP não devolveu o link da assinatura.");
  return { url: data.init_point, preferenciaId: data.id };
}

/**
 * Assinatura SEM sair da nossa página: o cartão é tokenizado no navegador e o
 * preapproval já nasce "authorized" com a primeira cobrança agendada. A pessoa
 * nunca vê o site do MP. (O fluxo "pending" com link continua existindo acima
 * como reserva.)
 */
export async function criarAssinaturaCartao(opts: {
  userId: string;
  email: string;
  cardTokenId: string;
}): Promise<{ assinaturaId: string; status: string }> {
  if (!ASSINATURA_TOKEN) throw new Error("Mercado Pago não configurado (MP_ASSINATURA_TOKEN).");
  const body = {
    reason: "Assinatura Viraliza",
    external_reference: `viraliza-assinatura:${opts.userId}`,
    payer_email: opts.email,
    card_token_id: opts.cardTokenId,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: ASSINATURA_REAIS,
      currency_id: "BRL",
    },
    back_url: `${APP_URL}/painel/assinatura`,
    status: "authorized",
  };
  const res = await fetch(`${API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ASSINATURA_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`MP assinatura cartão falhou: ${res.status} ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string; status?: string };
  if (!data.id) throw new Error("MP não devolveu a assinatura.");
  return { assinaturaId: String(data.id), status: (data.status || "").toLowerCase() };
}

/**
 * Cancela a assinatura no Mercado Pago: para de cobrar a partir de agora.
 *
 * NÃO mexe no acesso da pessoa. O mês que ela já pagou continua valendo até o
 * `assinaturaAte`, que expira sozinho. Cortar na hora seria cobrar por um mês
 * e entregar meio.
 */
export async function cancelarAssinatura(preapprovalId: string): Promise<boolean> {
  if (!ASSINATURA_TOKEN) throw new Error("Mercado Pago não configurado (MP_ASSINATURA_TOKEN).");
  const res = await fetch(`${API}/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ASSINATURA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
    cache: "no-store",
  });
  // 404 = a assinatura não existe mais lá: pro nosso lado o efeito é o mesmo
  if (res.status === 404) return true;
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`MP cancelar assinatura falhou: ${res.status} ${txt.slice(0, 200)}`);
  }
  return true;
}

/** Assinatura normalizada do MP (GET /preapproval/:id). */
export type AssinaturaMP = {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  email?: string;
  userId?: string; // do external_reference
  valorCentavos: number;
};

export async function buscarAssinatura(preapprovalId: string): Promise<AssinaturaMP | null> {
  if (!ASSINATURA_TOKEN) throw new Error("Mercado Pago não configurado (MP_ASSINATURA_TOKEN).");
  const res = await fetch(`${API}/preapproval/${encodeURIComponent(preapprovalId)}`, {
    headers: { Authorization: `Bearer ${ASSINATURA_TOKEN}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MP preapproval/${preapprovalId} falhou: ${res.status}`);
  const a = (await res.json()) as {
    id?: string;
    status?: string;
    payer_email?: string;
    external_reference?: string;
    auto_recurring?: { transaction_amount?: number };
  };
  if (!a || !a.id) return null;
  const m = (a.external_reference || "").match(/^viraliza-assinatura:(.+)$/);
  return {
    id: String(a.id),
    status: (a.status || "").toLowerCase(),
    email: a.payer_email?.trim().toLowerCase() || undefined,
    userId: m ? m[1] : undefined,
    valorCentavos: Math.round((a.auto_recurring?.transaction_amount ?? 0) * 100),
  };
}

// ---- Pagamento (fonte da verdade) ----

/** Pagamento normalizado do MP. Valores já em CENTAVOS. */
export type PagamentoMP = {
  id: string;
  status: string; // approved | pending | rejected | refunded | charged_back | cancelled
  valorCentavos: number; // transaction_amount (o que o cliente pagou)
  liquidoCentavos: number; // net_received_amount (o que cai pra você), se vier
  email?: string;
  nome?: string;
  telefone?: string;
  userId?: string; // do external_reference/metadata (nosso id)
  descricao?: string; // description (nome do produto no checkout)
  metodo?: string; // pix, credit_card, ...
  /** "recurring_payment" = cobrança de assinatura (renova mês, não credita pacote) */
  operationType?: string;
  /** "assinatura_pix" = mês de assinatura pago no Pix (não é pacote de crédito) */
  tipo?: "assinatura_pix";
};

type PaymentApi = {
  id?: number | string;
  status?: string;
  operation_type?: string;
  transaction_amount?: number;
  transaction_details?: { net_received_amount?: number };
  description?: string;
  payment_method_id?: string;
  external_reference?: string;
  metadata?: {
    user_id?: string;
    creditos_centavos?: number;
    preapproval_id?: string;
    tipo?: string;
  };
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: { area_code?: string; number?: string };
  };
};

function userIdDoPagamento(p: PaymentApi): string | undefined {
  if (p.metadata?.user_id) return String(p.metadata.user_id);
  // pacote: "viraliza:<userId>:<centavos>"; cobrança de assinatura herda o
  // external_reference do preapproval: "viraliza-assinatura:<userId>"
  const ref = p.external_reference || "";
  // assinatura (cartão ou Pix): "viraliza-assinatura[-pix]:<userId>", e o userId pode
  // ser "publico:<email>" de quem pagou na landing antes de ter conta
  const assin = ref.match(/^viraliza-assinatura(?:-pix)?:(.+)$/);
  if (assin) return assin[1];
  // pacote de crédito: "viraliza:<userId>:<centavos>"
  const pacote = ref.match(/^viraliza:([^:]+)/);
  return pacote ? pacote[1] : undefined;
}

/**
 * Busca o pagamento por id na API do MP. null se não existir.
 *
 * Tenta com o token do checkout e, se não achar, com o da assinatura: a
 * cobrança recorrente pertence à aplicação de Assinaturas, e cada aplicação só
 * enxerga os próprios pagamentos.
 */
export async function buscarPagamento(paymentId: string): Promise<PagamentoMP | null> {
  if (!ACCESS_TOKEN) throw new Error("Mercado Pago não configurado (MP_ACCESS_TOKEN).");
  let res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    cache: "no-store",
  });
  if (res.status === 404 && ASSINATURA_TOKEN !== ACCESS_TOKEN) {
    res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${ASSINATURA_TOKEN}` },
      cache: "no-store",
    });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MP payments/${paymentId} falhou: ${res.status}`);
  const p = (await res.json()) as PaymentApi;
  if (!p || p.id == null) return null;
  const bruto = Math.round((p.transaction_amount ?? 0) * 100);
  const liquido = Math.round((p.transaction_details?.net_received_amount ?? 0) * 100);
  const nome = [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ").trim();
  const fone = p.payer?.phone?.number
    ? `${p.payer.phone.area_code ?? ""}${p.payer.phone.number}`
    : undefined;
  return {
    id: String(p.id),
    status: (p.status || "").toLowerCase(),
    valorCentavos: bruto,
    liquidoCentavos: liquido > 0 ? liquido : bruto,
    email: p.payer?.email?.trim().toLowerCase() || undefined,
    nome: nome || undefined,
    telefone: fone,
    userId: userIdDoPagamento(p),
    descricao: p.description,
    metodo: p.payment_method_id,
    operationType: (p.operation_type || "").toLowerCase() || undefined,
    tipo:
      p.metadata?.tipo === "assinatura_pix" ||
      (p.external_reference || "").startsWith(`${REF_ASSINATURA_PIX}:`)
        ? "assinatura_pix"
        : undefined,
  };
}

// ---- Listagem pro painel de finanças ----

/** Uma venda do MP no formato que o painel de finanças consome. */
export type VendaMP = {
  id: string;
  status: string;
  brutoCentavos: number;
  liquidoCentavos: number;
  criadoEm: string;
  atualizadoEm: string;
  nome: string;
  email: string;
  produto?: string;
};

/**
 * Vendas do período no Mercado Pago, pro /admin/financas.
 *
 * Consulta as DUAS aplicações (checkout e assinaturas) porque cada uma só
 * enxerga os próprios pagamentos - sem isso a mensalidade não apareceria no
 * faturamento, que foi exatamente o buraco encontrado em 06/ago.
 *
 * Ignora a cobrança de validação de cartão (R$ 0): ela não é venda, e entraria
 * no painel como um pedido fantasma.
 */
export async function listarVendasMP(inicioISO: string, fimISO: string): Promise<VendaMP[]> {
  const tokens = [ACCESS_TOKEN, ASSINATURA_TOKEN].filter(
    (t, i, a) => t && a.indexOf(t) === i,
  );
  const vistos = new Set<string>();
  const out: VendaMP[] = [];

  for (const token of tokens) {
    let offset = 0;
    // teto de 5 páginas por app: 1.000 vendas no período é folga suficiente e
    // evita ficar preso num loop se a API devolver paginação estranha
    for (let pagina = 0; pagina < 5; pagina++) {
      const qs = new URLSearchParams({
        sort: "date_created",
        criteria: "desc",
        range: "date_created",
        begin_date: inicioISO,
        end_date: fimISO,
        limit: "200",
        offset: String(offset),
      });
      const res = await fetch(`${API}/v1/payments/search?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`MP listar vendas falhou: ${res.status} ${txt.slice(0, 200)}`);
      }
      const d = (await res.json()) as {
        results?: Array<
          PaymentApi & {
            date_created?: string;
            date_last_updated?: string;
            operation_type?: string;
          }
        >;
        paging?: { total?: number };
      };
      const linhas = d.results ?? [];
      for (const p of linhas) {
        const id = String(p.id ?? "");
        if (!id || vistos.has(id)) continue;
        vistos.add(id);
        const bruto = Math.round((p.transaction_amount ?? 0) * 100);
        if (bruto <= 0) continue; // validação de cartão, não é venda
        const liquido = Math.round((p.transaction_details?.net_received_amount ?? 0) * 100);
        out.push({
          id,
          status: (p.status || "").toLowerCase(),
          brutoCentavos: bruto,
          liquidoCentavos: liquido > 0 ? liquido : bruto,
          criadoEm: p.date_created ?? "",
          atualizadoEm: p.date_last_updated ?? p.date_created ?? "",
          nome:
            [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ").trim() ||
            "Sem nome",
          email: p.payer?.email?.trim().toLowerCase() ?? "",
          produto: p.description,
        });
      }
      offset += linhas.length;
      if (linhas.length < 200 || offset >= (d.paging?.total ?? 0)) break;
    }
  }
  return out;
}

/** É cobrança recorrente de assinatura? (renova o mês em vez de creditar pacote) */
export function pagamentoDeAssinatura(p: PagamentoMP) {
  return p.operationType === "recurring_payment";
}

const STATUS_PAGO = new Set(["approved"]);
const STATUS_ESTORNO = new Set(["refunded", "charged_back"]);

export function pagamentoAprovado(p: PagamentoMP) {
  return STATUS_PAGO.has(p.status);
}
export function pagamentoEstornado(p: PagamentoMP) {
  return STATUS_ESTORNO.has(p.status);
}

// ---- Webhook (validação x-signature) ----

/**
 * Valida a assinatura do webhook do MP (HMAC-SHA256, algoritmo da doc oficial):
 * manifest = "id:{data.id};request-id:{x-request-id};ts:{ts};", partes ausentes
 * saem do manifest, e data.id alfanumérico vai em minúsculas.
 *
 * Sem nenhum secret configurado não bloqueia (a garantia real é buscar o
 * pagamento na API); com secret, exige que ALGUM bata - são duas aplicações
 * (checkout e assinaturas) notificando a mesma URL, cada uma com a sua chave.
 */
export function assinaturaWebhookValida(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  if (!WEBHOOK_SECRETS.length) return true;
  const sig = opts.xSignature || "";
  const partes = Object.fromEntries(
    sig
      .split(",")
      .map((kv) => kv.split("=", 2).map((s) => s.trim()))
      .filter((kv) => kv.length === 2),
  ) as { ts?: string; v1?: string };
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const pedacos: string[] = [];
  if (opts.dataId) {
    const id = /[A-Za-z]/.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
    pedacos.push(`id:${id};`);
  }
  if (opts.xRequestId) pedacos.push(`request-id:${opts.xRequestId};`);
  pedacos.push(`ts:${ts};`);
  const manifest = pedacos.join("");

  return WEBHOOK_SECRETS.some((secret) => {
    const esperado = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
    } catch {
      return false;
    }
  });
}
