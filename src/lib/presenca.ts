import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Marca o usuário como "visto agora" (presença). Só escreve se a última marca tem
 * mais de 60s (updateMany com condição no where = no máx 1 escrita por minuto por
 * usuário, sem virar 1 write por request). Usado pelo layout de todas as páginas.
 */
export async function tocarPresenca(userId: string) {
  const umMinutoAtras = new Date(Date.now() - 60_000);
  try {
    await prisma.user.updateMany({
      where: { id: userId, OR: [{ vistoEm: null }, { vistoEm: { lt: umMinutoAtras } }] },
      data: { vistoEm: new Date() },
    });
  } catch {
    /* presença é best-effort; nunca trava a página */
  }
}
