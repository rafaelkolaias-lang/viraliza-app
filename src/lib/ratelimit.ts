import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/** IP do cliente (Traefik/EasyPanel põe x-forwarded-for). Fallback pra x-real-ip. */
export async function ipDaRequisicao(): Promise<string> {
  const h = await headers();
  const fwd = (h.get("x-forwarded-for") || "").split(",")[0].trim();
  return fwd || h.get("x-real-ip") || "desconhecido";
}

/**
 * Rate limit de janela fixa via banco (funciona com múltiplas instâncias, ao
 * contrário de um contador em memória). Registra 1 hit por tentativa e conta os
 * hits da chave na janela. Retorna true se AINDA está dentro do limite.
 *
 * Ex.: dentroDoLimite(`login:${ip}`, 25, 300) = no máx 25 tentativas em 5 min.
 */
export async function dentroDoLimite(
  chave: string,
  limite: number,
  janelaSeg: number,
): Promise<boolean> {
  const desde = new Date(Date.now() - janelaSeg * 1000);
  try {
    const n = await prisma.rateHit.count({
      where: { chave, criadoEm: { gte: desde } },
    });
    if (n >= limite) return false;
    await prisma.rateHit.create({ data: { chave } });
    // limpeza oportunista: de vez em quando apaga hits velhos (evita crescer sem fim)
    if (Math.random() < 0.02) {
      const velho = new Date(Date.now() - 24 * 3600 * 1000);
      await prisma.rateHit
        .deleteMany({ where: { criadoEm: { lt: velho } } })
        .catch(() => {});
    }
    return true;
  } catch {
    // se o limiter falhar (banco fora), não trava o usuário legítimo
    return true;
  }
}
