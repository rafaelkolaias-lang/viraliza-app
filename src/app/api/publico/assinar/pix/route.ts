import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { criarAssinaturaPix, mercadoPagoConfigurado } from "@/lib/mercadopago";
import { PLANO_BASE_REAIS } from "@/lib/oferta-publica";
import { cpfValido } from "@/lib/cpf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gera o QR do Pix pra quem AINDA NÃO TEM CONTA (fluxo da landing page).
 *
 * O Pix paga UM mês: não existe cobrança automática de Pix em lugar nenhum, então
 * a renovação é na mão, e o aviso de 3 dias antes é o que fecha esse ciclo.
 *
 * O VALOR NUNCA VEM DO CLIENTE: é lido aqui no servidor.
 */
export async function POST(req: Request) {
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Pagamento indisponível no momento." }, { status: 503 });
  }

  let email = "";
  let nome = "";
  let cpf = "";
  try {
    const body = (await req.json()) as { email?: string; nome?: string; cpf?: string };
    email = String(body.email ?? "").trim().toLowerCase();
    nome = String(body.nome ?? "").trim().slice(0, 80);
    cpf = String(body.cpf ?? "");
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    return NextResponse.json({ erro: "E-mail inválido." }, { status: 400 });
  }
  if (nome.split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json({ erro: "Escreva seu nome completo." }, { status: 400 });
  }
  if (!cpfValido(cpf)) {
    return NextResponse.json({ erro: "CPF inválido." }, { status: 400 });
  }

  const jaTemConta = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (jaTemConta) {
    return NextResponse.json(
      { erro: "Você já tem conta com esse e-mail. Entre na plataforma e assine pelo painel." },
      { status: 409 },
    );
  }

  try {
    const p = await criarAssinaturaPix({
      userId: `publico:${email}`,
      email,
      nome,
      cpf,
      valorReais: PLANO_BASE_REAIS,
    });
    return NextResponse.json({
      ok: true,
      paymentId: p.paymentId,
      status: p.status,
      qrCode: p.qrCode,
      qrCodeBase64: p.qrCodeBase64,
    });
  } catch (e) {
    console.error("[mp] falha no Pix da assinatura pública", email, e);
    return NextResponse.json(
      { erro: "Não consegui gerar o Pix. Tente de novo em instantes." },
      { status: 502 },
    );
  }
}
