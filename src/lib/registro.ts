import "server-only";

import { prisma } from "@/lib/prisma";
import { aplicarCreditosPendentes } from "@/lib/liberacao-creditos";
import {
  ehPacoteDeCredito,
  emailComprou as emailComprouCakto,
  emailComprouEntrada,
} from "@/lib/cakto";
import { emailComprou as emailComprouKiwify } from "@/lib/kiwify";
import { DIAS_ASSINATURA } from "@/lib/creditos";
import { registrarErroApp } from "@/lib/erros-app";

/**
 * Regras de criação de conta, compartilhadas pelo cadastro por SENHA e pelo login
 * com GOOGLE. Assim as duas portas de entrada seguem exatamente a mesma trava
 * (só quem comprou cria conta) e o mesmo brinde de boas-vindas.
 */

// Crédito de boas-vindas: DESLIGADO pelo dono em 06/08/2026. Era 1.000 créditos
// (R$ 10,00) pra todo cadastro novo que tivesse comprado a entrada.
// Os outros dois brindes CONTINUAM VALENDO: o mensal da assinatura
// (`CREDITO_MENSAL_CENTAVOS`) e o bônus de seguir o Instagram
// (`BONUS_IG_CREDITOS`). Só o de boas-vindas acabou.
// Fica em 0 e não em código apagado de propósito: o caminho inteiro continua de
// pé, então voltar a dar brinde é trocar este número. Com 0 o cadastro não cria
// transação nenhuma (o `brinde > 0` abaixo cuida disso).
// 1 crédito = R$ 0,01.
export const CREDITO_INICIAL = 0;

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
 * Comprou o PLANO DE ENTRADA, e não só um pacote de crédito?
 *
 * Só a entrada libera a biblioteca (assinante permanente) e o crédito de boas-vindas.
 * Antes, qualquer compra dava as duas coisas, então dava pra pular a entrada: comprava
 * o pacote mais barato (R$10), cadastrava com o mesmo e-mail e ficava com a biblioteca
 * pra sempre mais 1.000 créditos de brinde, ou seja, R$20 em crédito por R$10 pagos
 * (auditoria.md #4).
 *
 * Decisão nesta ordem:
 * 1. A allowlist guarda o NOME do produto que liberou o cadastro. Nome que não é de
 *    pacote ("N Créditos") = entrada.
 * 2. Se for pacote, ainda pode ter comprado a entrada em outro pedido: confere ao vivo.
 * 3. Nome desconhecido conta como entrada. Não dá pra provar que foi pacote, e barrar
 *    cliente legítimo é pior que o risco: a compra de pacote sempre traz o nome dela.
 * 4. Consulta ao vivo FALHOU (API fora, mesmo depois das tentativas): vale a mesma
 *    régua do item 3 - na dúvida, entrada (auditoria #15). Antes o erro virava "não
 *    comprou" e o cliente da entrada nascia sem biblioteca, sem ninguém saber.
 *    Fica anotado no Diagnóstico pro dono conferir depois.
 */
export async function comprouEntrada(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const acesso = await prisma.acessoPago.findUnique({ where: { email: e } });
  if (acesso && !ehPacoteDeCredito(acesso.produto)) return true;
  const aoVivo = await emailComprouEntrada(e);
  if (aoVivo === null) {
    registrarErroApp({
      area: "outro",
      mensagem: `Cadastro de ${e}: a consulta à Cakto falhou e a conta foi liberada como ENTRADA por precaução. Confira na Cakto se a compra era só pacote.`,
    });
    return true;
  }
  return aoVivo;
}

/**
 * Cria a conta e aplica os créditos pendentes de compras feitas antes do cadastro
 * (mesmo e-mail). Não checa a trava aqui - quem chama já validou com podeCriarConta.
 * `senhaHash` null = conta só com Google; `googleId` liga a conta ao Google.
 *
 * Quem comprou a ENTRADA nasce assinante permanente com o crédito de boas-vindas.
 * Quem comprou só pacote de crédito entra sem biblioteca e sem brinde: recebe apenas
 * os créditos que pagou (aplicados logo abaixo).
 */
export async function criarContaLiberada(dados: {
  nome: string;
  email: string;
  senhaHash?: string | null;
  googleId?: string | null;
}) {
  const total = await prisma.user.count();
  const dono = total === 0; // o primeiro a se cadastrar é o dono da plataforma
  const entrada = dono || (await comprouEntrada(dados.email));
  const brinde = entrada ? CREDITO_INICIAL : 0;
  // A entrada é a 1ª cobrança da assinatura mensal: libera 1 ciclo. As renovações
  // pagas estendem esse vencimento pelo webhook; sem repagar, a biblioteca trava.
  // O dono (admin) fica permanente (role admin ignora o vencimento de qualquer forma).
  const assinaturaAte = !entrada
    ? null
    : dono
      ? null
      : new Date(Date.now() + DIAS_ASSINATURA * 86_400_000);
  const user = await prisma.user.create({
    data: {
      nome: dados.nome,
      email: dados.email,
      senhaHash: dados.senhaHash ?? null,
      googleId: dados.googleId ?? null,
      role: dono ? "admin" : "user",
      // Assinatura só pra quem comprou a entrada, e agora com VENCIMENTO (não é mais
      // permanente): vale DIAS_ASSINATURA e depende de renovação paga pra continuar.
      assinante: entrada,
      assinaturaAte,
      saldoCentavos: brinde,
      ...(brinde > 0
        ? {
            transacoes: {
              create: {
                tipo: "ajuste_admin",
                valor: brinde,
                saldoApos: brinde,
                descricao: `Crédito de boas-vindas (${CREDITO_INICIAL} créditos)`,
              },
            },
          }
        : {}),
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
