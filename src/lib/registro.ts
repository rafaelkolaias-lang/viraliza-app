import "server-only";

import { prisma } from "@/lib/prisma";
import { aplicarCreditosPendentes } from "@/lib/creditos";
import { emailComprou as emailComprouCakto } from "@/lib/cakto";
import { emailComprou as emailComprouKiwify } from "@/lib/kiwify";

/**
 * Regras de criação de conta, compartilhadas pelo cadastro por SENHA e pelo login
 * com GOOGLE. Assim as duas portas de entrada seguem exatamente a mesma trava
 * (só quem comprou cria conta) e o mesmo brinde de boas-vindas.
 */

// Crédito de boas-vindas: todo cadastro novo já começa com 1.000 créditos (R$ 10,00)
// pra testar a plataforma sem precisar comprar. 1 crédito = R$ 0,01.
export const CREDITO_INICIAL = 1000;

/**
 * Pode criar conta com este e-mail? Só quem comprou (qualquer produto) passa - fecha
 * o farm de crédito grátis por bots. O 1º cadastro (dono) e quem tem crédito pendente
 * passam. Rede de segurança: confirma AO VIVO na Cakto (Kiwify de fallback) se o
 * webhook atrasar; se achar compra, grava a allowlist e libera.
 */
export async function podeCriarConta(email: string): Promise<boolean> {
  const total = await prisma.user.count();
  if (total === 0) return true; // primeiro usuário = admin (dono da plataforma)
  const e = email.trim().toLowerCase();
  const [acesso, pend] = await Promise.all([
    prisma.acessoPago.findUnique({ where: { email: e } }),
    prisma.creditoPendente.findFirst({ where: { email: e } }),
  ]);
  if (acesso || pend) return true;

  const ck = await emailComprouCakto(e);
  const compra = ck.comprou ? ck : await emailComprouKiwify(e);
  if (compra.comprou) {
    await prisma.acessoPago.upsert({
      where: { email: e },
      create: {
        email: e,
        kiwifyOrderId: compra.orderId ?? "manual",
        produto: compra.produto ?? null,
      },
      update: {},
    });
    return true;
  }
  return false;
}

/**
 * Cria a conta já liberada (assinante permanente + 1.000 créditos de boas-vindas) e
 * aplica créditos pendentes de compras feitas antes do cadastro (mesmo e-mail).
 * Não checa a trava aqui - quem chama já validou com podeCriarConta.
 * `senhaHash` null = conta só com Google; `googleId` liga a conta ao Google.
 */
export async function criarContaLiberada(dados: {
  nome: string;
  email: string;
  senhaHash?: string | null;
  googleId?: string | null;
}) {
  const total = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      senhaHash: dados.senhaHash ?? null,
      googleId: dados.googleId ?? null,
      // O primeiro a se cadastrar vira ADMIN (o dono da plataforma).
      role: total === 0 ? "admin" : "user",
      // Todo cadastro já passou pela trava (comprou), então já nasce assinante:
      // libera a biblioteca na hora. assinaturaAte = null => permanente.
      assinante: true,
      assinaturaAte: null,
      saldoCentavos: CREDITO_INICIAL,
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

  // se a pessoa comprou ANTES de se cadastrar, aplica os créditos agora
  try {
    await aplicarCreditosPendentes(user.id, dados.email);
  } catch {
    // não trava o cadastro se algo falhar aqui; o webhook/admin pode reprocessar
  }

  return user;
}
