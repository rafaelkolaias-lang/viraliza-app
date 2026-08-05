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

/** Assinatura ativa? Versão que NÃO redireciona - pra usar em rota de API, onde
 *  o certo é responder 403 em vez de mandar pra outra página. Admin e demo contam
 *  como ativa, igual ao requireAssinatura. */
export async function assinaturaAtiva(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === "admin" || user.role === "demo") return true;
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { assinante: true, assinaturaAte: true },
  });
  return !!u?.assinante && (!u.assinaturaAte || u.assinaturaAte.getTime() > Date.now());
}

/** Exige assinatura ativa pra liberar a BIBLIOTECA. Admin e demo passam direto.
 *  Sem assinatura, manda pra aba de ASSINATURA (é ela que libera a biblioteca,
 *  não o crédito). (Uso legado; as PÁGINAS da biblioteca usam `guardaBiblioteca`
 *   pra mostrar o erro na tela em vez de desviar. Ainda serve pras server actions.) */
export async function requireAssinatura() {
  const user = await requireUser();
  if (!(await assinaturaAtiva(user))) redirect("/painel/assinatura");
  return user;
}

/** Guarda das PÁGINAS da biblioteca SEM redirect: devolve o user e se está liberado.
 *  A página mostra `<BibliotecaBloqueada/>` no lugar do conteúdo quando `liberado`
 *  é false, então a pessoa vê o aviso onde clicou em vez de ser jogada pra outra
 *  tela. Admin e demo entram sempre (`assinaturaAtiva`). */
export async function guardaBiblioteca() {
  const user = await requireUser();
  const liberado = await assinaturaAtiva(user);
  return { user, liberado };
}

/** Ferramentas de geração (editor, cortes, em lote, leads) liberadas pra este user?
 *  Admin passa sempre. O admin pode cortar isso de qualquer um a qualquer momento. */
export async function ferramentasLiberadas(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { ferramentasLiberadas: true },
  });
  return u?.ferramentasLiberadas ?? true;
}
