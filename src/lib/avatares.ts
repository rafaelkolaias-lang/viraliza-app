import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Avatares do usuario (Meus avatares). A criacao gera a foto no gpt-image-1, sobe
 * pro serverrk e registra a linha aqui. Custa creditos (geracao de imagem e mais
 * cara que um video comum). Ver openai-image.ts + serverrk-upload.ts.
 */

export { CUSTO_AVATAR } from "@/lib/avatar-modelo";

export type AvatarItem = {
  id: string;
  nome: string;
  genero: string;
  imagemUrl: string;
  criadoEm: string;
};

/** Lista os avatares prontos do usuario (mais novos primeiro). */
export async function listarAvatares(userId: string): Promise<AvatarItem[]> {
  const rows = await prisma.avatar.findMany({
    where: { userId, status: "pronto" },
    orderBy: { criadoEm: "desc" },
    select: { id: true, nome: true, genero: true, imagemUrl: true, criadoEm: true },
  });
  return rows.map((a) => ({
    id: a.id,
    nome: a.nome,
    genero: a.genero,
    imagemUrl: a.imagemUrl,
    criadoEm: a.criadoEm.toISOString(),
  }));
}

/** Cria a linha do avatar apos a foto ja estar hospedada no serverrk. */
export async function registrarAvatar(opts: {
  userId: string;
  nome: string;
  genero: string;
  imagemUrl: string;
  escolhas: unknown;
}): Promise<AvatarItem> {
  const a = await prisma.avatar.create({
    data: {
      userId: opts.userId,
      nome: opts.nome.slice(0, 120),
      genero: opts.genero === "male" ? "male" : "female",
      status: "pronto",
      imagemUrl: opts.imagemUrl,
      escolhas: JSON.stringify(opts.escolhas ?? {}),
    },
    select: { id: true, nome: true, genero: true, imagemUrl: true, criadoEm: true },
  });
  return {
    id: a.id,
    nome: a.nome,
    genero: a.genero,
    imagemUrl: a.imagemUrl,
    criadoEm: a.criadoEm.toISOString(),
  };
}
