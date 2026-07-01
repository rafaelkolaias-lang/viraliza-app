import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assinaturaValida,
  buscarVenda,
  creditosDaVenda,
  kiwifyConfigurada,
  orderIdDoPayload,
  vendaEstaPaga,
  vendaEstornada,
} from "@/lib/kiwify";
import {
  debitarClamp,
  estenderAssinatura,
  existeTransacaoOrder,
  lancar,
} from "@/lib/creditos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAS_ASSINATURA = 30;
const DIA_MS = 86_400_000;

/** Recua a assinatura (estorno): tira os dias e desmarca assinante se venceu. */
async function recuarAssinatura(userId: string, dias: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { assinaturaAte: true },
  });
  if (!u?.assinaturaAte) return;
  const ate = new Date(u.assinaturaAte.getTime() - dias * DIA_MS);
  await prisma.user.update({
    where: { id: userId },
    data: { assinaturaAte: ate, assinante: ate.getTime() > Date.now() },
  });
}

/**
 * Webhook da Kiwify. A Kiwify chama aqui quando algo acontece com um pedido; a
 * gente confirma o pedido NA API da Kiwify (valor + status reais) e credita o
 * usuário. Sempre responde 200 (senão a Kiwify fica reenviando pra sempre).
 * Idempotente por pedido: não credita/estorna duas vezes.
 */
export async function POST(req: Request) {
  if (!kiwifyConfigurada()) {
    return NextResponse.json({ erro: "Kiwify não configurada" }, { status: 503 });
  }

  const raw = await req.text();
  const signature = new URL(req.url).searchParams.get("signature");
  if (!assinaturaValida(raw, signature)) {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = JSON.parse(raw);
  } catch {
    // alguns eventos vêm form-encoded; tenta extrair mesmo assim adiante
  }
  const orderId = orderIdDoPayload(body);
  if (!orderId) return NextResponse.json({ ok: true, ignorado: "sem order_id" });

  // FONTE DA VERDADE: confirma o pedido direto na Kiwify (à prova de forja).
  let sale;
  try {
    sale = await buscarVenda(orderId);
  } catch (e) {
    // erro transitório na API da Kiwify: 500 faz a Kiwify reenviar depois
    return NextResponse.json({ erro: `falha ao verificar: ${e}` }, { status: 500 });
  }
  if (!sale) return NextResponse.json({ ok: true, ignorado: "pedido não encontrado" });

  const email = (sale.customer?.email || "").trim().toLowerCase();
  const creditos = creditosDaVenda(sale);

  // ---- PAGAMENTO APROVADO -> credita ----
  if (vendaEstaPaga(sale) && creditos > 0) {
    if (await existeTransacaoOrder(orderId, "compra")) {
      return NextResponse.json({ ok: true, jaProcessado: true });
    }
    const desc = `Compra Kiwify (${sale.product?.name || "crédito"})`;
    const user = email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

    if (user) {
      await lancar(user.id, creditos, "compra", { descricao: desc, kiwifyOrderId: orderId });
      await estenderAssinatura(user.id, DIAS_ASSINATURA);
      return NextResponse.json({ ok: true, creditado: creditos, userId: user.id });
    }
    // pagou antes de ter conta: guarda pendente pra aplicar no cadastro (mesmo e-mail)
    if (email) {
      await prisma.creditoPendente.upsert({
        where: { kiwifyOrderId: orderId },
        create: {
          email,
          valorCentavos: creditos,
          kiwifyOrderId: orderId,
          assinaturaDias: DIAS_ASSINATURA,
          descricao: desc,
        },
        update: {},
      });
      return NextResponse.json({ ok: true, pendente: true, email });
    }
    return NextResponse.json({ ok: true, ignorado: "sem e-mail do cliente" });
  }

  // ---- REEMBOLSO / CHARGEBACK -> estorna ----
  if (vendaEstornada(sale)) {
    if (await existeTransacaoOrder(orderId, "estorno")) {
      return NextResponse.json({ ok: true, jaEstornado: true });
    }
    const compra = await prisma.creditoTransacao.findFirst({
      where: { kiwifyOrderId: orderId, tipo: "compra" },
    });
    if (compra) {
      await debitarClamp(compra.userId, compra.valor, "estorno", {
        descricao: "Estorno de compra Kiwify (reembolso/chargeback)",
        kiwifyOrderId: orderId,
      });
      await recuarAssinatura(compra.userId, DIAS_ASSINATURA);
      return NextResponse.json({ ok: true, estornado: true });
    }
    // ainda estava pendente (nunca aplicado): invalida o pendente
    await prisma.creditoPendente.updateMany({
      where: { kiwifyOrderId: orderId, aplicado: false },
      data: { aplicado: true, descricao: "cancelado por estorno" },
    });
    return NextResponse.json({ ok: true, pendenteCancelado: true });
  }

  return NextResponse.json({ ok: true, ignorado: `status ${sale.status}` });
}
