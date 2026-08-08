import "server-only";

import { statusImagemGrok } from "@/lib/imagem-robot";
import { estiloPorChave } from "@/lib/estilos-camera";
import { debitarClamp } from "@/lib/creditos";
import { registrarGrokImagem } from "@/lib/gastos-api";
import { CUSTO_IMAGEM_LAB } from "@/lib/lab-custos";
import {
  descartarPedidoImagem,
  fecharPedidoImagem,
  pedidosPendentes,
} from "@/lib/galeria-servidor";

/**
 * Fecho do pedido de imagem do Lab, num lugar só porque DOIS caminhos precisam
 * dele: a tela perguntando o andamento e a galeria se reconciliando quando a
 * pessoa fechou a aba no meio da fila.
 *
 * O pedido só vira imagem de verdade aqui, e é aqui que o crédito sai.
 */

/** Pedido que já passou disso sem sair do "gerando" é dado como perdido. */
const VALIDADE_MS = 20 * 60_000;

/**
 * Cobra e marca a imagem como pronta. A trava contra cobrar duas vezes é o
 * `fecharPedidoImagem`: só a primeira chamada que conseguir preencher a URL
 * recebe true, então perguntas repetidas (ou duas abas) não debitam de novo.
 */
export async function concluirPedidoImagem(
  user: { id: string; role: string },
  pedido: { id: string; estilo?: string | null },
  imagemUrl: string,
) {
  const fechou = await fecharPedidoImagem(pedido.id, imagemUrl);
  if (!fechou) return false;

  // demo entra junto com admin: em todo o resto do app ela gera sem pagar
  const isAdmin = user.role === "admin" || user.role === "demo";
  if (!isAdmin) {
    // mesmo texto de extrato de antes: "Imagem do Lab (De frente)"
    const label = estiloPorChave(pedido.estilo ?? undefined)?.label;
    await debitarClamp(user.id, CUSTO_IMAGEM_LAB, "debito_geracao", {
      descricao: label ? `Imagem do Lab (${label})` : "Imagem do Lab",
    }).catch(() => {});
  }
  // contabilidade do dono (aba Finanças): imagem saiu do robô do Grok
  await registrarGrokImagem(user.id, "lab-imagem").catch(() => {});
  return true;
}

/**
 * Varre os pedidos em aberto da pessoa e fecha os que o robô já entregou.
 *
 * Existe porque a tela pode sumir no meio da fila (trocar de aba, fechar o
 * navegador, a internet cair). Sem isto, a imagem ficava pronta no serverrk e
 * nunca aparecia pra ela. Roda ao abrir "Minhas imagens", que é justo onde a
 * pessoa vai procurar.
 */
export async function reconciliarPedidosImagem(user: { id: string; role: string }) {
  let fechados = 0;
  let pendentes: Awaited<ReturnType<typeof pedidosPendentes>> = [];
  try {
    pendentes = await pedidosPendentes(user.id);
  } catch {
    return 0;
  }

  for (const p of pendentes) {
    const velho = Date.now() - p.criadoEm.getTime() > VALIDADE_MS;
    if (!p.jobId) {
      await descartarPedidoImagem(p.id);
      continue;
    }
    const s = await statusImagemGrok(p.jobId);
    if (s.status === "pronto") {
      if (await concluirPedidoImagem(user, p, s.imagemUrl)) fechados++;
    } else if (s.status === "erro" || velho) {
      await descartarPedidoImagem(p.id);
    }
  }
  return fechados;
}
