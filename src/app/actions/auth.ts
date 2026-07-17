"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { cadastroSchema, loginSchema } from "@/lib/auth-schemas";
import { criarContaLiberada, podeCriarConta } from "@/lib/registro";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/ratelimit";

export type AuthState = { erro?: string } | undefined;

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

  // anti-spam: no máx 5 cadastros por IP por hora
  const ip = await ipDaRequisicao();
  if (!(await dentroDoLimite(`signup:${ip}`, 5, 3600))) {
    return { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) return { erro: "Esse e-mail já está cadastrado." };

  // gate: precisa ter comprado com este e-mail
  if (!(await podeCriarConta(email))) {
    return {
      erro: "Não achamos uma compra com este e-mail. Faça a compra com o mesmo e-mail e tente de novo (leva alguns segundos após o pagamento).",
    };
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  const user = await criarContaLiberada({ nome, email, senhaHash });

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

  // anti-brute-force: limita por IP e por e-mail
  const ip = await ipDaRequisicao();
  const [okIp, okEmail] = await Promise.all([
    dentroDoLimite(`login-ip:${ip}`, 25, 300),
    dentroDoLimite(`login-email:${email}`, 10, 900),
  ]);
  if (!okIp || !okEmail) {
    return { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // senhaHash null = conta criada só com Google -> não entra por senha
  if (!user || !user.senhaHash) {
    if (user && !user.senhaHash) {
      return { erro: "Essa conta entra com o Google. Use o botão \"Entrar com Google\"." };
    }
    return { erro: "E-mail ou senha incorretos." };
  }
  if (!(await bcrypt.compare(senha, user.senhaHash))) {
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
