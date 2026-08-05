import "server-only";

import { prisma } from "@/lib/prisma";
import { quitarDivida } from "@/lib/creditos";

/**
 * Níveis de conta (antifraude de reembolso): bronze -> prata -> ouro.
 *
 * O golpe que isto trava: comprar crédito, queimar tudo em API dentro dos 7 dias
 * de garantia da Cakto/Kiwify e pedir reembolso (a plataforma não deixa recusar).
 * Contas novas (bronze) têm teto diário de vídeos e só recebem parte do crédito
 * comprado na hora - o resto libera no 8º dia, quando a garantia já expirou.
 *
 * Subida é automática (tempo + dias de login + compras) com uma "análise interna"
 * invisível que ADIA a promoção de quem se comporta como golpista. O admin pode
 * fixar o nível na mão (nivelManual) ou marcar a conta como suspeita (bronze travado).
 */

export type Nivel = "bronze" | "prata" | "ouro";

export type ConfigNivel = {
  rotulo: string;
  emoji: string;
  videosDia: number; // teto de vídeos criados por dia (fuso SP)
  simultaneos: number; // vídeos em produção ao mesmo tempo
  franquiaCentavos: number; // parte da compra (na janela) que libera 100% na hora
  pctAcimaFranquia: number; // fração liberada na hora acima da franquia
  tetoLiberacaoJanela: number | null; // máx. liberado na janela de 8 dias (null = sem teto)
};

export const JANELA_GARANTIA_DIAS = 8;
const DIA_MS = 86_400_000;
const INATIVIDADE_MS = 60 * DIA_MS; // 60+ dias sem logar = cai um nível ao voltar

export const NIVEIS: Record<Nivel, ConfigNivel> = {
  bronze: {
    rotulo: "Bronze",
    emoji: "🥉",
    videosDia: 5,
    simultaneos: 1,
    franquiaCentavos: 2000, // até R$20 comprados na janela liberam integral
    pctAcimaFranquia: 0.5,
    tetoLiberacaoJanela: 5000, // libera no máx. R$50 dentro da janela de 8 dias
  },
  prata: {
    rotulo: "Prata",
    emoji: "🥈",
    videosDia: 12,
    simultaneos: 2,
    franquiaCentavos: 2000,
    pctAcimaFranquia: 0.5,
    tetoLiberacaoJanela: 10000, // dobro do bronze
  },
  ouro: {
    rotulo: "Ouro",
    emoji: "🥇",
    videosDia: 50,
    simultaneos: 3,
    franquiaCentavos: 0, // ouro não tem franquia: é 75% de tudo, sem teto
    pctAcimaFranquia: 0.75,
    tetoLiberacaoJanela: null,
  },
};

const ORDEM: Nivel[] = ["bronze", "prata", "ouro"];

export function nivelValido(n: string | null | undefined): Nivel {
  return n === "prata" || n === "ouro" ? n : "bronze";
}

// ---------------------------------------------------------------------------
// Dia no fuso de Brasília (as janelas diárias viram à meia-noite de SP, não UTC)
// ---------------------------------------------------------------------------

const fmtDiaSP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" do instante dado, no fuso de SP. */
export function diaBrasilia(d: Date = new Date()): string {
  return fmtDiaSP.format(d);
}

/** Instante (UTC) em que começou o dia de HOJE em Brasília (UTC-3, sem horário de verão). */
export function inicioDoDiaBrasilia(): Date {
  return new Date(`${diaBrasilia()}T00:00:00-03:00`);
}

// ---------------------------------------------------------------------------
// Trava de geração: dívida + teto diário + simultâneos, pelo nível da conta
// ---------------------------------------------------------------------------

const EM_PRODUCAO = ["na_fila", "renderizando", "processando"];

export type ResultadoTrava =
  | { ok: true }
  | { ok: false; status: number; erro: string; divida?: boolean };

/**
 * Pode criar `quantos` vídeos agora? Chamar em TODO endpoint que cria Job de
 * vídeo (editor, cortes, lote, lab, boost, avatar). Admin e demo passam direto
 * (demo tem regras próprias em cada rota).
 */
