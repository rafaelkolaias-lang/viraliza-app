import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  criarAssinatura,
  criarAssinaturaCartao,
  mercadoPagoConfigurado,
} from "@/lib/mercadopago";
import { PLANO_BASE_REAIS } from "@/lib/oferta-publica";
import { enviarBoasVindas } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");

/**
 * Assina para quem AINDA NÃO TEM CONTA (vindo da landing page).
 *
 * É pública de propósito: no Viraliza a conta só nasce depois da compra (trava
 * anti-farm), então o visitante precisa pagar antes de existir como usuário.
 * Quando o pagamento confirma, o webhook grava o e-mail na allowlist, e é ela
 * que libera o cadastro.
 *
 * Com `cardTokenId` a assinatura já nasce autorizada (a pessoa nem sai da
 * página). Sem ele, cai no fluxo de link do Mercado Pago, que é a reserva pra
 * quando o SDK não carrega no navegador da pessoa.
 *
 * O VALOR NUNCA VEM DO CLIENTE: é lido do ambiente aqui no servidor.
 */
export async function POST(req: Request) {
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Pagamento indisponível no momento." }, { status: 503 });
  }

  let email = "";
  let cardTokenId = "";
  try {
    const body = (await req.json()) as { email?: string; cardTokenId?: string };
    email = String(body.email ?? "").trim().toLowerCase();
    cardTokenId = String(body.cardTokenId ?? "");
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }

  // já tem conta? então é renovação/segunda assinatura: manda pro painel, onde
  // a tela sabe se ele já tem acesso e evita cobrar duas vezes pela mesma coisa
  const jaTemConta = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (jaTemConta) {
    return NextResponse.json(
      {
        erro: "Você já tem conta com esse e-mail. Entre na plataforma e assine pelo painel.",
      },
      { status: 409 },
    );
  }

  try {
    if (cardTokenId) {
      const r = await criarAssinaturaCartao({
        // sem conta ainda: o external_reference carrega o e-mail, e é por ele
        // que o webhook liga o pagamento à pessoa quando ela se cadastrar
        userId: `publico:${email}`,
        email,
        cardTokenId,
      });

      // ASSINATURA AUTORIZADA JÁ LIBERA O CADASTRO.
      //
      // O Mercado Pago documenta que "a primeira parcela é cobrada até o período
      // aproximado de UMA HORA após a assinatura". Esperar essa cobrança pra
      // liberar deixaria a pessoa que acabou de pagar até uma hora sem conseguir
      // criar a conta, achando que deu errado - e pedindo reembolso por isso.
      //
      // Autorizado quer dizer que o cartão foi aceito e o MP se comprometeu a
      // cobrar, então libera aqui, com o valor do PLANO (não o R$ 0 da validação
      // de cartão, que é o que quebrava o crédito de entrada). Quando a cobrança
      // real cair, a guarda de ciclo do processarPagamentoMP impede pagar de novo.
      if (r.status === "authorized") {
        const jaTinha = await prisma.acessoPago.findUnique({ where: { email } });
        await prisma.acessoPago.upsert({
          where: { email },
          create: {
            email,
            kiwifyOrderId: `mp-assin-${r.assinaturaId}`,
            produto: "Assinatura Viraliza",
            valorCentavos: Math.round(PLANO_BASE_REAIS * 100),
          },
          update: {},
        });
        if (!jaTinha) {
          try {
            await enviarBoasVindas({ para: email, produto: "Assinatura Viraliza" });
          } catch (e) {
            console.error("[mp] falha ao enviar boas-vindas da assinatura", email, e);
          }
        }
      }

      return NextResponse.json({
        ok: true,
        status: r.status,
        liberado: r.status === "authorized",
      });
    }

    const { url } = await criarAssinatura({
      userId: `publico:${email}`,
      email,
      valorReais: PLANO_BASE_REAIS,
      voltarPara: `${APP_URL}/cadastro?assinou=1`,
    });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("[mp] falha na assinatura pública", email, e);
    return NextResponse.json(
      { erro: "Não consegui concluir. Confira o cartão e tente de novo." },
      { status: 502 },
    );
  }
}
