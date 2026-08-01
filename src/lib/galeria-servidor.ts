import "server-only";

import { prisma } from "@/lib/prisma";
import type { ContextoImagem, ImagemDaGaleria, OrigemImagem } from "@/lib/galeria-imagens";

/** Lado servidor da galeria "Minhas imagens" (o lado puro está em galeria-imagens). */

/**
 * Guarda a imagem recém-gerada. Nunca derruba a resposta da geração: se falhar
 * aqui, a pessoa continua com a imagem na tela, só não fica salva.
 */
export async function salvarNaGaleria(entrada: {
  userId: string;
  origem: OrigemImagem;
  titulo: string;
  imagemUrl: string;
  contexto?: ContextoImagem;
}): Promise<string | null> {
  try {
    const r = await prisma.imagemGerada.create({
      data: {
        userId: entrada.userId,
        origem: entrada.origem,
        titulo: (entrada.titulo || "Imagem gerada").slice(0, 490),
        imagemUrl: entrada.imagemUrl,
        contexto: entrada.contexto ? JSON.stringify(entrada.contexto) : null,
      },
      select: { id: true },
    });
    return r.id;
  } catch {
    return null;
  }
}

/** Marca que saiu mais um vídeo daquela imagem (o contador do card). */
export async function contarVideoDaImagem(userId: string, imagemUrl?: string) {
  if (!imagemUrl) return;
  try {
    await prisma.imagemGerada.updateMany({
      where: { userId, imagemUrl },
      data: { videos: { increment: 1 } },
    });
  } catch {
    // contador é enfeite: nunca atrapalha a geração do vídeo
  }
}

export async function minhasImagens(userId: string, limite = 120): Promise<ImagemDaGaleria[]> {
  const linhas = await prisma.imagemGerada.findMany({
    where: { userId },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  return linhas.map((l) => {
    let contexto: ContextoImagem | null = null;
    if (l.contexto) {
      try {
        contexto = JSON.parse(l.contexto) as ContextoImagem;
      } catch {
        contexto = null;
      }
    }
    return {
      id: l.id,
      origem: (l.origem as OrigemImagem) ?? "lab",
      titulo: l.titulo,
      imagem: l.imagemUrl,
      favorita: l.favorita,
      videos: l.videos,
      criadoEm: l.criadoEm.toISOString(),
      contexto,
    };
  });
}
