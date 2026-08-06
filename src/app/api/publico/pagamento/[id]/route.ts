import { NextResponse } from "next/server";
import { buscarPagamento, mercadoPagoConfigurado, pagamentoAprovado } from "@/lib/mercadopago";
import { processarPagamentoMP } from "@/lib/mercadopago-processa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status do Pix da assinatura PÚBLICA (a tela consulta de poucos em poucos
 * segundos até aprovar). Quando aprova, libera aqui também, pelo mesmo caminho
 * idempotente do webhook: é o que faz a tela virar na hora e cobre webhook que
 * atrasa ou não chega.
 *
 * Sem login, a proteção é dupla: só responde por pagamento marcado como
 * "assinatura_pix" E cujo e-mail do pagador bate com o que veio na URL. Quem
 * chutar um id alheio recebe 404, sem descobrir que ele existe.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Indisponível." }, { status: 503 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ erro: "Inválido." }, { status: 400 });

  const email = (new URL(req.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ erro: "Inválido." }, { status: 400 });

  try {
    const p = await buscarPagamento(id);
    if (!p || p.tipo !== "assinatura_pix" || p.email !== email) {
      return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
    }
    if (pagamentoAprovado(p)) {
      await processarPagamentoMP(p);
    }
    return NextResponse.json({ ok: true, status: p.status });
  } catch (e) {
    console.error("[mp] falha ao consultar Pix público", id, e);
    return NextResponse.json({ erro: "Falha ao consultar." }, { status: 502 });
  }
}