export async function travaDeGeracao(
  user: { id: string; role: string },
  quantos = 1,
): Promise<ResultadoTrava> {
  if (user.role === "admin" || user.role === "demo") return { ok: true };

  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { nivel: true, dividaCentavos: true },
  });
  if (!u) return { ok: false, status: 401, erro: "Faça login." };

  if (u.dividaCentavos > 0) {
    return {
      ok: false,
      status: 402,
      divida: true,
      erro:
        `Sua conta tem um saldo pendente de ${u.dividaCentavos.toLocaleString("pt-BR")} créditos ` +
        `referente a um reembolso. Adquira créditos pra regularizar e voltar a gerar.`,
    };
  }

  const nivel = nivelValido(u.nivel);
  const cfg = NIVEIS[nivel];

  // simultâneos: quantos jobs dele já estão na fila/renderizando agora
  const rodando = await prisma.job.count({
    where: { userId: user.id, status: { in: EM_PRODUCAO } },
  });
  if (rodando + quantos > cfg.simultaneos) {
    const livres = Math.max(0, cfg.simultaneos - rodando);
    return {
      ok: false,
      status: 429,
      erro:
        cfg.simultaneos === 1
          ? "Você já tem um vídeo em produção. Espere terminar pra gerar o próximo."
          : `Seu nível ${cfg.rotulo} permite ${cfg.simultaneos} vídeos em produção ao mesmo tempo` +
            (quantos > 1 ? ` (dá pra mandar ${livres} agora)` : "") +
            ". Espere terminarem pra gerar mais.",
    };
  }

  // teto diário: jobs criados hoje (SP), sem contar rascunho e erro
  const hoje = await prisma.job.count({
    where: {
      userId: user.id,
      criadoEm: { gte: inicioDoDiaBrasilia() },
      status: { notIn: ["recebendo", "erro"] },
    },
  });
  if (hoje + quantos > cfg.videosDia) {
    const proximo = nivel === "bronze" ? NIVEIS.prata : nivel === "prata" ? NIVEIS.ouro : null;
    return {
      ok: false,
      status: 429,
      erro:
        `Você atingiu seus ${cfg.videosDia} vídeos de hoje.` +
        (proximo
          ? ` Contas ${proximo.rotulo} geram até ${proximo.videosDia}/dia - continue usando a plataforma pra subir de nível.`
          : " Amanhã o limite renova."),
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Atividade diária + recálculo de nível (chamado pelo layout, no ritmo da presença)
// ---------------------------------------------------------------------------

/**
 * Marca o dia de atividade e recalcula o nível. Throttle: só roda quando a última
 * presença tem mais de 60s (mesma janela do tocarPresenca) - chamar ANTES dele,
 * que é quem atualiza o vistoEm. Nunca deixa erro vazar pra página.
 */
export async function tocarAtividadeENivel(userId: string) {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        nivel: true,
        nivelManual: true,
        suspeita: true,
        bloqueado: true,
        vistoEm: true,
        criadoEm: true,
        assinante: true,
        assinaturaAte: true,
      },
    });
    if (!u || u.role === "admin" || u.role === "demo") return;
    if (u.vistoEm && Date.now() - u.vistoEm.getTime() < 60_000) return; // throttle

    // inatividade 60+ dias: cai UM nível ao voltar (antes do vistoEm ser renovado)
    const nivelAtual = nivelValido(u.nivel);
    if (
      !u.nivelManual &&
      !u.suspeita &&
      nivelAtual !== "bronze" &&
      u.vistoEm &&
      Date.now() - u.vistoEm.getTime() > INATIVIDADE_MS
    ) {
      const abaixo = ORDEM[ORDEM.indexOf(nivelAtual) - 1];
      await prisma.user.update({ where: { id: u.id }, data: { nivel: abaixo } });
      u.nivel = abaixo;
      console.log("[niveis] queda por inatividade", u.id, nivelAtual, "->", abaixo);
    }

    // marca o dia de hoje (idempotente pela unique userId+dia)
    const dia = diaBrasilia();
    await prisma.atividadeDia.upsert({
      where: { userId_dia: { userId: u.id, dia } },
      create: { userId: u.id, dia },
      update: {},
    });

    // dívida de reembolso nunca convive com saldo positivo: se houver os dois
    // (ex.: estado antigo), o acesso ao painel já acerta as contas sozinho
    await quitarDivida(u.id);

    await recalcularNivel(u.id);
  } catch (e) {
    console.error("[niveis] tocarAtividadeENivel falhou", e);
  }
}

/** Assinatura valendo agora? */
function assinaturaAtiva(u: { assinante: boolean; assinaturaAte: Date | null }) {
  if (!u.assinante) return false;
  return !u.assinaturaAte || u.assinaturaAte.getTime() > Date.now();
}

