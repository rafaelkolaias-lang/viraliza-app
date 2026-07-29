import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Sugestões/melhorias dos usuários. O usuário só enxerga as dele; o admin vê TODAS
 * (com o nome/e-mail de quem mandou) e pode marcar o status.
 */

export const TIPOS_SUGESTAO = ["sugestao", "melhoria", "problema"] as const;
export type TipoSugestao = (typeof TIPOS_SUGESTAO)[number];

export type SugestaoItem = {
  id: string;
  texto: string;
  tipo: string;
  status: string;
  resposta?: string | null; // resposta do admin (autor vê)
  creditosDados?: number; // créditos dados junto com a resposta
  criadoEm: string;
  autor?: { nome: string; email: string }; // só o admin recebe
};

/** Cria uma sugestão do usuário. */
export async function criarSugestao(userId: string, texto: string, tipo: string) {
  const t = TIPOS_SUGESTAO.includes(tipo as TipoSugestao) ? tipo : "sugestao";
  const s = await prisma.sugestao.create({
    data: { userId, texto: texto.trim().slice(0, 2000), tipo: t },
    select: { id: true, texto: true, tipo: true, status: true, criadoEm: true },
  });
  return { ...s, criadoEm: s.criadoEm.toISOString() } satisfies SugestaoItem;
}

/** Sugestões de UM usuário (as dele). */
export async function listarMinhasSugestoes(userId: string): Promise<SugestaoItem[]> {
  const rows = await prisma.sugestao.findMany({
    where: { userId },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      texto: true,
      tipo: true,
      status: true,
      resposta: true,
      creditosDados: true,
      criadoEm: true,
    },
  });
  return rows.map((s) => ({ ...s, criadoEm: s.criadoEm.toISOString() }));
}

/** TODAS as sugestões (admin), com quem mandou. */
export async function listarTodasSugestoes(limite = 300): Promise<SugestaoItem[]> {
  const rows = await prisma.sugestao.findMany({
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: {
      id: true,
      texto: true,
      tipo: true,
      status: true,
      resposta: true,
      creditosDados: true,
      criadoEm: true,
      user: { select: { nome: true, email: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    texto: s.texto,
    tipo: s.tipo,
    status: s.status,
    resposta: s.resposta,
    creditosDados: s.creditosDados,
    criadoEm: s.criadoEm.toISOString(),
    autor: { nome: s.user.nome, email: s.user.email },
  }));
}

/** Admin muda o status ("nova" | "lida" | "resolvida"). */
export async function mudarStatusSugestao(id: string, status: string) {
  const ok = ["nova", "lida", "resolvida"].includes(status) ? status : "nova";
  await prisma.sugestao.update({ where: { id }, data: { status: ok } });
}

/** Admin responde a sugestão (e pode dar créditos junto). Devolve o dono. */
export async function responderSugestao(id: string, resposta: string, creditos: number) {
  const s = await prisma.sugestao.update({
    where: { id },
    data: {
      resposta: resposta.trim().slice(0, 2000),
      // acumula se responder mais de uma vez com créditos
      creditosDados: { increment: Math.max(0, creditos) },
      status: "resolvida",
    },
    select: { userId: true, texto: true },
  });
  return s;
}

/** Quantas sugestões ainda "nova" (badge do admin). */
export async function contarSugestoesNovas(): Promise<number> {
  return prisma.sugestao.count({ where: { status: "nova" } });
}
