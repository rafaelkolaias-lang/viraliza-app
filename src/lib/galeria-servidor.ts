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

/**
 * PEDIDO EM ANDAMENTO. A imagem do Lab entra na fila do robô e pode demorar
 * minutos, então a linha nasce aqui com `imagemUrl` VAZIA e só ganha a URL
 * quando fica pronta. Assim a rota responde na hora e a tela pergunta o
 * andamento, em vez de segurar a conexão do navegador (era isso que o celular
 * derrubava com "Load failed").
 *
 * Pedido em andamento NÃO aparece na galeria: `minhasImagens` filtra a URL vazia.
 */
export async function abrirPedidoImagem(entrada: {
  userId: string;
  origem: OrigemImagem;
  titulo: string;
  jobId: string;
  contexto?: ContextoImagem;
}): Promise<string | null> {
  try {
    const r = await prisma.imagemGerada.create({
      data: {
        userId: entrada.userId,
        origem: entrada.origem,
        titulo: (entrada.titulo || "Imagem gerada").slice(0, 490),
        imagemUrl: "",
        contexto: JSON.stringify({ ...(entrada.contexto ?? {}), jobId: entrada.jobId }),
      },
      select: { id: true },
    });
    return r.id;
  } catch {
    return null;
  }
}

/** Lê um pedido do dono (null se não for dele ou não existir). */
export async function lerPedidoImagem(userId: string, id: string) {
  const l = await prisma.imagemGerada.findFirst({ where: { id, userId } });
  if (!l) return null;
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
    imagemUrl: l.imagemUrl,
    titulo: l.titulo,
    jobId: contexto?.jobId ?? "",
    estilo: contexto?.estilo ?? null,
  };
}

/**
 * Fecha o pedido com a imagem pronta. Devolve true SÓ pra quem fechou de fato:
 * o `imagemUrl: ""` no filtro é a trava de corrida que garante um único
 * vencedor, porque a tela pergunta o andamento várias vezes e não pode debitar
 * o crédito duas vezes pela mesma imagem.
 */
export async function fecharPedidoImagem(id: string, imagemUrl: string): Promise<boolean> {
  try {
    const r = await prisma.imagemGerada.updateMany({
      where: { id, imagemUrl: "" },
      data: { imagemUrl },
    });
    return r.count === 1;
  } catch {
    return false;
  }
}

/** Pedidos dessa pessoa que ainda estão na fila do robô (URL vazia). */
export async function pedidosPendentes(userId: string) {
  const linhas = await prisma.imagemGerada.findMany({
    where: { userId, imagemUrl: "" },
    orderBy: { criadoEm: "desc" },
    take: 10,
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
      criadoEm: l.criadoEm,
      jobId: contexto?.jobId ?? "",
      estilo: contexto?.estilo ?? null,
    };
  });
}

/** Some com o pedido que falhou, pra não deixar linha morta na galeria. */
export async function descartarPedidoImagem(id: string) {
  try {
    await prisma.imagemGerada.deleteMany({ where: { id, imagemUrl: "" } });
  } catch {
    // pedido perdido não atrapalha ninguém
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
    // URL vazia = pedido ainda na fila do robô, não é imagem pra mostrar
    where: { userId, imagemUrl: { not: "" } },
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
