import "server-only";

import { prisma } from "@/lib/prisma";

export type NotificacaoTipo = "video_pronto" | "video_erro" | "admin";
export type AvisoCor = "laranja" | "vermelho" | "azul" | "verde";

export const CORES_AVISO: AvisoCor[] = ["laranja", "vermelho", "azul", "verde"];

export interface NotificacaoDTO {
  id: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  criadoEm: string;
}

export interface AvisoDTO {
  id: string;
  mensagem: string;
  cor: AvisoCor;
  link: string | null;
}

/** Cria uma notificação do sininho pra 1 usuário. */
export async function criarNotificacao(dados: {
  userId: string;
  tipo?: NotificacaoTipo;
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
  loteId?: string | null;
  jobId?: string | null;
}) {
  return prisma.notificacao.create({
    data: {
      userId: dados.userId,
      tipo: dados.tipo ?? "admin",
      titulo: dados.titulo.slice(0, 255),
      mensagem: dados.mensagem?.slice(0, 2000) ?? null,
      link: dados.link?.slice(0, 500) ?? null,
      loteId: dados.loteId ?? null,
      jobId: dados.jobId ?? null,
    },
  });
}

/** Manda a MESMA notificação do sininho pra todos os usuários (fan-out). */
export async function criarNotificacaoTodos(dados: {
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
  loteId: string;
}) {
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) return 0;
  await prisma.notificacao.createMany({
    data: users.map((u) => ({
      userId: u.id,
      tipo: "admin",
      titulo: dados.titulo.slice(0, 255),
      mensagem: dados.mensagem?.slice(0, 2000) ?? null,
      link: dados.link?.slice(0, 500) ?? null,
      loteId: dados.loteId,
    })),
  });
  return users.length;
}

/** Aviso automático: o vídeo do job ficou pronto. Idempotente (não duplica). */
export async function notificarJobPronto(job: {
  id: string;
  userId: string;
  produto: string;
}) {
  const jaTem = await prisma.notificacao.findFirst({
    where: { jobId: job.id, tipo: "video_pronto" },
    select: { id: true },
  });
  if (jaTem) return;
  await criarNotificacao({
    userId: job.userId,
    tipo: "video_pronto",
    titulo: "Seu vídeo ficou pronto!",
    mensagem: `"${job.produto}" terminou de renderizar e já está disponível.`,
    link: `/painel/videos/${job.id}`,
    jobId: job.id,
  });
}

/** Aviso automático: a geração do vídeo falhou. Idempotente (não duplica). */
export async function notificarJobErro(job: {
  id: string;
  userId: string;
  produto: string;
}) {
  const jaTem = await prisma.notificacao.findFirst({
    where: { jobId: job.id, tipo: "video_erro" },
    select: { id: true },
  });
  if (jaTem) return;
  await criarNotificacao({
    userId: job.userId,
    tipo: "video_erro",
    titulo: "Falha ao gerar seu vídeo",
    mensagem: `Não consegui gerar "${job.produto}". Tente de novo ou fale com o suporte.`,
    link: `/painel/videos/${job.id}`,
    jobId: job.id,
  });
}

/** Lista as notificações do usuário + quantas estão não lidas. */
export async function listarNotificacoes(userId: string, limite = 30) {
  const [itens, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { userId },
      orderBy: { criadoEm: "desc" },
      take: limite,
    }),
    prisma.notificacao.count({ where: { userId, lida: false } }),
  ]);
  const dto: NotificacaoDTO[] = itens.map((n) => ({
    id: n.id,
    tipo: n.tipo as NotificacaoTipo,
    titulo: n.titulo,
    mensagem: n.mensagem,
    link: n.link,
    lida: n.lida,
    criadoEm: n.criadoEm.toISOString(),
  }));
  return { itens: dto, naoLidas };
}

/** Marca todas as notificações do usuário como lidas. */
export async function marcarTodasLidas(userId: string) {
  await prisma.notificacao.updateMany({
    where: { userId, lida: false },
    data: { lida: true },
  });
}

/** Barras ativas que se aplicam ao usuário (todos + as direcionadas a ele). */
export async function avisosAtivosPara(userId: string): Promise<AvisoDTO[]> {
  const avisos = await prisma.aviso.findMany({
    where: { ativo: true, OR: [{ alvoUserId: null }, { alvoUserId: userId }] },
    orderBy: { criadoEm: "desc" },
    take: 5,
  });
  return avisos.map((a) => ({
    id: a.id,
    mensagem: a.mensagem,
    cor: (CORES_AVISO.includes(a.cor as AvisoCor) ? a.cor : "azul") as AvisoCor,
    link: a.link,
  }));
}
