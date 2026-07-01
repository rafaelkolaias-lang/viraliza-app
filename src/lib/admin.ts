import "server-only";

import { prisma } from "@/lib/prisma";

const TZ = "America/Sao_Paulo";
const ONLINE_MS = 5 * 60_000; // "online" = visto nos últimos 5 min
const DIAS_GRAFICO = 14;

const fmtDiaChave = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}); // -> "2026-07-01"
const fmtDiaLabel = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
}); // -> "01/07"

export type DiaProducao = { chave: string; label: string; total: number; erros: number };

export type LinhaUsuario = {
  id: string;
  nome: string;
  email: string;
  role: string;
  saldoCentavos: number;
  gastoCentavos: number; // total já gasto em produção (positivo)
  jobs: number;
  vistoEm: string | null;
  online: boolean;
};

export type PainelAdmin = {
  stats: {
    usuarios: number;
    online: number;
    videos: number;
    emProducao: number;
    prontos: number;
    erros: number;
  };
  grafico: DiaProducao[];
  usuarios: LinhaUsuario[];
  recentes: {
    id: string;
    produto: string;
    formato: string;
    status: string;
    criadoEm: Date;
    nome: string | null;
  }[];
};

export async function getPainelAdmin(): Promise<PainelAdmin> {
  const agora = Date.now();
  const online5min = new Date(agora - ONLINE_MS);
  const desdeGrafico = new Date(agora - (DIAS_GRAFICO - 1) * 86_400_000);
  const producao = ["na_fila", "renderizando", "processando"];

  const [
    usuarios,
    videos,
    emProducao,
    prontos,
    erros,
    online,
    recentes,
    jobsPeriodo,
    gastos,
    jobsPorUser,
    listaUsuarios,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.job.count(),
    prisma.job.count({ where: { status: { in: producao } } }),
    prisma.job.count({ where: { status: "pronto" } }),
    prisma.job.count({ where: { status: "erro" } }),
    prisma.user.count({ where: { vistoEm: { gt: online5min } } }),
    prisma.job.findMany({
      orderBy: { criadoEm: "desc" },
      take: 12,
      select: {
        id: true,
        produto: true,
        formato: true,
        status: true,
        criadoEm: true,
        user: { select: { nome: true } },
      },
    }),
    prisma.job.findMany({
      where: { criadoEm: { gte: desdeGrafico } },
      select: { criadoEm: true, status: true },
    }),
    prisma.creditoTransacao.groupBy({
      by: ["userId"],
      where: { tipo: { in: ["debito_geracao", "debito_processamento"] } },
      _sum: { valor: true },
    }),
    prisma.job.groupBy({ by: ["userId"], _count: { _all: true } }),
    prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        saldoCentavos: true,
        vistoEm: true,
      },
    }),
  ]);

  // --- gráfico: últimos N dias, buckets por dia (fuso de SP) ---
  const buckets = new Map<string, { total: number; erros: number }>();
  for (let i = 0; i < DIAS_GRAFICO; i++) {
    const d = new Date(agora - (DIAS_GRAFICO - 1 - i) * 86_400_000);
    buckets.set(fmtDiaChave.format(d), { total: 0, erros: 0 });
  }
  for (const j of jobsPeriodo) {
    const chave = fmtDiaChave.format(j.criadoEm);
    const b = buckets.get(chave);
    if (b) {
      b.total++;
      if (j.status === "erro") b.erros++;
    }
  }
  const grafico: DiaProducao[] = [...buckets.entries()].map(([chave, v]) => ({
    chave,
    label: fmtDiaLabel.format(new Date(chave + "T12:00:00")),
    total: v.total,
    erros: v.erros,
  }));

  // --- tabela de usuários: junta gasto + nº de jobs + presença ---
  const gastoPor = new Map(gastos.map((g) => [g.userId, Math.abs(g._sum.valor ?? 0)]));
  const jobsPor = new Map(jobsPorUser.map((g) => [g.userId, g._count._all]));
  const linhas: LinhaUsuario[] = listaUsuarios
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      saldoCentavos: u.saldoCentavos,
      gastoCentavos: gastoPor.get(u.id) ?? 0,
      jobs: jobsPor.get(u.id) ?? 0,
      vistoEm: u.vistoEm ? u.vistoEm.toISOString() : null,
      online: !!u.vistoEm && u.vistoEm.getTime() > agora - ONLINE_MS,
    }))
    // online primeiro, depois quem foi visto mais recentemente
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (b.vistoEm ?? "").localeCompare(a.vistoEm ?? "");
    });

  return {
    stats: { usuarios, online, videos, emProducao, prontos, erros },
    grafico,
    usuarios: linhas,
    recentes: recentes.map((r) => ({
      id: r.id,
      produto: r.produto,
      formato: r.formato,
      status: r.status,
      criadoEm: r.criadoEm,
      nome: r.user?.nome ?? null,
    })),
  };
}
