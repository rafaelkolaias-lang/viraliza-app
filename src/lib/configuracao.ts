import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Chaves gerais da plataforma: liga/desliga funcionalidade SEM DEPLOY.
 * Nasceu pro admin conseguir pausar a geração na hora que o motor (Grok/serverrk)
 * está fora do ar ou batendo cota, em vez de deixar a galera gastando tentativa.
 *
 * Padrão de tudo é LIGADO: se a linha não existe no banco, funciona normal.
 */

export const CHAVES = {
  geracaoImagem: "geracao_imagem",
  geracaoVideo: "geracao_video",
} as const;

export type ChaveConfig = (typeof CHAVES)[keyof typeof CHAVES];

/** Está ligado? (sem linha no banco = ligado) */
export async function estaLigado(chave: ChaveConfig): Promise<boolean> {
  const c = await prisma.configuracao
    .findUnique({ where: { chave }, select: { valor: true } })
    .catch(() => null);
  return c?.valor !== "off";
}

/**
 * A pausa vale pra essa pessoa?
 *
 * A chave de manutenção é o admin desligando a geração PRA GALERA, geralmente
 * quando o robô cai ou a conta desloga. Ele mesmo precisa continuar gerando pra
 * testar quando pode religar, senão ele desliga e fica sem enxergar nada.
 */
export async function podeGerar(chave: ChaveConfig, role?: string | null): Promise<boolean> {
  if (role === "admin") return true;
  return estaLigado(chave);
}

/** Estado das duas chaves de geração de uma vez (usado no painel). */
export async function estadoGeracao(): Promise<{ imagem: boolean; video: boolean }> {
  const linhas = await prisma.configuracao
    .findMany({
      where: { chave: { in: [CHAVES.geracaoImagem, CHAVES.geracaoVideo] } },
      select: { chave: true, valor: true },
    })
    .catch(() => []);
  const off = (c: string) => linhas.find((l) => l.chave === c)?.valor === "off";
  return { imagem: !off(CHAVES.geracaoImagem), video: !off(CHAVES.geracaoVideo) };
}

/** Liga ou desliga uma chave (só admin chama). */
export async function definir(chave: ChaveConfig, ligado: boolean, porEmail?: string) {
  const valor = ligado ? "on" : "off";
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor, atualizadoPor: porEmail ?? null },
    update: { valor, atualizadoPor: porEmail ?? null },
  });
}

/** Mensagem padrão quando a geração está pausada (mesma frase em todas as rotas). */
export const AVISO_PAUSADO =
  "A geração está pausada para manutenção. Volte em alguns minutos, seus créditos estão intactos.";
