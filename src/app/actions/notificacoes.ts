"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  CORES_AVISO,
  criarNotificacao,
  criarNotificacaoTodos,
} from "@/lib/notificacoes";

export type ComunicadoState =
  | { erro?: string; ok?: boolean; enviados?: number }
  | undefined;

const schema = z
  .object({
    tipo: z.enum(["sininho", "barra"]),
    destino: z.string().trim().min(1), // "todos" ou um userId
    titulo: z.string().trim().max(255).optional(),
    mensagem: z.string().trim().min(2, "Escreva a mensagem.").max(2000),
    cor: z.enum(["laranja", "vermelho", "azul", "verde"]).optional(),
    link: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.tipo !== "sininho" || (d.titulo && d.titulo.length >= 2), {
    message: "Escreva um título pra notificação do sininho.",
    path: ["titulo"],
  });

function revalidar() {
  revalidatePath("/admin/notificacoes");
}

/** Normaliza o link: aceita URL externa (http) ou caminho interno (/painel/...). */
function limparLink(link?: string) {
  const l = (link ?? "").trim();
  if (!l) return null;
  if (/^https?:\/\//i.test(l) || l.startsWith("/")) return l.slice(0, 500);
  return `https://${l}`.slice(0, 500);
}

/** Admin cria um comunicado: sininho (pra 1 usuário ou todos) ou barra do topo. */
export async function criarComunicado(
  _prev: ComunicadoState,
  formData: FormData,
): Promise<ComunicadoState> {
  await requireAdmin();

  const parsed = schema.safeParse({
    tipo: formData.get("tipo"),
    destino: formData.get("destino"),
    titulo: formData.get("titulo") || undefined,
    mensagem: formData.get("mensagem"),
    cor: formData.get("cor") || undefined,
    link: formData.get("link") || undefined,
  });
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const { tipo, destino, titulo, mensagem, cor, link } = parsed.data;
  const linkLimpo = limparLink(link);

  // valida o destino específico (se não for "todos")
  let alvoUserId: string | null = null;
  if (destino !== "todos") {
    const existe = await prisma.user.findUnique({
      where: { id: destino },
      select: { id: true },
    });
    if (!existe) return { erro: "Usuário de destino não encontrado." };
    alvoUserId = destino;
  }

  if (tipo === "barra") {
    await prisma.aviso.create({
      data: {
        mensagem,
        cor: CORES_AVISO.includes((cor ?? "azul") as never) ? (cor ?? "azul") : "azul",
        link: linkLimpo,
        alvoUserId,
        ativo: true,
      },
    });
    revalidar();
    return { ok: true };
  }

  // sininho
  if (alvoUserId) {
    await criarNotificacao({
      userId: alvoUserId,
      tipo: "admin",
      titulo: titulo!,
      mensagem,
      link: linkLimpo,
    });
    revalidar();
    return { ok: true, enviados: 1 };
  }

  const n = await criarNotificacaoTodos({
    titulo: titulo!,
    mensagem,
    link: linkLimpo,
    loteId: randomUUID(),
  });
  revalidar();
  return { ok: true, enviados: n };
}

/** Liga/desliga uma barra (desligada some do topo de todo mundo). */
export async function alterarAtivoAviso(
  id: string,
  ativo: boolean,
): Promise<ComunicadoState> {
  await requireAdmin();
  if (!id) return { erro: "Aviso inválido." };
  await prisma.aviso.update({ where: { id }, data: { ativo } });
  revalidar();
  return { ok: true };
}

/** Apaga uma barra de vez. */
export async function excluirAviso(id: string): Promise<ComunicadoState> {
  await requireAdmin();
  if (!id) return { erro: "Aviso inválido." };
  await prisma.aviso.delete({ where: { id } }).catch(() => {});
  revalidar();
  return { ok: true };
}

/** Apaga um envio do sininho feito pra todos (remove de todos os usuários). */
export async function excluirLoteNotificacao(
  loteId: string,
): Promise<ComunicadoState> {
  await requireAdmin();
  if (!loteId) return { erro: "Envio inválido." };
  const r = await prisma.notificacao.deleteMany({ where: { loteId } });
  revalidar();
  return { ok: true, enviados: r.count };
}
