import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Carteira de crédito (produção) + assinatura (biblioteca) - modelo "2 em 1".
 * O crédito é guardado SEMPRE em CENTAVOS de R$ (Int), pra não ter erro de float.
 */

// Crédito mensal de brinde da assinatura. Definido pelo dono em 06/08/2026:
// 3.000 créditos = R$ 30,00/mês de custo de API, numa mensalidade de R$ 98,90.
// Os brindes que existem hoje são DOIS: este mensal e o bônus de seguir o
// Instagram (`BONUS_IG_CREDITOS` em `lib/promos.ts`, 300, uma vez por conta).
// O crédito de boas-vindas do cadastro foi desligado na mesma data
// (`CREDITO_INICIAL` em `lib/registro.ts`).
export const CREDITO_MENSAL_CENTAVOS = 3000;

// Quanto tempo cada pagamento (entrada + cada renovação paga) libera a biblioteca.
// A assinatura NÃO é mais permanente: se a cobrança mensal não for repaga, ela vence
// e a biblioteca trava (o crédito comprado continua valendo). São 30 dias do ciclo +
// 3 de folga, pra uma renovação que chega um pouco atrasada não cortar quem pagou.
export const DIAS_ASSINATURA = 33;

export type TipoTransacao =
  | "compra"
  | "debito_geracao"
  | "debito_processamento"
  | "bonus_assinatura"
  | "bonus_instagram" // +300 por seguir o Instagram (liberado pelo admin)
  | "ajuste_admin"
  | "estorno"
  | "suspensao_reembolso" // reembolso SOLICITADO: congela (zera) o saldo até a decisão
  | "reversao_suspensao" // reembolso cancelado/decidido: devolve o que foi congelado
  | "liberacao_garantia" // crédito comprado que estava em quarentena e destravou (8º dia)
  | "quitacao_divida"; // abate do saldo devedor deixado por um reembolso com crédito já gasto

/** Já existe uma transação desse tipo pra esse pedido Kiwify? (idempotência). */
export async function existeTransacaoOrder(
  kiwifyOrderId: string,
  tipo: TipoTransacao,
): Promise<boolean> {
  const t = await prisma.creditoTransacao.findFirst({
    where: { kiwifyOrderId, tipo },
    select: { id: true },
  });
  return !!t;
}

const DIA_MS = 86_400_000;

/** Estende a assinatura a partir do maior entre agora e o vencimento atual. */
export async function estenderAssinatura(userId: string, dias: number) {
  if (dias <= 0) return;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { assinaturaAte: true },
  });
  const atual = u?.assinaturaAte?.getTime() ?? 0;
  const base = atual > Date.now() ? atual : Date.now();
  await prisma.user.update({
    where: { id: userId },
    data: { assinante: true, assinaturaAte: new Date(base + dias * DIA_MS) },
  });
}

// aplicarCreditosPendentes mudou de casa: agora vive em liberacao-creditos.ts,
// porque compra de pacote passa pela quarentena do nível da conta.

export function brl(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Nº de créditos exibido ao usuário. 1 crédito = R$ 0,01, então o saldo em
 *  centavos é o próprio número de créditos (R$ 1,00 = 100 créditos). */
export function fmtCreditos(centavos: number) {
  return Math.round(centavos).toLocaleString("pt-BR");
}

export type Carteira = {
  saldoCentavos: number;
  assinante: boolean;
  assinaturaAte: Date | null;
};

/** Total de créditos que JÁ ENTRARAM (compras + bônus + ajustes). Base da barrinha
 *  "% ainda não gasto" = saldo / totalEntradas. */
export async function totalEntradas(userId: string): Promise<number> {
  const r = await prisma.creditoTransacao.aggregate({
    where: { userId, valor: { gt: 0 } },
    _sum: { valor: true },
  });
  return r._sum.valor ?? 0;
}

/** Tem crédito pra produzir? (qualquer saldo positivo). */
export async function temSaldo(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { saldoCentavos: true },
  });
  return (u?.saldoCentavos ?? 0) > 0;
}

export async function getCarteira(userId: string): Promise<Carteira> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { saldoCentavos: true, assinante: true, assinaturaAte: true },
  });
  return {
    saldoCentavos: u?.saldoCentavos ?? 0,
    assinante: u?.assinante ?? false,
    assinaturaAte: u?.assinaturaAte ?? null,
  };
}

