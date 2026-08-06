import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { buscarPagamento, mercadoPagoConfigurado, pagamentoAprovado } from "@/lib/mercadopago";
import { processarPagamentoMP } from "@/lib/mercadopago-processa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status de um pagamento (a tela do Pix consulta a cada poucos segundos até
 * aprovar). Só devolve pagamentos DO PRÓPRIO usuário: quem pergunta por
 * pagamento alheio recebe 404, sem vazar que ele existe.
 *
 * Quando o status vem "approved", o crédito é processado AQUI TAMBÉM (mesmo
 * caminho idempotente do webhook): é o que faz o saldo cair na hora na tela e
 * cobre webhook atrasado ou perdido.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (!mercadoPagoConfigurado()) {
    return NextResponse.json({ erro: "Indisponível." }, { status: 503 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ erro: "Inválido." }, { status: 400 });

  try {
    const p = await buscarPagamento(id);
    if (!p || (p.userId && p.userId !== user.id)) {
      return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
    }
    if (pagamentoAprovado(p)) {
      // idempotente: se o webhook já creditou, não faz nada de novo
      await processarPagamentoMP(p);
    }
    return NextResponse.json({ ok: true, status: p.status });
  } catch (e) {
    console.error("[mp] falha ao consultar pagamento", id, e);
    return NextResponse.json({ erro: "Falha ao consultar." }, { status: 502 });
  }
}
