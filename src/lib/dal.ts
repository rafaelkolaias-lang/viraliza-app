import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/** Usuário logado (ou null). Cacheado por request.
 * Se a conta estiver BLOQUEADA, trata como não logado - a sessão "cai" na hora
 * (toda navegação/refresh checa isso) e só volta quando o admin tirar a flag. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: String(session.userId) },
    select: { id: true, nome: true, email: true, role: true, bloqueado: true },
  });
  if (!user || user.bloqueado) return null;
  // não expõe o campo interno pra fora
  return { id: user.id, nome: user.nome, email: user.email, role: user.role };
});

/** Exige login - redireciona pro /login se não houver. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Exige admin - redireciona pro /painel se não for. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/painel");
  return user;
}

/** Exige assinatura ativa pra liberar a BIBLIOTECA. Admin e demo passam direto.
 *  Sem assinatura, manda pra página de créditos com aviso. */
export async function requireAssinatura() {
  const user = await requireUser();
  if (user.role === "admin" || user.role === "demo") return user;
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { assinante: true, assinaturaAte: true },
  });
  const ativa =
    !!u?.assinante &&
    (!u.assinaturaAte || u.assinaturaAte.getTime() > Date.now());
  if (!ativa) redirect("/painel/creditos?bloqueio=biblioteca");
  return user;
}