/** Aplica um delta no saldo e registra no extrato - atômico (1 transação).
 *  TODA entrada (valor > 0) quita o saldo devedor de reembolso primeiro:
 *  compra, brinde mensal, bônus, liberação de quarentena, ajuste do admin.
 *  Retorna o saldo final (já descontada a quitação, se houve).
 *
 *  O saldo muda por `increment` com a guarda de saldo DENTRO do próprio UPDATE
 *  (auditoria #9): o jeito antigo lia o saldo, somava e gravava o número
 *  absoluto, então dois lançamentos do mesmo usuário no mesmo instante se
 *  atropelavam e um deles sumia do saldo (lost update). */
export async function lancar(
  userId: string,
  valorCentavos: number, // + entrada, − saída
  tipo: TipoTransacao,
  opts: { descricao?: string; jobId?: string; kiwifyOrderId?: string } = {},
) {
  const saldoApos = await prisma.$transaction(async (tx) => {
    const r = await tx.user.updateMany({
      where: {
        id: userId,
        // débito só passa se o saldo cobre; o banco confere na hora do UPDATE
        ...(valorCentavos < 0 ? { saldoCentavos: { gte: -valorCentavos } } : {}),
      },
      data: { saldoCentavos: { increment: valorCentavos } },
    });
    if (r.count === 0) {
      const existe = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!existe) throw new Error("Usuário não encontrado.");
      throw new Error("Saldo insuficiente.");
    }
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { saldoCentavos: true },
    });
    const saldoApos = u?.saldoCentavos ?? 0;
    await tx.creditoTransacao.create({
      data: {
        userId,
        tipo,
        valor: valorCentavos,
        saldoApos,
        descricao: opts.descricao,
        jobId: opts.jobId,
        kiwifyOrderId: opts.kiwifyOrderId,
      },
    });
    return saldoApos;
  });

  if (valorCentavos > 0 && tipo !== "quitacao_divida") {
    const pago = await quitarDivida(userId);
    return saldoApos - pago;
  }
  return saldoApos;
}

/** Abate a dívida de reembolso com o saldo disponível. Retorna o valor quitado. */
export async function quitarDivida(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { dividaCentavos: true },
  });
  const divida = u?.dividaCentavos ?? 0;
  if (divida <= 0) return 0;

  const pago = await debitarClamp(userId, divida, "quitacao_divida", {
    descricao: "Quitação do saldo devedor de reembolso",
  });
  if (pago > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { dividaCentavos: { decrement: pago } },
    });
  }
  return pago;
}

export function creditar(
  userId: string,
  centavos: number,
  tipo: TipoTransacao = "compra",
  descricao?: string,
) {
  return lancar(userId, Math.abs(centavos), tipo, { descricao });
}

export function debitar(
  userId: string,
  centavos: number,
  tipo: TipoTransacao,
  opts: { descricao?: string; jobId?: string } = {},
) {
  return lancar(userId, -Math.abs(centavos), tipo, opts);
}

/** Débito pós-pago que NUNCA deixa o saldo negativo (clampa em 0). Registra no
 *  extrato só o que foi efetivamente debitado. Retorna o valor debitado (centavos).
 *
 *  Concorrência (auditoria #9): o UPDATE é condicional ao saldo que foi lido
 *  (update otimista); se outro lançamento mexeu no meio, a rodada repete com o
 *  saldo novo em vez de gravar um número velho por cima.
 *
 *  `faltaViraDivida` (auditoria #8): quando o alvo não coube no saldo, a
 *  diferença vira saldo devedor (`dividaCentavos`) em vez de sumir - é o que
 *  fecha o golpe de disparar vários vídeos em paralelo com saldo pra um só. A
 *  dívida bloqueia geração nova (travaDeGeracao) e é quitada pela próxima
 *  entrada de crédito (lancar/quitarDivida). */
export async function debitarClamp(
  userId: string,
  centavos: number,
  tipo: TipoTransacao,
  opts: {
    descricao?: string;
    jobId?: string;
    kiwifyOrderId?: string;
    faltaViraDivida?: boolean;
  } = {},
): Promise<number> {
  const alvo = Math.abs(centavos);
  if (alvo <= 0) return 0;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { saldoCentavos: true },
    });
    if (!u) return 0;
    const valor = Math.min(u.saldoCentavos, alvo); // nunca passa do saldo
    const faltou = opts.faltaViraDivida ? alvo - valor : 0;
    if (valor <= 0 && faltou <= 0) return 0;
    const saldoApos = u.saldoCentavos - valor;
    const gravou = await prisma.$transaction(async (tx) => {
      const r = await tx.user.updateMany({
        // o `saldoCentavos` no where é a trava otimista: só grava se ninguém
        // mexeu no saldo desde a leitura ali de cima
        where: { id: userId, saldoCentavos: u.saldoCentavos },
        data: {
          saldoCentavos: saldoApos,
          ...(faltou > 0 ? { dividaCentavos: { increment: faltou } } : {}),
        },
      });
      if (r.count === 0) return false;
      await tx.creditoTransacao.create({
        data: {
          userId,
          tipo,
          valor: -valor,
          saldoApos,
          descricao:
            faltou > 0
              ? `${opts.descricao ?? "Débito"} — faltaram ${faltou} créditos, que viraram saldo devedor`
              : opts.descricao,
          jobId: opts.jobId,
          kiwifyOrderId: opts.kiwifyOrderId,
        },
      });
      return true;
    });
    if (gravou) return valor;
  }
  // 5 colisões seguidas (grau de concorrência irreal): não cobra nada em vez de
  // arriscar cobrar em cima de um saldo velho
  return 0;
}