/** Dias (strings SP) com atividade nos últimos `janelaDias` dias. */
async function diasAtivos(userId: string, janelaDias: number): Promise<number> {
  const desde = diaBrasilia(new Date(Date.now() - (janelaDias - 1) * DIA_MS));
  return prisma.atividadeDia.count({ where: { userId, dia: { gte: desde } } });
}

/** Existe reembolso solicitado AINDA em análise? (suspensão sem reversão depois) */
async function suspensoAgora(userId: string): Promise<boolean> {
  const [susp, rev] = await Promise.all([
    prisma.creditoTransacao.findFirst({
      where: { userId, tipo: "suspensao_reembolso" },
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true },
    }),
    prisma.creditoTransacao.findFirst({
      where: { userId, tipo: "reversao_suspensao" },
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true },
    }),
  ]);
  if (!susp) return false;
  return !rev || rev.criadoEm < susp.criadoEm;
}

/**
 * Recalcula o nível (só SOBE; quedas são por eventos: reembolso, inatividade,
 * suspeita, assinatura). Respeita nivelManual/suspeita. Exportado pra varredura.
 */
export async function recalcularNivel(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      nivel: true,
      nivelManual: true,
      suspeita: true,
      bloqueado: true,
      criadoEm: true,
      assinante: true,
      assinaturaAte: true,
    },
  });
  if (!u || u.role === "admin" || u.role === "demo") return;
  if (u.nivelManual || u.suspeita || u.bloqueado) return;

  const nivel = nivelValido(u.nivel);

  // ouro exige assinatura em dia: sem ela, volta pra prata (nunca pra bronze por isso)
  if (nivel === "ouro" && !assinaturaAtiva(u)) {
    await prisma.user.update({ where: { id: u.id }, data: { nivel: "prata" } });
    console.log("[niveis] ouro -> prata (assinatura caiu)", u.id);
    return;
  }

  if (nivel === "bronze") await tentarPromoverPrata(u);
  else if (nivel === "prata") await tentarPromoverOuro(u);
}

/** Bronze -> Prata: 8 dias da 1ª compra + 5/8 dias de login + análise interna. */
async function tentarPromoverPrata(u: { id: string; criadoEm: Date }) {
  // reembolso em análise ou recente (30 dias) segura a promoção
  if (await suspensoAgora(u.id)) return;
  const reembolsoRecente = await prisma.creditoTransacao.findFirst({
    where: {
      userId: u.id,
      tipo: { in: ["suspensao_reembolso", "estorno"] },
      criadoEm: { gte: new Date(Date.now() - 30 * DIA_MS) },
    },
    select: { id: true },
  });
  if (reembolsoRecente) return;

  // 1ª compra: a conta só nasce depois de pagar a entrada, então criadoEm é a
  // referência; se houver compra de pacote ANTERIOR ao cadastro, vale a mais antiga.
  const primeiraCompra = await prisma.creditoTransacao.findFirst({
    where: { userId: u.id, tipo: "compra" },
    orderBy: { criadoEm: "asc" },
    select: { criadoEm: true, valor: true },
  });
  const base = primeiraCompra && primeiraCompra.criadoEm < u.criadoEm
    ? primeiraCompra.criadoEm
    : u.criadoEm;

  const atraso = await atrasoAnaliseInterna(u);
  const prazo = base.getTime() + (JANELA_GARANTIA_DIAS + atraso) * DIA_MS;
  if (Date.now() < prazo) return;

  if ((await diasAtivos(u.id, 8)) < 5) return;

  await prisma.user.update({ where: { id: u.id }, data: { nivel: "prata" } });
  await notificarPromocao(u.id, "prata");
  console.log("[niveis] bronze -> prata", u.id, `(análise: +${atraso}d)`);
}

/** Prata -> Ouro: 30 dias de conta + 10/30 dias de login + 2ª compra + assinatura. */
async function tentarPromoverOuro(u: {
  id: string;
  criadoEm: Date;
  assinante: boolean;
  assinaturaAte: Date | null;
}) {
  if (Date.now() - u.criadoEm.getTime() < 30 * DIA_MS) return;
  if (!assinaturaAtiva(u)) return;
  if (await suspensoAgora(u.id)) return;

  // nunca teve reembolso aceito (estorno com perda de verdade)
  const estorno = await prisma.creditoTransacao.findFirst({
    where: { userId: u.id, tipo: "estorno" },
    select: { id: true },
  });
  if (estorno) return;

  // 2ª compra: a entrada foi a 1ª; qualquer pacote OU renovação paga conta como 2ª
  const [pacotes, renovacoes] = await Promise.all([
    prisma.creditoTransacao.count({ where: { userId: u.id, tipo: "compra" } }),
    prisma.creditoTransacao.count({
      where: { userId: u.id, tipo: "bonus_assinatura", kiwifyOrderId: { not: null } },
    }),
  ]);
  if (pacotes + renovacoes < 1) return;

  if ((await diasAtivos(u.id, 30)) < 10) return;

  await prisma.user.update({ where: { id: u.id }, data: { nivel: "ouro" } });
  await notificarPromocao(u.id, "ouro");
  console.log("[niveis] prata -> ouro", u.id);
}

