import "server-only";

import { prisma } from "@/lib/prisma";
import {
  mpOrderId,
  pagamentoAprovado,
  pagamentoDeAssinatura,
  pagamentoEstornado,
  type PagamentoMP,
} from "@/lib/mercadopago";
import {
  CREDITO_MENSAL_CENTAVOS,
  DIAS_ASSINATURA,
  estenderAssinatura,
  existeTransacaoOrder,
  lancar,
} from "@/lib/creditos";
import { creditarCompra } from "@/lib/liberacao-creditos";
import { aplicarReembolsoAceito, restaurarSuspensao } from "@/lib/reembolsos";
import { enviarCompraMeta, enviarReembolsoMeta } from "@/lib/meta-capi";
import { enviarBoasVindas, enviarCreditosConfirmados } from "@/lib/email";

/**
 * Processa um pagamento do Mercado Pago (já CONFIRMADO na API - quem chama é
 * responsável por ter usado buscarPagamento). Um caminho só, IDEMPOTENTE, usado
 * por DOIS gatilhos:
 *
 *  - o webhook (produção, caminho principal);
 *  - a consulta de status da tela do checkout (o "caiu na hora" do Pix, e a
 *    rede de segurança quando o webhook atrasa ou não chega).
 *
 * Rodar duas vezes não duplica nada: cada efeito tem guarda por pedido.
 */
