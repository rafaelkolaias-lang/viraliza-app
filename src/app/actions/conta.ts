"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/dal";
import { cifrar } from "@/lib/cripto";
import { listarVozesDaChave } from "@/lib/eleven";

export type ContaState = { erro?: string; ok?: boolean } | undefined;

const schema = z
  .object({
    atual: z.string().min(1, "Digite sua senha atual."),
    nova: z.string().min(6, "A nova senha precisa de pelo menos 6 caracteres."),
    confirmar: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.nova === d.confirmar, {
    message: "As duas senhas não conferem.",
    path: ["confirmar"],
  });

/** Troca a senha do usuário logado (confere a senha atual antes). */
export async function trocarSenha(
  _prev: ContaState,
  formData: FormData,
): Promise<ContaState> {
  const user = await requireUser();
  const parsed = schema.safeParse({
    atual: formData.get("atual"),
    nova: formData.get("nova"),
    confirmar: formData.get("confirmar"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { senhaHash: true },
  });
  if (!u) return { erro: "Usuário não encontrado." };

  const confere = await bcrypt.compare(parsed.data.atual, u.senhaHash);
  if (!confere) return { erro: "Senha atual incorreta." };

  await prisma.user.update({
    where: { id: user.id },
    data: { senhaHash: await bcrypt.hash(parsed.data.nova, 12) },
  });
  return { ok: true };
}

/** Salva a chave ElevenLabs do usuário (BYO), cifrada. Valida na ElevenLabs antes. */
export async function salvarChaveEleven(
  _prev: ContaState,
  formData: FormData,
): Promise<ContaState> {
  const user = await requireUser();
  const chave = String(formData.get("chave") ?? "").trim();
  if (chave.length < 20) {
    return { erro: "Cole a chave da ElevenLabs (começa com 'sk_')." };
  }
  // confere se a chave funciona ANTES de salvar (evita guardar chave morta)
  try {
    await listarVozesDaChave(chave);
  } catch {
    return {
      erro: "Essa chave não funcionou na ElevenLabs. Confira e tente de novo.",
    };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { elevenKey: cifrar(chave) },
  });
  revalidatePath("/painel/conta");
  return { ok: true };
}

/** Remove a chave do usuário (volta a usar a plataforma). */
export async function removerChaveEleven(
  _prev: ContaState,
  _formData: FormData,
): Promise<ContaState> {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { elevenKey: null },
  });
  revalidatePath("/painel/conta");
  return { ok: true };
}
