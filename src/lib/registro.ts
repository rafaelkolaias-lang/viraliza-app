import "server-only";

import { prisma } from "@/lib/prisma";
import { aplicarCreditosPendentes } from "@/lib/liberacao-creditos";
import {
  ehPacoteDeCredito,
  emailComprou as emailComprouCakto,
  emailComprouEntrada,
} from "@/lib/cakto";
import { emailComprou as emailComprouKiwify } from "@/lib/kiwify";
import { DIAS_ASSINATURA, creditoDaCobranca } from "@/lib/creditos";

/**
 * Regras de criação de conta, compartilhadas pelo cadastro por SENHA e pelo login
 * com GOOGLE. Assim as duas portas de entrada seguem exatamente a mesma trava
 * (só quem comprou cria conta) e o mesmo brinde de boas-vindas.
 */

// Crédito de entrada do plano de R$ 98,90: 4.000 créditos (R$ 40,00) já no
// cadastro, e outros 4.000 a cada renovação paga. 1 crédito = R$ 0,01.
// NÃO depende do gateway: vale igual pra quem pagou no Mercado Pago e pra quem
// entrou pelo link de afiliado da Cakto, que vende o mesmo plano pelo mesmo preço.
export const CREDITO_INICIAL = 4000;

// Crédito de entrada de quem comprou a oferta ANTIGA (R$ 24,90/19,90) e ainda não
// se cadastrou. Recebe o que aquela oferta prometia no cadastro, e nada de mensal
// depois. Em 06/ago/2026 não havia ninguém nesse caso (os 3 e-mails pendentes na
// allowlist eram todos do plano atual), então isto é só rede de segurança.
export const CREDITO_INICIAL_LEGADO = 1000;

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
 */
export async function comprouEntrada(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const acesso = await prisma.acessoPago.findUnique({ where: { email: e } });
  if (acesso && !ehPacoteDeCredito(acesso.produto)) return true;
  return emailComprouEntrada(e);
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

  // A allowlist guarda o pedido que liberou o cadastro, quanto foi pago e se a
  // oferta era vitalícia. Quem manda no brinde é o VALOR, não o gateway: a Cakto
  // vende as mesmas ofertas de hoje (é por onde os afiliados divulgam), então quem
  // entra por lá paga igual e recebe igual. Só a oferta velha de R$ 24,90 cai no
  // brinde antigo.
  const acesso = entrada
    ? await prisma.acessoPago.findUnique({
        where: { email: dados.email.trim().toLowerCase() },
        select: {
          kiwifyOrderId: true,
          produto: true,
          valorCentavos: true,
          vitalicio: true,
        },
      })
    : null;
  const planoNovo = dono || creditoDaCobranca(acesso?.valorCentavos) > 0;
  const brinde = entrada ? (planoNovo ? CREDITO_INICIAL : CREDITO_INICIAL_LEGADO) : 0;
  // assinatura paga no Pix não tem cobrança automática: a marca aqui é o que faz o
  // aviso de vencimento dizer "renove" em vez de "vai renovar sozinho"
  const veioDoPix = /pix/i.test(acesso?.produto ?? "");
  // A entrada é a 1ª cobrança da assinatura mensal: libera 1 ciclo. As renovações
  // pagas estendem esse vencimento pelo webhook; sem repagar, a biblioteca trava.
  // DUAS exceções ficam com vencimento nulo, que o painel lê como "não vence": o
  // dono (admin ignora vencimento de qualquer jeito) e quem comprou a oferta de
  // pagamento único da Cakto (R$ 158,90), que é vitalícia.
  const assinaturaAte =
    !entrada || dono || acesso?.vitalicio
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
      assinaturaPix: entrada && veioDoPix,
      saldoCentavos: brinde,
      // No plano novo os 4.000 saem INTEIROS aqui. Marcar o creditoMensalEm já
      // fecha a segunda porta: sem isso o garantirCreditoMensal soma outro pacote
      // no primeiro acesso ao painel, e a entrada viraria 8.000. O plano antigo é
      // que era partido de propósito (1.000 aqui + 2.000 lá = 3.000), então conta
      // legada continua com o campo nulo pra receber a outra metade.
      ...(planoNovo && entrada ? { creditoMensalEm: new Date() } : {}),
      ...(brinde > 0
        ? {
            transacoes: {
              create: {
                // "bonus_assinatura" amarrado ao pedido que liberou a conta DE
                // PROPÓSITO: este crédito É o do primeiro mês. Sem essa amarra, o
                // webhook do mesmo pagamento chegando atrasado (o MP reenvia)
                // acharia a conta já criada e pagaria os 4.000 de novo.
                tipo: acesso?.kiwifyOrderId ? "bonus_assinatura" : "ajuste_admin",
                valor: brinde,
                saldoApos: brinde,
                kiwifyOrderId: acesso?.kiwifyOrderId ?? null,
                descricao: `Crédito de boas-vindas (${brinde.toLocaleString("pt-BR")} créditos)`,
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
