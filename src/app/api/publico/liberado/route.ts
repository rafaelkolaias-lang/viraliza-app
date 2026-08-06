import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Já posso criar minha conta?" - a tela de /assinar pergunta isto de poucos em
 * poucos segundos depois de o cartão ser autorizado.
 *
 * Existe porque autorizar o cartão NÃO é ter pago. O Mercado Pago primeiro faz
 * uma validação de R$ 0 e só depois roda a cobrança de verdade, que pode levar
 * alguns minutos. A allowlist só nasce com a cobrança real (ver
 * mercadopago-processa), então a existência dela é a resposta honesta pra
 * pergunta "o dinheiro entrou?".
 *
 * Devolve só um booleano, pro e-mail exato: nada de listar ou vazar dado.
 */
export async function GET(req: Request) {
  const email = (new URL(req.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    return NextResponse.json({ liberado: false });
  }
  const acesso = await prisma.acessoPago.findUnique({
    where: { email },
    select: { email: true },
  });
  return NextResponse.json({ liberado: !!acesso });
}
