"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { cadastroSchema, loginSchema } from "@/lib/auth-schemas";
import { aplicarCreditosPendentes } from "@/lib/creditos";

export type AuthState = { erro?: string } | undefined;

// Crédito de boas-vindas: todo cadastro novo já começa com 1.000 créditos (R$ 10,00)
// pra testar a plataforma sem precisar comprar. 1 crédito = R$ 0,01.
const CREDITO_INICIAL = 1000;

export async function cadastrar(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = cadastroSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const { nome, email, senha } = parsed.data;

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) return { erro: "Esse e-mail já está cadastrado." };

  const senhaHash = await bcrypt.hash(senha, 10);
  // O primeiro a se cadastrar vira ADMIN (o dono da plataforma).
  const total = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      nome,
      email,
      senhaHash,
      role: total === 0 ? "admin" : "user",
      saldoCentavos: CREDITO_INICIAL,
      // registra o crédito de boas-vindas no extrato pra o saldo bater
      transacoes: {
        create: {
          tipo: "ajuste_admin",
          valor: CREDITO_INICIAL,
          saldoApos: CREDITO_INICIAL,
          descricao: "Crédito de boas-vindas (1.000 créditos)",
        },
      },
    },
  });

  // se a pessoa comprou na Kiwify ANTES de se cadastrar, aplica os créditos agora
  try {
    await aplicarCreditosPendentes(user.id, email);
  } catch {
    // não trava o cadastro se algo falhar aqui; o webhook/admin pode reprocessar
  }

  await createSession(user.id, user.role);
  redirect("/painel");
}

export async function entrar(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0].message };

  const { email, senha } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(senha, user.senhaHash))) {
    return { erro: "E-mail ou senha incorretos." };
  }
  if (user.bloqueado) {
    return { erro: "Acesso suspenso. Fale com o suporte." };
  }

  await createSession(user.id, user.role);
  redirect("/painel");
}

export async function sair() {
  await deleteSession();
  redirect("/login");
}