/**
 * Análise interna (INVISÍVEL pro usuário): cada bandeira de comportamento de
 * risco adia a promoção Bronze->Prata em +24h. Nada disso aparece na UI.
 */
async function atrasoAnaliseInterna(u: { id: string; criadoEm: Date }): Promise<number> {
  let flags = 0;
  const fim7d = new Date(u.criadoEm.getTime() + 7 * DIA_MS);

  const compras = await prisma.creditoTransacao.findMany({
    where: { userId: u.id, tipo: "compra" },
    orderBy: { criadoEm: "asc" },
    select: { criadoEm: true, valor: true },
  });

  // 1) primeira compra de pacote já foi cara (R$100+)? Obs.: a transação guarda a
  // parte LIBERADA; soma o preso criado no mesmo pedido pra estimar o valor cheio.
  if (compras.length) {
    const presoPrimeira = await prisma.creditoLiberacao.aggregate({
      where: {
        userId: u.id,
        criadoEm: {
          gte: new Date(compras[0].criadoEm.getTime() - 60_000),
          lte: new Date(compras[0].criadoEm.getTime() + 60_000),
        },
      },
      _sum: { valor: true },
    });
    if (compras[0].valor + (presoPrimeira._sum.valor ?? 0) >= 10000) flags++;

    // 4) comprou pacote no MESMO dia em que a conta nasceu
    if (diaBrasilia(compras[0].criadoEm) === diaBrasilia(u.criadoEm)) flags++;
  }

  // 2) esgotou o crédito liberado tendo quarentena pendente nos primeiros 7 dias
  const teveQuarentena = await prisma.creditoLiberacao.findFirst({
    where: { userId: u.id, criadoEm: { lte: fim7d } },
    select: { id: true },
  });
  if (teveQuarentena) {
    const zerou = await prisma.creditoTransacao.findFirst({
      where: {
        userId: u.id,
        criadoEm: { lte: fim7d },
        valor: { lt: 0 },
        saldoApos: { lte: 100 }, // bateu em <= 1 real
      },
      select: { id: true },
    });
    if (zerou) flags++;
  }

  // 3) bateu no teto diário (5 vídeos) em 4+ dos primeiros 7 dias
  const jobs7d = await prisma.job.findMany({
    where: {
      userId: u.id,
      criadoEm: { lte: fim7d },
      status: { notIn: ["recebendo", "erro"] },
    },
    select: { criadoEm: true },
  });
  const porDia = new Map<string, number>();
  for (const j of jobs7d) {
    const d = diaBrasilia(j.criadoEm);
    porDia.set(d, (porDia.get(d) ?? 0) + 1);
  }
  let diasNoTeto = 0;
  for (const n of porDia.values()) if (n >= NIVEIS.bronze.videosDia) diasNoTeto++;
  if (diasNoTeto >= 4) flags++;

  return flags;
}

async function notificarPromocao(userId: string, nivel: Nivel) {
  const cfg = NIVEIS[nivel];
  try {
    await prisma.notificacao.create({
      data: {
        userId,
        tipo: "admin",
        titulo: `Sua conta subiu pro nível ${cfg.rotulo} ${cfg.emoji}`,
        mensagem:
          `Agora você gera até ${cfg.videosDia} vídeos por dia` +
          (nivel === "ouro"
            ? " e seus créditos comprados liberam quase todos na hora."
            : " e mais crédito comprado libera na hora."),
        link: "/painel/creditos",
      },
    });
  } catch {
    /* notificação é cosmética */
  }
}

// ---------------------------------------------------------------------------
// Quedas por evento (chamadas pelo fluxo de reembolso) + controle do admin
// ---------------------------------------------------------------------------

