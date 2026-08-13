import "server-only";

import { prisma } from "@/lib/prisma";
import { debitarClamp, existeTransacaoOrder, lancar } from "@/lib/creditos";
import {
  buscarVenda,
  creditosDoPacote,
  kiwifyConfigurada,
  listarVendas,
  statusReembolsoSolicitado,
  vendaChargeback,
  vendaEstaPaga,
  vendaEstornada,
  type KiwifySale,
} from "@/lib/kiwify";
import {
  buscarPedido,
  caktoConfigurada,
  listarPedidos,
  pedidoEstaPago,
  pedidoEstornado,
  statusReembolsoSolicitado as statusReembolsoSolicitadoCakto,
} from "@/lib/cakto";
import { cancelarLiberacoesDoPedido } from "@/lib/liberacao-creditos";

/**
 * Regras de reembolso:
 * - SOLICITOU reembolso  -> suspende: zera o saldo e desliga a assinatura (a
 *   pessoa loga, mas vira "casca"). Guardamos o que foi congelado pra devolver.
 * - Reembolso CANCELADO  -> devolve tudo (saldo + assinatura) como estava.
 * - Reembolso ACEITO da PLATAFORMA (entrada R$19,90) -> perde os créditos de
 *   BRINDE (boas-vindas + mensais) e a assinatura em definitivo. Créditos
 *   COMPRADOS em pacote são preservados. Continua logando. O e-mail sai da
 *   allowlist (não cria conta nova sem pagar de novo).
 * - Reembolso ACEITO de PACOTE -> perde só os créditos daquele pacote;
 *   assinatura fica.
 * - CHARGEBACK -> tudo do reembolso aceito + BLOQUEIA o login.
 */

const parseInfo = (desc?: string | null): { assinanteAntes?: boolean; nivelAntes?: string } => {
  try {
    return JSON.parse(desc || "{}");
  } catch {
    return {};
  }
};

async function userPorEmail(email: string) {
  const e = (email || "").trim().toLowerCase();
  if (!e) return null;
  return prisma.user.findUnique({ where: { email: e } });
}

/** Total de créditos de BRINDE já recebidos (boas-vindas + mensais da assinatura).
 *  É o que se perde no reembolso da plataforma; crédito comprado fica. */
export async function totalBrinde(userId: string): Promise<number> {
  const r = await prisma.creditoTransacao.aggregate({
    where: {
      userId,
      valor: { gt: 0 },
      OR: [
        { tipo: "bonus_assinatura" },
        { tipo: "ajuste_admin", descricao: { startsWith: "Crédito de boas-vindas" } },
      ],
    },
    _sum: { valor: true },
  });
  return r._sum.valor ?? 0;
}

/** Reembolso SOLICITADO: congela o saldo inteiro e desliga a assinatura.
 *  Idempotente por pedido. Retorna true se suspendeu agora. */
export async function suspenderPorReembolso(email: string, orderId: string) {
  const user = await userPorEmail(email);
  if (!user) return false;
  if (await existeTransacaoOrder(orderId, "suspensao_reembolso")) return false;

  // O nível NÃO cai mais por reembolso: virou contagem de vídeo gerado, e pedir
  // dinheiro de volta não desfaz vídeo. Quem segura o antifraude aqui é o saldo
  // devedor (dividaCentavos), que trava a geração até ser quitado.
  const nivelAntes = "bronze";

  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: user.id },
      select: { saldoCentavos: true, assinante: true },
    });
    if (!u) return;
    await tx.user.update({
      where: { id: user.id },
      data: { saldoCentavos: 0, assinante: false },
    });
    await tx.creditoTransacao.create({
      data: {
        userId: user.id,
        tipo: "suspensao_reembolso",
        valor: -u.saldoCentavos,
        saldoApos: 0,
        descricao: JSON.stringify({
          m: "Reembolso solicitado na Kiwify: créditos congelados até a decisão",
          assinanteAntes: u.assinante,
          nivelAntes,
        }),
        kiwifyOrderId: orderId,
      },
    });
  });
  console.log("[reembolsos] suspenso por solicitação", orderId, user.email);
  return true;
}

/** Reembolso cancelado (voltou a "pago"): devolve saldo congelado + assinatura.
 *  Idempotente. Retorna true se restaurou agora. */
