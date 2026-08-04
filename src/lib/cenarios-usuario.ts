import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Cenários PRÓPRIOS do usuário: a foto que ele sobe vira uma opção no passo
 * "Cenário" do Lab (só pra ele) e fica guardada na aba Cenários do Personalize
 * com IA. Na geração, a foto vai como referência de LUGAR pro motor.
 */

export type CenarioMeu = {
  id: string;
  nome: string;
  imagemUrl: string;
  criadoEm: string;
};

const LIMITE_POR_USUARIO = 30;

export async function meusCenarios(userId: string): Promise<CenarioMeu[]> {
  const linhas = await prisma.cenarioUsuario.findMany({
    where: { userId },
    orderBy: { criadoEm: "desc" },
    take: LIMITE_POR_USUARIO,
  });
  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    imagemUrl: l.imagemUrl,
    criadoEm: l.criadoEm.toISOString(),
  }));
}

export async function criarCenario(entrada: {
  userId: string;
  nome: string;
  imagemUrl: string;
}): Promise<CenarioMeu | null> {
  const quantos = await prisma.cenarioUsuario.count({ where: { userId: entrada.userId } });
  if (quantos >= LIMITE_POR_USUARIO) return null;
  const l = await prisma.cenarioUsuario.create({
    data: {
      userId: entrada.userId,
      nome: (entrada.nome || "Meu cenário").slice(0, 120),
      imagemUrl: entrada.imagemUrl,
    },
  });
  return { id: l.id, nome: l.nome, imagemUrl: l.imagemUrl, criadoEm: l.criadoEm.toISOString() };
}

/** Busca UM cenário garantindo que é do usuário (pra geração). */
export async function cenarioDoUsuario(userId: string, id: string) {
  return prisma.cenarioUsuario.findFirst({ where: { id, userId } });
}

export async function excluirCenario(userId: string, id: string): Promise<boolean> {
  const r = await prisma.cenarioUsuario.deleteMany({ where: { id, userId } });
  return r.count > 0;
}