/**
 * Soma dos custos AINDA NÃO COBRADOS dos vídeos de IA em andamento (auditoria #8).
 *
 * O débito dos vídeos de IA acontece só no FIM (falha não cobra), então a
 * checagem de saldo da criação precisa descontar o que os vídeos já disparados
 * vão cobrar quando saírem - sem isso, N pedidos em paralelo enxergavam todos o
 * mesmo saldo e só o primeiro pagava inteiro. As rotas gravam `custoPrevisto`
 * nas opções do job na criação; a janela de 30 min descarta job travado
 * (a geração real dura no máximo ~25 min), pra reserva não prender o saldo
 * de ninguém pra sempre.
 */
export async function custoReservado(userId: string): Promise<number> {
  const jobs = await prisma.job.findMany({
    where: {
      userId,
      status: { in: ["na_fila", "renderizando"] },
      criadoEm: { gte: new Date(Date.now() - 30 * 60_000) },
      opcoes: { contains: '"custoPrevisto"' },
    },
    select: { opcoes: true },
  });
  let soma = 0;
  for (const j of jobs) {
    try {
      const o = JSON.parse(j.opcoes ?? "{}") as { custoPrevisto?: number };
      if (typeof o.custoPrevisto === "number" && o.custoPrevisto > 0) {
        soma += o.custoPrevisto;
      }
    } catch {
      // opções ilegíveis: não reserva nada por esse job
    }
  }
  return soma;
}

/** Já existe um débito registrado pra esse job? (idempotência) */
export async function jobJaDebitado(jobId: string): Promise<boolean> {
  const t = await prisma.creditoTransacao.findFirst({
    where: {
      jobId,
      tipo: { in: ["debito_geracao", "debito_processamento"] },
    },
    select: { id: true },
  });
  return !!t;
}

export async function listarExtrato(userId: string, limite = 50) {
  return prisma.creditoTransacao.findMany({
    where: { userId },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
}

/**
 * Crédito do PRIMEIRO mês da assinatura, liberado UMA vez por usuário no primeiro
 * acesso ao painel (é "pago" pela compra de entrada, obrigatória pro cadastro).
 * As RENOVAÇÕES não passam mais por aqui: quem credita é o webhook da Cakto quando
 * a cobrança recorrente é aprovada de verdade. A regra antiga ("mudou o mês do
 * calendário = ganha de novo") dava crédito de graça todo mês pra sempre, e o
 * servidor em UTC ainda virava o mês às 21h de Brasília, liberando em dobro.
 */
export async function garantirCreditoMensal(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { assinante: true, assinaturaAte: true, creditoMensalEm: true },
  });
  if (!u?.assinante) return;
  if (u.assinaturaAte && u.assinaturaAte.getTime() < Date.now()) return; // vencida
  if (u.creditoMensalEm) return; // já recebeu o do primeiro mês

  await prisma.$transaction(async (tx) => {
    // `creditoMensalEm: null` no where é a trava: só UMA execução consegue virar
    // o campo, então duas abas no mesmo instante não creditam 2x nem se
    // atropelam com outro lançamento (o saldo muda por increment - auditoria #9)
    const r = await tx.user.updateMany({
      where: { id: userId, creditoMensalEm: null },
      data: {
        saldoCentavos: { increment: CREDITO_MENSAL_CENTAVOS },
        creditoMensalEm: new Date(),
      },
    });
    if (r.count === 0) return; // outra execução chegou primeiro
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { saldoCentavos: true },
    });
    await tx.creditoTransacao.create({
      data: {
        userId,
        tipo: "bonus_assinatura",
        valor: CREDITO_MENSAL_CENTAVOS,
        saldoApos: u?.saldoCentavos ?? CREDITO_MENSAL_CENTAVOS,
        descricao: "Crédito do primeiro mês da assinatura",
      },
    });
  });

  // entrada de crédito = quita saldo devedor de reembolso primeiro (este fluxo
  // não passa pelo lancar, então a quitação é chamada aqui)
  await quitarDivida(userId);
}
