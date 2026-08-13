import "server-only";

import { prisma } from "@/lib/prisma";
import { quitarDivida } from "@/lib/creditos";

/**
 * Níveis de conta: bronze -> prata -> ouro.
 *
 * REGRA DESDE 06/ago/2026: nível é só uma MEDALHA por quantidade de vídeo já
 * gerado na plataforma. NÃO limita nada. Não tem teto por dia, não tem limite de
 * vídeos ao mesmo tempo, não segura crédito. Quem pagou usa o que comprou.
 *
 * O que saiu, e por quê:
 *  - quarentena de crédito comprado (parte na hora, resto no 8º dia): era
 *    antifraude de reembolso e saiu com a entrada do Mercado Pago;
 *  - teto diário por nível: virou atrito em cima de cliente pagante;
 *  - promoção por tempo de casa, dias de login e "análise interna" de risco:
 *    a régua agora é uma só, o número de vídeos, que a pessoa entende sozinha.
 *
 * O QUE NÃO É NÍVEL E POR ISSO FICOU (12/08/2026): o teto de vídeos em produção
 * ao mesmo tempo (SIMULTANEOS_UNIVERSAL) continua valendo, IGUAL pra toda conta.
 * Ele não é vantagem de Bronze/Prata/Ouro nem régua de mérito: é proteção da
 * fila de renderização, que é um recurso finito e compartilhado. Mora aqui por
 * ficar junto da `travaDeGeracao`, que é quem barra, e não porque seja nível.
 *
 * O admin ainda fixa o nível na mão (nivelManual) quando quiser.
 */

/** Vídeos que uma conta pode ter em produção ao mesmo tempo. Igual pra todo
 *  mundo: é fila, não é nível (ver o bloco acima). */
export const SIMULTANEOS_UNIVERSAL = 5;

/** Status que contam como "ocupando uma vaga de produção". `preparando` entra
 *  porque o job já existe e já vai virar vídeo: é o Editor esperando a IA
 *  terminar de encaixar as cenas no navegador da pessoa. */
const EM_PRODUCAO = ["preparando", "na_fila", "renderizando", "processando"];

export type Nivel = "bronze" | "prata" | "ouro";

export type ConfigNivel = {
  rotulo: string;
  emoji: string;
  /** vídeos gerados necessários pra estar neste nível */
  videosMin: number;
};

export const JANELA_GARANTIA_DIAS = 8;

export const NIVEIS: Record<Nivel, ConfigNivel> = {
  bronze: {
    rotulo: "Bronze",
    emoji: "🥉",
    videosMin: 0, // onde todo mundo começa
  },
  prata: {
    rotulo: "Prata",
    emoji: "🥈",
    videosMin: 100,
  },
  ouro: {
    rotulo: "Ouro",
    emoji: "🥇",
    videosMin: 200,
  },
};

/** Status de job que conta como vídeo feito (rascunho e erro não contam). */
const JOB_CONTA = { notIn: ["recebendo", "erro"] };

/** Quantos vídeos esta conta já gerou na plataforma (a régua do nível). */
export async function contarVideos(userId: string): Promise<number> {
  return prisma.job.count({ where: { userId, status: JOB_CONTA } });
}

/** Nível que corresponde a essa quantidade de vídeos. */
export function nivelPorVideos(videos: number): Nivel {
  if (videos >= NIVEIS.ouro.videosMin) return "ouro";
  if (videos >= NIVEIS.prata.videosMin) return "prata";
  return "bronze";
}

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
// Trava de geração: sobrou só o saldo devedor de reembolso
// ---------------------------------------------------------------------------

export type ResultadoTrava =
  | { ok: true }
  | { ok: false; status: number; erro: string; divida?: boolean };

/**
 * Pode criar `quantos` vídeos agora? Chamada em TODO endpoint que cria Job de
 * vídeo (editor, cortes, lote, lab, boost, avatar). Admin e demo passam direto
 * (demo tem regras próprias em cada rota).
 *
 * São DUAS travas, e nenhuma das duas é nível:
 *  1. saldo devedor de reembolso (quem não tem crédito já é barrado pelo crédito);
 *  2. vídeos em produção ao mesmo tempo (SIMULTANEOS_UNIVERSAL), que é regra de
 *     FILA e não vantagem de conta: sem ela uma pessoa sozinha enfileira
 *     centenas de vídeos e trava a renderização de todo mundo.
 */