export async function restaurarSuspensao(orderId: string) {
  const susp = await prisma.creditoTransacao.findFirst({
    where: { kiwifyOrderId: orderId, tipo: "suspensao_reembolso" },
  });
  if (!susp) return false;
  // userId nulo = a conta foi excluída depois da suspensão (auditoria #14): a
  // transação continua no histórico, mas não há mais saldo pra devolver
  const donoId = susp.userId;
  if (!donoId) return false;
  if (await existeTransacaoOrder(orderId, "reversao_suspensao")) return false;

  const info = parseInfo(susp.descricao);
  const devolver = Math.abs(susp.valor);
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: donoId },
      select: { saldoCentavos: true },
    });
    if (!u) return;
    const saldoApos = u.saldoCentavos + devolver;
    await tx.user.update({
      where: { id: donoId },
      data: { saldoCentavos: saldoApos, assinante: info.assinanteAntes ?? true },
    });
    await tx.creditoTransacao.create({
      data: {
        userId: donoId,
        tipo: "reversao_suspensao",
        valor: devolver,
        saldoApos,
        descricao: "Reembolso cancelado: créditos e assinatura devolvidos",
        kiwifyOrderId: orderId,
      },
    });
  });
  console.log("[reembolsos] suspensão revertida", orderId);
  return true;
}

/** Reembolso ACEITO (ou chargeback): aplica a perda em definitivo.
 *  Idempotente por pedido (marca "estorno"). */
export async function aplicarReembolsoAceito(sale: KiwifySale, orderId: string) {
  const email = (sale.customer?.email || "").trim().toLowerCase();
  const chargeback = vendaChargeback(sale);
  const creditosPacote = creditosDoPacote(sale);

  // entrada reembolsada -> e-mail sai da allowlist (não cadastra de novo sem pagar)
  if (email && creditosPacote <= 0) {
    await prisma.acessoPago.deleteMany({ where: { email } });
  }

  const user = email ? await userPorEmail(email) : null;
  if (!user) {
    // nunca criou conta: só invalida crédito pendente daquele pedido
    await prisma.creditoPendente.updateMany({
      where: { kiwifyOrderId: orderId, aplicado: false },
      data: { aplicado: true, descricao: "cancelado por estorno" },
    });
    return { ok: true, semConta: true };
  }

  if (await existeTransacaoOrder(orderId, "estorno")) {
    return { ok: true, jaProcessado: true };
  }

  // se estava suspenso por este pedido, primeiro devolve tudo (aí o débito
  // definitivo abaixo tira só o que a regra manda, preservando o resto)
  await restaurarSuspensao(orderId);

  let debitado = 0;
  if (creditosPacote > 0) {
    // reembolso de PACOTE: perde os créditos daquele pacote.
    // 1) o que ainda estava PRESO na quarentena deste pedido nunca chegou a
    //    entrar no saldo - cancelar já "devolve" essa parte.
    const canceladoPreso = await cancelarLiberacoesDoPedido(orderId);
    const restante = Math.max(0, creditosPacote - canceladoPreso);
    // 2) do que entrou, tira o que ainda houver no saldo
    debitado =
      restante > 0
        ? await debitarClamp(user.id, restante, "estorno", {
            descricao: `Estorno: ${sale.product?.name || "pacote de créditos"}`,
            kiwifyOrderId: orderId,
          })
        : 0;
    if (debitado === 0) {
      // marcador de idempotência mesmo sem saldo a debitar
      await lancar(user.id, 0, "estorno", {
        descricao: `Estorno: ${sale.product?.name || "pacote de créditos"} (crédito preso cancelado)`,
        kiwifyOrderId: orderId,
      });
    }
    // 3) o que já foi GASTO e não deu pra recuperar vira saldo devedor: a conta
    //    trava pra gerar até a pessoa comprar de novo (a compra quita primeiro).
    const falta = restante - debitado;
    if (falta > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { dividaCentavos: { increment: falta } },
      });
      console.log("[reembolsos] saldo devedor lançado", orderId, user.email, falta);
    }
  } else {
    // reembolso da PLATAFORMA (entrada): perde os créditos de brinde + assinatura
    const brinde = await totalBrinde(user.id);
    debitado = brinde > 0
      ? await debitarClamp(user.id, brinde, "estorno", {
          descricao: "Reembolso da plataforma: créditos de brinde removidos",
          kiwifyOrderId: orderId,
        })
      : 0;
    if (debitado === 0) {
      // deixa o marcador de idempotência mesmo sem saldo a debitar
      await lancar(user.id, 0, "estorno", {
        descricao: "Reembolso da plataforma (sem saldo de brinde a remover)",
        kiwifyOrderId: orderId,
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { assinante: false },
    });
  }

  if (chargeback) {
    // contestação no cartão: bloqueia o login (derruba a sessão também)
    await prisma.user.update({
      where: { id: user.id },
      data: { bloqueado: true },
    });
  }

  console.log(
    "[reembolsos] aplicado",
    orderId,
    chargeback ? "(chargeback: bloqueado)" : "",
    "debitado:", debitado,
  );
  return { ok: true, debitado, chargeback };
}

