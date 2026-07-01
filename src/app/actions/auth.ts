"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";
import { cadastroSchema, loginSchema } from "@/lib/auth-schemas";
import { aplicarCreditosPendentes } from "@/lib/creditos";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/ratelimit";

export type AuthState = { erro?: string } | undefined;

// Crédito de boas-vindas: todo cadastro novo já começa com 1.000 créditos (R$ 10,00)
// pra testar a plataforma sem precisar comprar. 1 crédito = R$ 0,01.
const CREDITO_INICIAL = 1000;

// Só quem comprou na Kiwify (qualquer produto) pode criar conta - fecha o farm de
// crédito grátis por bots. O 1º cadastro (dono) e quem tem crédito pendente passam.
async function podeCadastrar(email: string): Promise<boolean> {
  const total = await prisma.user.count();
  if (total === 0) return true; // primeiro usuário = admin (dono da plataforma)
  const e = email.trim().toLowerCase();
  const [acesso, pend] = await Promise.all([
    prisma.acessoPago.findUnique({ where: { email: e } }),
    prisma.creditoPendente.findFirst({ where: { email: e } }),
  ]);
  return !!acesso || !!pend;
}

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

  // gate: precisa ter comprado na Kiwify com este e-mail
  if (!(await podeCadastrar(email))) {
    return {
      erro: "Não achamos uma compra com este e-mail. Faça a compra na Kiwify com o mesmo e-mail e tente de novo (leva alguns segundos após o pagamento).",
    };
  }

  const senhaHash = await bcrypt.hash(senha, 12);
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
