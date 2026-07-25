import "server-only";

import { prisma } from "@/lib/prisma";
import { lancar } from "@/lib/creditos";
import { criarNotificacao } from "@/lib/notificacoes";
import {
  BONUS_IG_CREDITOS,
  INSTAGRAM_HANDLE,
  type StatusBonusIg,
} from "@/lib/promos";

/**
 * Bônus de +300 créditos por seguir o Instagram. A Meta não deixa checar por API
 * se a pessoa seguiu/curtiu, então a liberação é MANUAL: a pessoa manda o @ dela,
 * o pedido fica "pendente" e o admin aprova (aí credita 1x) ou recusa.
 */

export type BonusIgInfo = { status: StatusBonusIg; instagram: string | null };

/** Deixa só o handle: tira espaço, @, e a URL do instagram se colarem inteira. */
export function normalizarInstagram(raw: string): string {
  let s = String(raw || "").trim().toLowerCase();
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//, "");
  s = s.replace(/[/?#].*$/, "");
  s = s.replace(/^@+/, "");
  s = s.replace(/[^a-z0-9._]/g, "");
  return s.slice(0, 40);
}

/** Situação do bônus deste usuário (pro modal saber o que mostrar). */
export async function getStatusBonusIg(userId: string): Promise<BonusIgInfo> {
  const b = await prisma.bonusInstagram.findUnique({ where: { userId } });
  if (!b) return { status: "nenhum", instagram: null };
  return { status: b.status as StatusBonusIg, instagram: b.instagram };
}

/** A pessoa pede o bônus informando o @ dela. Vira/atualiza um pedido "pendente".
 *  Quem já foi aprovado não pode pedir de novo (não credita 2x). */
export async function pedirBonusIg(userId: string, instagramRaw: string) {
  const instagram = normalizarInstagram(instagramRaw);
  if (instagram.length < 2) {
    return { ok: false as const, erro: "Informe seu @ do Instagram." };
  }
  const atual = await prisma.bonusInstagram.findUnique({ where: { userId } });
  if (atual?.status === "aprovado") {
    return { ok: false as const, erro: "Você já recebeu esse bônus. 🎉" };
  }
  await prisma.bonusInstagram.upsert({
    where: { userId },
    create: { userId, instagram, status: "pendente" },
    update: { instagram, status: "pendente", decididoEm: null },
  });
  return { ok: true as const };
}

// ---- Admin ----

export type PedidoBonusIg = {
  id: string;
  userId: string;
  nome: string;
  email: string;
  instagram: string;
  status: StatusBonusIg;
  criadoEm: string;
};

/** Lista os pedidos pro painel do admin (pendentes primeiro). */
export async function listarPedidosBonusIg(): Promise<PedidoBonusIg[]> {
  const itens = await prisma.bonusInstagram.findMany({
    orderBy: [{ status: "asc" }, { criadoEm: "desc" }],
    include: { user: { select: { nome: true, email: true } } },
    take: 300,
  });
  return itens.map((b) => ({
    id: b.id,
    userId: b.userId,
    nome: b.user.nome,
    email: b.user.email,
    instagram: b.instagram,
    status: b.status as StatusBonusIg,
    criadoEm: b.criadoEm.toISOString(),
  }));
}

/** Quantos pedidos estão pendentes (badge do menu do admin). */
export async function contarPendentesBonusIg(): Promise<number> {
  return prisma.bonusInstagram.count({ where: { status: "pendente" } });
}

/**
 * Admin aprova (credita 300, uma única vez) ou recusa um pedido. O crédito é
 * "reivindicado" com um updateMany atômico (status != aprovado) antes de lançar,
 * então dois cliques seguidos nunca creditam duas vezes.
 */
export async function decidirBonusIg(id: string, aprovar: boolean) {
  const b = await prisma.bonusInstagram.findUnique({ where: { id } });
  if (!b) return { ok: false as const, erro: "Pedido não encontrado." };

  if (!aprovar) {
    await prisma.bonusInstagram.update({
      where: { id },
      data: { status: "recusado", decididoEm: new Date() },
    });
    await criarNotificacao({
      userId: b.userId,
      titulo: "Bônus do Instagram não liberado",
      mensagem: `Não confirmamos seu seguir/curtir. Confira que seguiu ${INSTAGRAM_HANDLE}, curtiu e comentou, e peça de novo.`,
      link: "/painel/creditos",
    });
    return { ok: true as const };
  }

  // reivindica o crédito de forma atômica: só passa se ainda não foi aprovado.
  const claim = await prisma.bonusInstagram.updateMany({
    where: { id, status: { not: "aprovado" } },
    data: { status: "aprovado", creditadoEm: new Date(), decididoEm: new Date() },
  });
  if (claim.count === 0) return { ok: true as const, jaCreditado: true };

  await lancar(b.userId, BONUS_IG_CREDITOS, "bonus_instagram", {
    descricao: `Bônus por seguir o Instagram (@${b.instagram})`,
  });
  await criarNotificacao({
    userId: b.userId,
    titulo: "Você ganhou 300 créditos! 🎉",
    mensagem: `Obrigado por seguir o ${INSTAGRAM_HANDLE}! Seus ${BONUS_IG_CREDITOS} créditos já estão na sua conta.`,
    link: "/painel/creditos",
  });
  return { ok: true as const };
}
