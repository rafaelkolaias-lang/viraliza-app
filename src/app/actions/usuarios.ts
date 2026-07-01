"use server";

import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getCurrentUser } from "@/lib/dal";
import { creditar, debitarClamp } from "@/lib/creditos";

export type UsuarioState =
  | { erro?: string; ok?: boolean; contagem?: number }
  | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const novoUsuarioSchema = z.object({
  nome: z.string().trim().min(2, "Digite o nome."),
  email: z.string().trim().toLowerCase().regex(EMAIL, "E-mail inválido."),
  senha: z.string().min(6, "A senha precisa de pelo menos 6 caracteres."),
  role: z.enum(["admin", "user", "demo"]).default("user"),
});

function revalidarAdmin() {
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin");
}

/** Admin cadastra um usuário na mão (sem precisar que a pessoa se cadastre). */
export async function criarUsuario(
  _prev: UsuarioState,
  formData: FormData,
): Promise<UsuarioState> {
  await requireAdmin();

  const parsed = novoUsuarioSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    role: formData.get("role") || "user",
  });
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const { nome, email, senha, role } = parsed.data;

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) return { erro: "Esse e-mail já está cadastrado." };

  const senhaHash = await bcrypt.hash(senha, 12);
  await prisma.user.create({ data: { nome, email, senhaHash, role } });

  revalidarAdmin();
  return { ok: true };
}

/** Apaga um usuário (e, em cascata, os vídeos dele). SÓ ADMIN. */
export async function excluirUsuario(id: string): Promise<UsuarioState> {
  await requireAdmin();
  if (!id) return { erro: "Usuário inválido." };

  const eu = await getCurrentUser();
  if (eu?.id === id) return { erro: "Você não pode excluir a si mesmo." };

  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) return { erro: "Usuário não encontrado." };

  // não deixa apagar o último admin (senão ninguém mais administra)
  if (alvo.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) return { erro: "Não dá pra excluir o último admin." };
  }

  // limpa em disco os vídeos/uploads dos jobs desse usuário (libera espaço)
  const jobs = await prisma.job.findMany({
    where: { userId: id },
    select: { id: true },
  });
  for (const j of jobs) {
    for (const p of [
      path.join(process.cwd(), "public", "videos", j.id),
      path.join(process.cwd(), "data", "uploads", j.id),
    ]) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {
        /* já sumiu - segue */
      }
    }
  }

  // os jobs somem por cascata (onDelete: Cascade no schema)
  await prisma.user.delete({ where: { id } });

  revalidarAdmin();
  return { ok: true };
}

/** Zera a conta demo: apaga TODOS os vídeos/cortes gerados (arquivos + banco),
 * mas mantém o usuário e as sugestões pré-montadas. SÓ ADMIN. */
export async function resetarDemo(id: string): Promise<UsuarioState> {
  await requireAdmin();
  if (!id) return { erro: "Usuário inválido." };

  const alvo = await prisma.user.findUnique({ where: { id } });
  if (!alvo) return { erro: "Usuário não encontrado." };
  if (alvo.role !== "demo") {
    return { erro: "Reset é só pra contas demo." };
  }

  const jobs = await prisma.job.findMany({
    where: { userId: id },
    select: { id: true },
  });
  for (const j of jobs) {
    for (const p of [
      path.join(process.cwd(), "public", "videos", j.id),
      path.join(process.cwd(), "data", "uploads", j.id),
    ]) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {
        /* já sumiu - segue */
      }
    }
  }
  await prisma.job.deleteMany({ where: { userId: id } });

  revalidarAdmin();
  return { ok: true, contagem: jobs.length };
}

/** Muda o papel de um usuário (admin / user / demo). SÓ ADMIN. */
export async function alterarPapel(
  id: string,
  novoPapel: "admin" | "user" | "demo",
): Promise<UsuarioState> {
  await requireAdmin();
  if (!id) return { erro: "Usuário inválido." };
  if (!["admin", "user", "demo"].includes(novoPapel)) {
    return { erro: "Papel inválido." };
  }

  // se for tirar o último admin do comando, bloqueia
  if (novoPapel !== "admin") {
    const alvo = await prisma.user.findUnique({ where: { id } });
    if (alvo?.role === "admin") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) return { erro: "Precisa existir pelo menos um admin." };
    }
  }

  await prisma.user.update({ where: { id }, data: { role: novoPapel } });
  revalidarAdmin();
  return { ok: true };
}

/** Bloqueia/libera um usuário. Bloqueado = sessão cai na hora e não loga mais
 * (até liberar). SÓ ADMIN. Não dá pra bloquear a si mesmo. */
export async function alterarBloqueio(
  id: string,
  bloquear: boolean,
): Promise<UsuarioState> {
  await requireAdmin();
  if (!id) return { erro: "Usuário inválido." };

  const eu = await getCurrentUser();
  if (eu?.id === id) return { erro: "Você não pode bloquear a si mesmo." };

  await prisma.user.update({ where: { id }, data: { bloqueado: bloquear } });
  revalidarAdmin();
  return { ok: true };
}

/** Libera/tira o acesso à BIBLIOTECA (acervos, virais, produtos, membro). SÓ ADMIN.
 *  Liberar = assinante permanente; tirar = assinante false (perde o acesso na hora). */
export async function alterarBiblioteca(
  id: string,
  liberar: boolean,
): Promise<UsuarioState> {
  await requireAdmin();
  if (!id) return { erro: "Usuário inválido." };
  await prisma.user.update({
    where: { id },
    data: { assinante: liberar, assinaturaAte: null }, // liberar = permanente; tirar = zera
  });
  revalidarAdmin();
  return { ok: true };
}

/** Libera/tira o acesso às FERRAMENTAS de gerar vídeo (editor, cortes, lote, leads).
 *  SÓ ADMIN. Tirar = a pessoa continua logada e vê a biblioteca, mas não gera nada. */
export async function alterarFerramentas(
  id: string,
  liberar: boolean,
): Promise<UsuarioState> {
  await requireAdmin();
  if (!id) return { erro: "Usuário inválido." };
  await prisma.user.update({
    where: { id },
    data: { ferramentasLiberadas: liberar },
  });
  revalidarAdmin();
  return { ok: true };
}

/** Ajusta o crédito de um usuário (admin). creditos > 0 adiciona, < 0 remove.
 *  1 crédito = R$ 0,01, então o valor é em centavos = nº de créditos. */
export async function ajustarCreditoAdmin(
  userId: string,
  creditos: number,
  motivo?: string,
): Promise<{ ok?: boolean; erro?: string }> {
  await requireAdmin();
  const c = Math.round(creditos);
  if (!userId || !Number.isFinite(c) || c === 0) return { erro: "Valor inválido." };
  if (Math.abs(c) > 1_000_000) return { erro: "Valor alto demais (máx 1.000.000)." };
  try {
    if (c > 0) {
      await creditar(userId, c, "ajuste_admin", motivo || "Crédito adicionado pelo admin");
    } else {
      await debitarClamp(userId, -c, "ajuste_admin", {
        descricao: motivo || "Crédito removido pelo admin",
      });
    }
  } catch {
    return { erro: "Não consegui ajustar o crédito." };
  }
  revalidarAdmin();
  return { ok: true };
}