export async function processarPagamentoMP(p: PagamentoMP) {
  const orderId = mpOrderId(p.id);
  const email = p.email ?? "";

  // ---- ESTORNO / CHARGEBACK ----
  if (pagamentoEstornado(p)) {
    const r = await aplicarReembolsoAceito(
      {
        id: orderId,
        status: p.status === "charged_back" ? "chargedback" : "refunded",
        net_amount: p.liquidoCentavos,
        payment: { charge_amount: p.valorCentavos },
        customer: { email, full_name: p.nome, mobile: p.telefone },
        product: { name: p.descricao ?? "Viraliza Créditos" },
      },
      orderId,
    );
    await enviarReembolsoMeta({
      orderId,
      email,
      telefone: p.telefone,
      nome: p.nome,
      valorCentavos: p.liquidoCentavos,
      produto: p.descricao,
    });
    return { reembolso: r };
  }

  if (!pagamentoAprovado(p)) return { ignorado: `status ${p.status}` };

  // ---- APROVADO ----

  // Assinatura no cartão começa com uma cobrança de VALIDAÇÃO de R$ 0
  // ("Recurring payment validation", operation_type card_validation): o MP só
  // confere se o cartão aceita. Ela é aprovada de verdade e libera o cadastro,
  // mas NÃO é a compra, então não pode definir valor nem nome de produto. Foi
  // exatamente isso que fez uma conta nascer com 1.000 em vez de 4.000: o zero
  // ficou gravado e o cadastro leu como oferta antiga.
  const ehValidacaoCartao = p.valorCentavos <= 0;
  const valorDaCompra = ehValidacaoCartao ? null : p.valorCentavos;
  const nomeDoProduto = ehValidacaoCartao ? "Assinatura Viraliza" : (p.descricao ?? null);

  // e-mail pagante entra na allowlist de cadastro (mesma regra da Cakto)
  if (email) {
    // é a 1ª vez que este e-mail paga? define se manda as boas-vindas
    const jaTinhaAcesso = await prisma.acessoPago.findUnique({ where: { email } });
    await prisma.acessoPago.upsert({
      where: { email },
      create: {
        email,
        kiwifyOrderId: orderId,
        produto: nomeDoProduto,
        // guarda o valor pago: é ele que define o crédito de entrada no cadastro
        valorCentavos: valorDaCompra,
      },
      update: {},
    });

    // A linha pode ter nascido da validação de R$ 0, sem valor. Quando a cobrança
    // de verdade chega, preenche. Só preenche o que está VAZIO: sobrescrever
    // sempre faria uma compra de pacote depois apagar o valor da assinatura.
    if (jaTinhaAcesso && valorDaCompra != null && jaTinhaAcesso.valorCentavos == null) {
      await prisma.acessoPago.update({
        where: { email },
        data: { valorCentavos: valorDaCompra, kiwifyOrderId: orderId },
      });
    }
    await restaurarSuspensao(orderId);

    // Boas-vindas com o link do cadastro. Sem isto, quem compra pelo Mercado Pago
    // paga e não recebe nada (só a Cakto mandava), e a tela de confirmação promete
    // esse e-mail. Só vai pra quem AINDA NÃO TEM CONTA: o texto é "crie sua conta",
    // e mandar isso pra cliente antigo comprando pacote é confuso.
    if (!jaTinhaAcesso) {
      const jaTemConta = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!jaTemConta) {
        try {
          await enviarBoasVindas({ para: email, nome: p.nome, produto: nomeDoProduto });
        } catch (e) {
          console.error("[mp] falha ao enviar boas-vindas", orderId, e);
        }
      }
    }
  }

  // Meta CAPI: Purchase com o valor líquido; event_id = orderId (não duplica)
  await enviarCompraMeta({
    orderId,
    email,
    telefone: p.telefone,
    nome: p.nome,
    valorCentavos: p.liquidoCentavos,
    produto: p.descricao,
  });

  // validação de cartão não é compra: não credita, não estende, não vira pacote
  if (ehValidacaoCartao) return { ignorado: "validação de cartão (R$ 0)" };

  // ---- COBRANÇA DE ASSINATURA -> crédito mensal + 1 mês (regra da Cakto) ----
  if (pagamentoDeAssinatura(p)) {
    if (await existeTransacaoOrder(orderId, "bonus_assinatura")) {
      return { jaProcessado: true };
    }
    const assinante =
      (p.userId ? await prisma.user.findUnique({ where: { id: p.userId } }) : null) ??
      (email ? await prisma.user.findUnique({ where: { email } }) : null);
    if (!assinante) return { ignorado: "assinatura sem usuário" };

    // O ciclo já foi entregue no cadastro? Acontece sempre que a pessoa se
    // cadastra ANTES da primeira cobrança cair (que é o normal: ela paga, o
    // cadastro libera na hora e a cobrança de verdade chega depois). O cadastro
    // já deu os 4.000 e os 33 dias; creditar aqui de novo daria 8.000 e 66 dias
    // por um pagamento só. Renovação legítima vem ~33 dias depois, bem fora
    // desta janela.
    const CICLO_MIN_MS = 25 * DIA_MS;
    if (
      assinante.creditoMensalEm &&
      Date.now() - assinante.creditoMensalEm.getTime() < CICLO_MIN_MS
    ) {
      return { jaProcessado: true, motivo: "ciclo já entregue no cadastro" };
    }

    await lancar(assinante.id, CREDITO_MENSAL_CENTAVOS, "bonus_assinatura", {
      descricao: "Crédito mensal da assinatura (renovação paga)",
      kiwifyOrderId: orderId,
    });
    await estenderAssinatura(assinante.id, DIAS_ASSINATURA);
    await prisma.user.update({
      where: { id: assinante.id },
      data: { creditoMensalEm: new Date() },
    });
    return { renovacao: true, creditado: CREDITO_MENSAL_CENTAVOS, userId: assinante.id };
  }

  // ---- UM MÊS DE ASSINATURA PAGO NO PIX ----
  // Chega como pagamento avulso (o Pix não tem recorrência), então SEM esta guarda
  // os R$ 98,90 cairiam na regra de pacote e virariam 9.890 créditos.
  if (p.tipo === "assinatura_pix") {
    if (await existeTransacaoOrder(orderId, "bonus_assinatura")) {
      return { jaProcessado: true };
    }
    const assinante =
      (p.userId ? await prisma.user.findUnique({ where: { id: p.userId } }) : null) ??
      (email ? await prisma.user.findUnique({ where: { email } }) : null);

    // ainda não tem conta: veio da página pública. O acesso já foi liberado na
    // allowlist logo acima, com o produto "Assinatura Viraliza (Pix)"; o crédito de
    // entrada e os 33 dias entram no cadastro (criarContaLiberada), que também lê o
    // "Pix" do nome do produto pra marcar a conta como renovação manual.
    if (!assinante) return { pendente: true, email };

    await lancar(assinante.id, CREDITO_MENSAL_CENTAVOS, "bonus_assinatura", {
      descricao: "Crédito mensal da assinatura (renovação no Pix)",
      kiwifyOrderId: orderId,
    });
    await estenderAssinatura(assinante.id, DIAS_ASSINATURA);
    await prisma.user.update({
      where: { id: assinante.id },
      data: {
        creditoMensalEm: new Date(),
        assinaturaPix: true,
        // pagou de novo: se tinha cancelado o cartão antes, deixou de ser "acabando"
        mpAssinaturaCanceladaEm: null,
      },
    });
    return { renovacao: true, creditado: CREDITO_MENSAL_CENTAVOS, userId: assinante.id };
  }

  // ---- PACOTE DE CRÉDITO ----
  // créditos = valor PAGO em centavos (da API, não do payload): à prova de forja
  const creditos = p.valorCentavos;
  if (creditos <= 0) return { ignorado: "valor zerado" };
  if (await existeTransacaoOrder(orderId, "compra")) return { jaProcessado: true };

  // 1º pelo vínculo direto (usuário logado que abriu o checkout); e-mail é fallback
  const user =
    (p.userId ? await prisma.user.findUnique({ where: { id: p.userId } }) : null) ??
    (email ? await prisma.user.findUnique({ where: { email } }) : null);

  const desc = `Compra Mercado Pago: ${p.descricao || "créditos"}`;

  if (user) {
    const { saldoApos } = await creditarCompra(user.id, creditos, {
      descricao: desc,
      orderId,
    });
    try {
      await enviarCreditosConfirmados({
        para: user.email,
        nome: p.nome,
        creditos,
        saldoApos,
        produto: p.descricao,
      });
    } catch (e) {
      console.error("[mp] falha ao enviar e-mail de créditos", orderId, e);
    }
    return { creditado: creditos, userId: user.id };
  }

  // pagou sem conta (link compartilhado): guarda pra aplicar no cadastro
  if (email) {
    await prisma.creditoPendente.upsert({
      where: { kiwifyOrderId: orderId },
      create: {
        email,
        valorCentavos: creditos,
        kiwifyOrderId: orderId,
        assinaturaDias: 0,
        descricao: desc,
      },
      update: {},
    });
    return { pendente: true, email };
  }
  return { ignorado: "sem usuário e sem e-mail" };
}

const DIA_MS = 86_400_000;

/**
 * Assinatura AUTORIZADA (método de pagamento vinculado): liga o acesso.
 *
 * A extensão de verdade (33 dias) e o crédito mensal vêm da COBRANÇA paga, no
 * processarPagamentoMP. Aqui só entra uma carência de 3 dias pra conta que
 * nunca assinou, senão ela ficaria com `assinante` ligado e vencimento nulo,
 * que o painel lê como acesso PERMANENTE.
 */
export async function ativarAssinaturaMP(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { assinaturaAte: true },
  });
  if (!u) return;
  const vence = u.assinaturaAte?.getTime() ?? 0;
  await prisma.user.update({
    where: { id: userId },
    data: {
      assinante: true,
      ...(vence > Date.now() ? {} : { assinaturaAte: new Date(Date.now() + 3 * DIA_MS) }),
    },
  });
}
