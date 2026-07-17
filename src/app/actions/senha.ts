"use server";

import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { enviarEmail, htmlResetSenha } from "@/lib/email";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/ratelimit";

export type ResetState = { erro?: string; ok?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BASE = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");
const VALIDADE_MIN = 30;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

// Mensagem NEUTRA (não revela se o e-mail existe) - padrão de segurança.
const MSG_NEUTRA =
  "Se existir uma conta com este e-mail, enviamos um link pra redefinir a senha. Confira sua caixa de entrada e o spam.";

/** Pede o link de redefinição: gera token, salva o hash e manda o e-mail. */
export async function solicitarReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { erro: "E-mail inválido." };

  // anti-abuso: por IP e por e-mail
  const ip = await ipDaRequisicao();
  const [okIp, okEmail] = await Promise.all([
    dentroDoLimite(`reset-ip:${ip}`, 5, 3600),
    dentroDoLimite(`reset-email:${email}`, 3, 3600),
  ]);
  if (!okIp || !okEmail) {
    return { erro: "Muitas tentativas. Aguarde alguns minutos e tente de novo." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // só manda de fato se a conta existir; a resposta é sempre neutra do mesmo jeito
  if (user) {
    const token = randomBytes(32).toString("hex");
    await prisma.passwordReset.create({
      data: {
        email,
        tokenHash: hashToken(token),
        expiraEm: new Date(Date.now() + VALIDADE_MIN * 60_000),
      },
    });
    const link = `${BASE}/nova-senha?token=${token}`;
    await enviarEmail({
      para: email,
      assunto: "Redefinir sua senha - Viraliza",
      html: htmlResetSenha(link),
    });
  }

  return { ok: MSG_NEUTRA };
}

/** Redefine a senha a partir do token do link. Redireciona pro login ao concluir. */
export async function redefinirSenha(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") || "");
  const senha = String(formData.get("senha") || "");
  if (!token) return { erro: "Link inválido. Peça um novo." };
  if (senha.length < 8) return { erro: "A senha precisa de pelo menos 8 caracteres." };

  const reg = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!reg || reg.usado || reg.expiraEm.getTime() < Date.now()) {
    return { erro: "Link inválido ou expirado. Peça um novo." };
  }

  const user = await prisma.user.findUnique({ where: { email: reg.email } });
  if (!user) return { erro: "Conta não encontrada." };

  const senhaHash = await bcrypt.hash(senha, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { senhaHash } }),
    prisma.passwordReset.update({ where: { id: reg.id }, data: { usado: true } }),
    // invalida outros pedidos pendentes do mesmo e-mail
    prisma.passwordReset.updateMany({
      where: { email: reg.email, usado: false },
      data: { usado: true },
    }),
  ]);

  redirect("/login?reset=ok");
}
