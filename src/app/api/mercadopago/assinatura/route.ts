import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import {
  cancelarAssinatura,
  criarAssinatura,
  criarAssinaturaCartao,
  mercadoPagoConfigurado,
} from "@/lib/mercadopago";
import { ativarAssinaturaMP } from "@/lib/mercadopago-processa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Assinatura mensal SEM sair do site: recebe o cartão tokenizado no navegador
 * (cardTokenId) e cria o preapproval já autorizado. O valor vem do ambiente
 * (MP_ASSINATURA_REAIS), nunca do cliente.
 *
 * Sem cardTokenId cai no fluxo reserva: cria a assinatura pendente e devolve o
 * link de pagamento do MP (útil se o SDK não carregar no navegador da pessoa).
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Pagamento indisponível no momento." }, { status: 503 });
  }

  let cardTokenId = "";
  try {
    const body = (await req.json()) as { cardTokenId?: string };
    cardTokenId = String(body.cardTokenId ?? "");
  } catch {
    // sem corpo: fluxo reserva do link
  }

  try {
    if (cardTokenId) {
      const r = await criarAssinaturaCartao({
        userId: user.id,
        email: user.email,
        cardTokenId,
      });
      // guarda o id ANTES de qualquer outra coisa: é ele que permite cancelar
      // depois. Sem isso a pessoa fica presa numa cobrança que ninguém desliga.
      await prisma.user.update({
        where: { id: user.id },
        // limpa a marca de cancelamento: quem reassinou volta a renovar
        data: { mpAssinaturaId: r.assinaturaId, mpAssinaturaCanceladaEm: null },
      });
      if (r.status === "authorized") {
        // acesso liga já; o mês inteiro e o crédito vêm com a cobrança (webhook)
        await ativarAssinaturaMP(user.id);
      }
      return NextResponse.json({ ok: true, status: r.status });
    }

    const { url, preferenciaId } = await criarAssinatura({
      userId: user.id,
      email: user.email,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { mpAssinaturaId: preferenciaId },
    });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("[mp] falha ao criar assinatura", user.id, e);
    return NextResponse.json(
      { erro: "Não consegui processar a assinatura. Confira o cartão e tente de novo." },
      { status: 502 },
    );
  }
}

/**
 * Cancela a renovação. A pessoa NÃO perde o acesso na hora: o mês já pago
 * continua valendo até o vencimento, que expira sozinho. É o que a LP e o modal
 * prometem ("cancele quando quiser, sem multa").
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const conta = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mpAssinaturaId: true, assinaturaAte: true },
  });
  if (!conta?.mpAssinaturaId) {
    // assinou pela Cakto (antes da migração) ou nunca assinou por aqui
    return NextResponse.json(
      {
        erro: "Sua assinatura não foi feita por aqui. Fale com o suporte no chat que a gente cancela pra você.",
      },
      { status: 409 },
    );
  }

  try {
    await cancelarAssinatura(conta.mpAssinaturaId);
  } catch (e) {
    console.error("[mp] falha ao cancelar assinatura", user.id, e);
    return NextResponse.json(
      { erro: "Não consegui cancelar agora. Tente de novo em instantes." },
      { status: 502 },
    );
  }

  // some o vínculo pra tela parar de oferecer cancelar de novo, e marca a data
  // pro aviso de vencimento saber que este acesso ACABA (em vez de renovar).
  // O acesso segue valendo: quem manda nisso é o assinaturaAte, intocado.
  await prisma.user.update({
    where: { id: user.id },
    data: { mpAssinaturaId: null, mpAssinaturaCanceladaEm: new Date() },
  });
  return NextResponse.json({ ok: true, valeAte: conta.assinaturaAte });
}