/** Reembolso solicitado: cai pra bronze. Retorna o nível anterior (pra restaurar). */
export async function rebaixarPorReembolso(userId: string): Promise<Nivel> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { nivel: true },
  });
  const antes = nivelValido(u?.nivel);
  if (antes !== "bronze") {
    await prisma.user.update({ where: { id: userId }, data: { nivel: "bronze" } });
  }
  return antes;
}

/** Reembolso cancelado: volta ao nível de antes (se o admin não travou nada). */
export async function restaurarNivel(userId: string, nivelAntes: string | undefined) {
  const alvo = nivelValido(nivelAntes);
  if (alvo === "bronze") return;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { nivelManual: true, suspeita: true },
  });
  if (!u || u.nivelManual || u.suspeita) return;
  await prisma.user.update({ where: { id: userId }, data: { nivel: alvo } });
}

/** Controle do admin: fixa nível na mão, devolve pro automático ou marca suspeita. */
export async function setNivelAdmin(
  userId: string,
  opts: { nivel?: Nivel | "auto"; suspeita?: boolean },
) {
  const data: { nivel?: string; nivelManual?: boolean; suspeita?: boolean } = {};
  if (opts.suspeita !== undefined) {
    data.suspeita = opts.suspeita;
    if (opts.suspeita) data.nivel = "bronze"; // suspeita = bronze travado
  }
  if (opts.nivel === "auto") {
    data.nivelManual = false;
  } else if (opts.nivel) {
    data.nivel = opts.nivel;
    data.nivelManual = true;
  }
  await prisma.user.update({ where: { id: userId }, data });
  if (opts.nivel === "auto") await recalcularNivel(userId);
}

// ---------------------------------------------------------------------------
// Resumo pro front (aba Créditos): nível, limites, uso de hoje e crédito preso
// ---------------------------------------------------------------------------

export type ResumoNivel = {
  nivel: Nivel;
  rotulo: string;
  emoji: string;
  videosDia: number;
  videosHoje: number;
  simultaneos: number;
  presoCentavos: number; // crédito comprado ainda em quarentena
  proximaLiberacao: { valorCentavos: number; em: string } | null; // em = ISO
  dividaCentavos: number;
  proximoNivel: { rotulo: string; videosDia: number } | null;
};

/** Nível pra exibir no menu lateral (null = não mostra: admin/demo). Query leve. */
export async function getNivelBadge(user: {
  id: string;
  role: string;
}): Promise<Nivel | null> {
  if (user.role !== "user") return null;
  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { nivel: true },
  });
  return nivelValido(u?.nivel);
}

/** Saldo devedor de reembolso (0 = em dia). Pro aviso no menu lateral. */
export async function getDividaCentavos(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { dividaCentavos: true },
  });
  return u?.dividaCentavos ?? 0;
}

export async function getResumoNivel(userId: string): Promise<ResumoNivel> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { nivel: true, role: true, dividaCentavos: true },
  });
  const nivel = u?.role === "admin" || u?.role === "demo" ? "ouro" : nivelValido(u?.nivel);
  const cfg = NIVEIS[nivel];

  const [videosHoje, preso, proxima] = await Promise.all([
    prisma.job.count({
      where: {
        userId,
        criadoEm: { gte: inicioDoDiaBrasilia() },
        status: { notIn: ["recebendo", "erro"] },
      },
    }),
    prisma.creditoLiberacao.aggregate({
      where: { userId, aplicado: false, cancelado: false },
      _sum: { valor: true },
    }),
    prisma.creditoLiberacao.findFirst({
      where: { userId, aplicado: false, cancelado: false },
      orderBy: { liberaEm: "asc" },
      select: { valor: true, liberaEm: true },
    }),
  ]);

  return {
    nivel,
    rotulo: cfg.rotulo,
    emoji: cfg.emoji,
    videosDia: cfg.videosDia,
    videosHoje,
    simultaneos: cfg.simultaneos,
    presoCentavos: preso._sum.valor ?? 0,
    proximaLiberacao: proxima
      ? { valorCentavos: proxima.valor, em: proxima.liberaEm.toISOString() }
      : null,
    dividaCentavos: u?.dividaCentavos ?? 0,
    proximoNivel:
      nivel === "bronze"
        ? { rotulo: NIVEIS.prata.rotulo, videosDia: NIVEIS.prata.videosDia }
        : nivel === "prata"
          ? { rotulo: NIVEIS.ouro.rotulo, videosDia: NIVEIS.ouro.videosDia }
          : null,
  };
}