// ---------------------------------------------------------------------------
// Varredura periódica: a Kiwify NÃO manda webhook de "reembolso solicitado",
// então de tempos em tempos a gente confere as vendas recentes na API.
// ---------------------------------------------------------------------------

const DIA_MS = 86_400_000;
const STATUS_CONHECIDOS = new Set([
  "paid", "approved", "authorized", "completed",
  "waiting_payment", "refused", "refunded", "chargedback", "chargeback",
  "refund", "canceled", "cancelled", "expired",
]);

export async function verificarReembolsos() {
  if (!kiwifyConfigurada()) return;
  const ini = new Date(Date.now() - 30 * DIA_MS).toISOString();
  const fim = new Date(Date.now() + 60_000).toISOString();
  let vendas;
  try {
    vendas = await listarVendas(ini, fim);
  } catch (e) {
    console.error("[reembolsos] falha ao listar vendas", e);
    return;
  }

  for (const v of vendas) {
    const st = (v.status || "").toLowerCase();
    const email = (v.customer?.email || "").trim().toLowerCase();
    try {
      if (statusReembolsoSolicitado(st)) {
        if (!STATUS_CONHECIDOS.has(st)) {
          console.log("[reembolsos] status de solicitação detectado:", st, v.id);
        }
        await suspenderPorReembolso(email, v.id);
        continue;
      }
      if (vendaEstaPaga({ id: v.id, status: v.status })) {
        // pedido pago que tinha suspensão pendente -> reembolso foi cancelado
        await restaurarSuspensao(v.id);
        continue;
      }
      if (vendaEstornada({ id: v.id, status: v.status })) {
        // rede de segurança: se o webhook do estorno falhou, aplica por aqui
        // (busca a venda completa pra ter produto/valores confiáveis)
        if (!(await existeTransacaoOrder(v.id, "estorno"))) {
          const sale = await buscarVenda(v.id);
          if (sale) await aplicarReembolsoAceito(sale, v.id);
        }
        continue;
      }
      if (!STATUS_CONHECIDOS.has(st)) {
        console.log("[reembolsos] status desconhecido (ignorado):", st, v.id);
      }
    } catch (e) {
      console.error("[reembolsos] erro processando venda", v.id, e);
    }
  }
}

// ---------------------------------------------------------------------------
// Mesma varredura, agora na Cakto: a Cakto tem o status "refund_requested" mas
// NÃO manda webhook desse estado, então conferimos periodicamente pra congelar o
// saldo enquanto o reembolso está em análise (e restaurar se for cancelado).
// ---------------------------------------------------------------------------

const STATUS_CAKTO_CONHECIDOS = new Set([
  "paid", "authorized", "processing", "waiting_payment", "refused",
  "refunded", "refund", "refund_requested", "chargedback", "chargeback",
  "canceled", "cancelled", "expired", "in_protest", "prechargeback",
  "partially_paid", "scheduled", "retrying", "blocked", "med",
]);

export async function verificarReembolsosCakto() {
  if (!caktoConfigurada()) return;
  const ini = new Date(Date.now() - 30 * DIA_MS).toISOString();
  const fim = new Date(Date.now() + 60_000).toISOString();
  let pedidos;
  try {
    pedidos = await listarPedidos(ini, fim);
  } catch (e) {
    console.error("[reembolsos] falha ao listar pedidos Cakto", e);
    return;
  }

  for (const p of pedidos) {
    const st = (p.status || "").toLowerCase();
    const email = (p.customer?.email || "").trim().toLowerCase();
    try {
      if (statusReembolsoSolicitadoCakto(st)) {
        await suspenderPorReembolso(email, p.id);
        continue;
      }
      if (pedidoEstaPago({ id: p.id, status: p.status })) {
        // pedido pago que tinha suspensão pendente -> reembolso foi cancelado
        await restaurarSuspensao(p.id);
        continue;
      }
      if (pedidoEstornado({ id: p.id, status: p.status })) {
        // rede de segurança: se o webhook do estorno falhou, aplica por aqui
        if (!(await existeTransacaoOrder(p.id, "estorno"))) {
          const ped = await buscarPedido(p.id);
          if (ped) await aplicarReembolsoAceito(ped, p.id);
        }
        continue;
      }
      if (!STATUS_CAKTO_CONHECIDOS.has(st)) {
        console.log("[reembolsos] status Cakto desconhecido (ignorado):", st, p.id);
      }
    } catch (e) {
      console.error("[reembolsos] erro processando pedido Cakto", p.id, e);
    }
  }
}
