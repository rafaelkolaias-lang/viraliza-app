import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { statusImagemGrok } from "@/lib/imagem-robot";
import { descartarPedidoImagem, lerPedidoImagem } from "@/lib/galeria-servidor";
import { concluirPedidoImagem } from "@/lib/lab-pedido-imagem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Andamento da imagem do Lab. A tela chama isto de poucos em poucos segundos
 * enquanto o pedido está na fila do robô, no lugar de segurar uma única
 * requisição longa (que o celular derrubava com "Load failed").
 *
 * É AQUI que o crédito é cobrado, e só quando a imagem existe de verdade. A
 * trava contra cobrar duas vezes é o `fecharPedidoImagem`: ele só devolve true
 * pra primeira chamada que conseguir preencher a URL, então as perguntas
 * seguintes (ou duas abas abertas) caem no caminho de "já estava pronta".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const { pedidoId } = await params;
  const pedido = await lerPedidoImagem(user.id, pedidoId);
  if (!pedido) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });

  // já ficou pronta numa pergunta anterior
  if (pedido.imagemUrl) {
    return NextResponse.json({
      ok: true,
      status: "pronto",
      imagemUrl: pedido.imagemUrl,
      imagemId: pedido.id,
    });
  }

  if (!pedido.jobId) {
    await descartarPedidoImagem(pedido.id);
    return NextResponse.json(
      { erro: "Esse pedido se perdeu. Pode gerar de novo (não descontamos créditos)." },
      { status: 502 },
    );
  }

  const s = await statusImagemGrok(pedido.jobId);

  if (s.status === "gerando") {
    return NextResponse.json({ ok: true, status: "gerando" });
  }

  if (s.status === "erro") {
    await descartarPedidoImagem(pedido.id);
    return NextResponse.json(
      {
        erro: "Não consegui gerar a imagem agora. Tente de novo em instantes (não descontamos créditos).",
      },
      { status: 502 },
    );
  }

  // pronto: quem fechar primeiro é quem cobra
  await concluirPedidoImagem(user, pedido, s.imagemUrl);

  return NextResponse.json({
    ok: true,
    status: "pronto",
    imagemUrl: s.imagemUrl,
    imagemId: pedido.id,
  });
}