export async function travaDeGeracao(
  user: { id: string; role: string },
  quantos = 1,
): Promise<ResultadoTrava> {
  if (user.role === "admin" || user.role === "demo") return { ok: true };

  const u = await prisma.user.findUnique({
    where: { id: user.id },
    select: { dividaCentavos: true },
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

  // simultâneos: quantos jobs dele já estão em produção agora. "marca" fica de
  // fora: carimbar logo não usa IA nem a cota do motor, então o lote não ocupa
  // vaga nem tranca as outras ferramentas (quem chama pra job de marca passa
  // `quantos = 0`, mantendo só a trava de dívida acima).
  const rodando = await prisma.job.count({
    where: { userId: user.id, status: { in: EM_PRODUCAO }, tipo: { not: "marca" } },
  });
  if (rodando + quantos > SIMULTANEOS_UNIVERSAL) {
    const livres = Math.max(0, SIMULTANEOS_UNIVERSAL - rodando);
    return {
      ok: false,
      status: 429,
      erro:
        `Você já tem ${rodando} vídeo${rodando > 1 ? "s" : ""} em produção. O limite é de ` +
        `${SIMULTANEOS_UNIVERSAL} vídeos ao mesmo tempo por conta` +
        (quantos > 1 && livres > 0 ? ` (dá pra mandar ${livres} agora)` : "") +
        ". Espere algum terminar pra gerar mais.",
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
      select: { id: true, role: true, vistoEm: true },
    });
    if (!u || u.role === "admin" || u.role === "demo") return;
    if (u.vistoEm && Date.now() - u.vistoEm.getTime() < 60_000) return; // throttle

    // marca o dia de hoje (idempotente pela unique userId+dia). Duas abas abrindo
    // no mesmo instante fazem os dois upserts acharem que a linha não existe e um
    // deles estoura P2002; como o efeito desejado (a linha existir) já aconteceu,
    // engolir é o certo - era isso que estava poluindo o log de produção.
    const dia = diaBrasilia();
    try {
      await prisma.atividadeDia.upsert({
        where: { userId_dia: { userId: u.id, dia } },
        create: { userId: u.id, dia },
        update: {},
      });
    } catch {
      // outra requisição criou o dia primeiro
    }

    // dívida de reembolso nunca convive com saldo positivo: se houver os dois
    // (ex.: estado antigo), o acesso ao painel já acerta as contas sozinho
    await quitarDivida(u.id);

    await recalcularNivel(u.id);
  } catch (e) {
    console.error("[niveis] tocarAtividadeENivel falhou", e);
  }
}

/**
 * Recalcula o nível a partir do NÚMERO DE VÍDEOS gerados. Só sobe: quem chegou
 * em Ouro e apagou vídeos não perde a medalha. Respeita nivelManual (admin fixou).
 * Exportado pra varredura.
 */
export async function recalcularNivel(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, nivel: true, nivelManual: true, bloqueado: true },
  });
  if (!u || u.role === "admin" || u.role === "demo") return;
  if (u.nivelManual || u.bloqueado) return;

  const atual = nivelValido(u.nivel);
  const merecido = nivelPorVideos(await contarVideos(u.id));
  if (ORDEM.indexOf(merecido) <= ORDEM.indexOf(atual)) return;

  await prisma.user.update({ where: { id: u.id }, data: { nivel: merecido } });
  await notificarPromocao(u.id, merecido);
  console.log("[niveis]", atual, "->", merecido, u.id);
}

async function notificarPromocao(userId: string, nivel: Nivel) {
  const cfg = NIVEIS[nivel];
  try {
    await prisma.notificacao.create({
      data: {
        userId,
        tipo: "admin",
        titulo: `Sua conta subiu pro nível ${cfg.rotulo} ${cfg.emoji}`,
        mensagem: `Você já passou de ${cfg.videosMin.toLocaleString("pt-BR")} vídeos gerados no Viraliza. Continua assim!`,
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

/*
 * REMOVIDAS em 06/ago/2026: `rebaixarPorReembolso` e `restaurarNivel`.
 *
 * Elas jogavam a conta pra bronze quando alguém pedia reembolso, e devolviam o
 * nível se o pedido caísse. Não fazem mais sentido: nível virou a contagem de
 * vídeos que a pessoa gerou, e pedir dinheiro de volta não desfaz vídeo nenhum.
 * O que sustenta o antifraude do reembolso é o saldo devedor (dividaCentavos),
 * que continua travando a geração até ser quitado.
 */

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
  /** total de vídeos já gerados (a régua do nível) */
  videos: number;
  dividaCentavos: number;
  /** quanto falta pra próxima medalha (null = já é Ouro) */
  proximoNivel: { rotulo: string; emoji: string; videosMin: number; faltam: number } | null;
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
  const videos = await contarVideos(userId);

  // a medalha guardada pode estar atrás da contagem (o recálculo roda no layout,
  // com throttle de 1 min), então a tela mostra a que a contagem já garante
  const alvo = nivel === "ouro" ? null : nivel === "prata" ? NIVEIS.ouro : NIVEIS.prata;

  return {
    nivel,
    rotulo: cfg.rotulo,
    emoji: cfg.emoji,
    videos,
    dividaCentavos: u?.dividaCentavos ?? 0,
    proximoNivel: alvo
      ? {
          rotulo: alvo.rotulo,
          emoji: alvo.emoji,
          videosMin: alvo.videosMin,
          faltam: Math.max(0, alvo.videosMin - videos),
        }
      : null,
  };
}
