import "server-only";

import { prisma } from "@/lib/prisma";
import { paraVideoJob } from "@/lib/jobs";
import { usoVazio, type ChaveFerramenta, type UsoFerramentas } from "@/lib/uso-ferramentas";
import {
  FERRAMENTA_AVATAR,
  FERRAMENTA_IMAGEM,
  ferramentaDoVideo,
  origemDoAvatar,
  type FiltroCriacoes,
  type ItemCriacao,
  type TipoCriacao,
} from "@/lib/criacoes";
import type { VideoJob } from "@/lib/types";

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
  uso: UsoFerramentas; // quantas vezes usou cada ferramenta (desde sempre)
  vistoEm: string | null;
  online: boolean;
  assinante: boolean; // acesso à biblioteca (acervos, virais, produtos, membro)
  ferramentasLiberadas: boolean; // acesso às ferramentas de gerar vídeo
  nivel: string; // bronze | prata | ouro
  nivelManual: boolean; // admin fixou o nível na mão
  suspeita: boolean; // conta marcada como suspeita (bronze travado)
  dividaCentavos: number; // saldo devedor de reembolso
};

export type PainelAdmin = {
  stats: {
    usuarios: number;
    online: number;
    videos: number;
    emProducao: number;
    prontos: number;
    erros: number;
    creditosGastos: number; // total de créditos já consumidos em produção
    // recorrência da assinatura (ver comentário no getPainelAdmin)
    assinantesRecorrentes: number; // renovaram a assinatura pelo menos 1 vez
    totalJaAssinantes: number; // todo mundo que é ou já foi assinante
    pctRecorrencia: number; // recorrentes / jáAssinantes * 100 (0 a 100)
    reembolsosAssinatura: number; // usuários distintos com estorno do plano
  };
  // pendências que precisam de ação do admin (viram atalhos na visão geral)
  pendencias: {
    reportes: number; // reportes de vídeo "novo"
    sugestoes: number; // sugestões "nova"
    bonus: number; // bônus IG "pendente"
  };
  grafico: DiaProducao[];
  usuarios: LinhaUsuario[];
  recentes: {
    id: string;
    produto: string;
    formato: string;
    tipo: string; // "produto" | "cortes" | "avatar" (avatar = gerado no Grok)
    status: string;
    criadoEm: Date;
    nome: string | null;
  }[];
};

/**
 * Conta o uso de todo mundo, ferramenta por ferramenta. `desde` e `ate` são as
 * pontas do período; os dois em null pegam a plataforma inteira, e dá pra passar
 * só um deles (ex.: `ate` sozinho = tudo até aquela data). Vídeo excluído e
 * vídeo com erro CONTAM: a pessoa usou a ferramenta (e o crédito saiu na hora),
 * então o número mede uso, não acervo.
 * Ver `lib/uso-ferramentas.ts` pra origem de cada número e as ressalvas.
 */
export async function contarUsoPorUsuario(
  desde?: Date | null,
  ate?: Date | null,
): Promise<Map<string, UsoFerramentas>> {
  // `criadoEm` só entra no where quando existe alguma ponta: objeto vazio faria
  // o Prisma filtrar por "criadoEm: {}" à toa em 11 consultas.
  const janela =
    desde || ate
      ? {
          criadoEm: {
            ...(desde ? { gte: desde } : {}),
            ...(ate ? { lte: ate } : {}),
          },
        }
      : {};
  const soProduto = { ...janela, tipo: "produto" };

  const [
    imagens,
    influenciadores,
    lote,
    cortes,
    produto,
    marcadosLab,
    marcadosBoost,
    marcadosAvatar,
    naPastaAvatares,
    leads,
    prompts,
  ] = await Promise.all([
    prisma.imagemGerada.groupBy({
      by: ["userId", "origem"],
      where: janela,
      _count: { _all: true },
    }),
    prisma.avatar.groupBy({ by: ["userId"], where: janela, _count: { _all: true } }),
    prisma.job.groupBy({
      by: ["userId"],
      where: { ...janela, tipo: "marca" },
      _count: { _all: true },
    }),
    prisma.job.groupBy({
      by: ["userId"],
      where: { ...janela, tipo: "cortes" },
      _count: { _all: true },
    }),
    // os vídeos "produto" vêm como lista de ids: a separação por ferramenta é
    // feita em memória, por prioridade, pra um job nunca contar duas vezes (o
    // vídeo do Lab, por exemplo, também mora na pasta /avatares/)
    prisma.job.findMany({ where: soProduto, select: { id: true, userId: true } }),
    prisma.job.findMany({
      where: { ...soProduto, opcoes: { contains: '"lab":true' } },
      select: { id: true },
    }),
    prisma.job.findMany({
      where: { ...soProduto, opcoes: { contains: '"boost":true' } },
      select: { id: true },
    }),
    prisma.job.findMany({
      where: { ...soProduto, opcoes: { contains: '"avatar":true' } },
      select: { id: true },
    }),
    prisma.job.findMany({
      where: {
        ...soProduto,
        OR: [{ midias: { contains: "/avatares/" } }, { saidas: { contains: "/avatares/" } }],
      },
      select: { id: true },
    }),
    prisma.creditoTransacao.groupBy({
      by: ["userId"],
      where: { ...janela, descricao: "Busca de leads" },
      _count: { _all: true },
    }),
    prisma.gastoApi.groupBy({
      by: ["userId"],
      where: { ...janela, origem: "gerador-prompt" },
      _count: { _all: true },
    }),
  ]);

  const mapa = new Map<string, UsoFerramentas>();
  const linha = (userId: string) => {
    let l = mapa.get(userId);
    if (!l) {
      l = usoVazio();
      mapa.set(userId, l);
    }
    return l;
  };

  const ORIGEM_IMAGEM: Record<string, ChaveFerramenta> = {
    lab: "imgLab",
    boost: "imgBoost",
    avatar: "imgAvatar",
  };
  for (const i of imagens) {
    const chave = ORIGEM_IMAGEM[i.origem];
    if (chave) linha(i.userId)[chave] += i._count._all;
  }
  for (const a of influenciadores) linha(a.userId).influenciador += a._count._all;
  for (const j of lote) linha(j.userId).vidLote += j._count._all;
  for (const j of cortes) linha(j.userId).vidCortes += j._count._all;
  // userId nulo = transação de conta excluída (auditoria #14): fica fora da
  // tabela por pessoa (não tem mais linha pra mostrar), mas segue nos totais
  for (const t of leads) if (t.userId) linha(t.userId).leads += t._count._all;
  for (const g of prompts) if (g.userId) linha(g.userId).prompt += g._count._all;

  const idsLab = new Set(marcadosLab.map((j) => j.id));
  const idsBoost = new Set(marcadosBoost.map((j) => j.id));
  const idsAvatar = new Set(marcadosAvatar.map((j) => j.id));
  const idsPasta = new Set(naPastaAvatares.map((j) => j.id));
  for (const j of produto) {
    const l = linha(j.userId);
    if (idsLab.has(j.id)) l.vidLab++;
    else if (idsBoost.has(j.id)) l.vidBoost++;
    else if (idsAvatar.has(j.id) || idsPasta.has(j.id)) l.vidAvatar++;
    else l.vidEditor++;
  }

  return mapa;
}

export async function getPainelAdmin(): Promise<PainelAdmin> {
  const agora = Date.now();
  const online5min = new Date(agora - ONLINE_MS);
  const desdeGrafico = new Date(agora - (DIAS_GRAFICO - 1) * 86_400_000);
  const producao = ["preparando", "na_fila", "renderizando", "processando"];

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
    pendReportes,
    pendSugestoes,
    pendBonus,
    usoPor,
    renovacoesPagas,
    bonusAssinaturaTodos,
    estornosPlataforma,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.job.count({ where: { status: { not: "excluido" } } }),
    prisma.job.count({ where: { status: { in: producao } } }),
    prisma.job.count({ where: { status: "pronto" } }),
    prisma.job.count({ where: { status: "erro" } }),
    prisma.user.count({ where: { vistoEm: { gt: online5min } } }),
    prisma.job.findMany({
      where: { status: { not: "excluido" } },
      orderBy: { criadoEm: "desc" },
      take: 12,
      select: {
        id: true,
        produto: true,
        formato: true,
        tipo: true,
        midias: true,
        saidas: true,
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
        assinante: true,
        ferramentasLiberadas: true,
        nivel: true,
        nivelManual: true,
        suspeita: true,
        dividaCentavos: true,
      },
    }),
    prisma.reporteVideo.count({ where: { status: "novo" } }),
    prisma.sugestao.count({ where: { status: "nova" } }),
    prisma.bonusInstagram.count({ where: { status: "pendente" } }),
    contarUsoPorUsuario(),
    // RENOVAÇÃO PAGA de assinatura: o webhook lança "bonus_assinatura" COM o id
    // do pedido (kiwifyOrderId) a cada cobrança recorrente confirmada na
    // processadora; o crédito do 1º mês (garantirCreditoMensal) nasce SEM pedido.
    // Logo, quem tem pelo menos uma dessas linhas renovou pelo menos uma vez.
    // É o mesmo critério que a promoção de nível Ouro já usava (histórico de
    // pagamento real, não inferência) - a "abordagem B" preferida pelo dono.
    prisma.creditoTransacao.findMany({
      where: { tipo: "bonus_assinatura", kiwifyOrderId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    // qualquer bonus_assinatura (1º mês ou renovação) marca quem JÁ FOI assinante
    prisma.creditoTransacao.findMany({
      where: { tipo: "bonus_assinatura" },
      distinct: ["userId"],
      select: { userId: true },
    }),
    // reembolso de ASSINATURA: o estorno do plano é lançado com a descrição
    // "Reembolso da plataforma..." (ver aplicarReembolsoAceito em reembolsos.ts);
    // estorno de pacote de crédito sai como "Estorno: <produto>" e fica de fora
    prisma.creditoTransacao.findMany({
      where: { tipo: "estorno", descricao: { startsWith: "Reembolso da plataforma" } },
      distinct: ["userId"],
      select: { userId: true },
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
      uso: usoPor.get(u.id) ?? usoVazio(),
      vistoEm: u.vistoEm ? u.vistoEm.toISOString() : null,
      online: !!u.vistoEm && u.vistoEm.getTime() > agora - ONLINE_MS,
      assinante: u.assinante,
      ferramentasLiberadas: u.ferramentasLiberadas,
      nivel: u.nivel,
      nivelManual: u.nivelManual,
      suspeita: u.suspeita,
      dividaCentavos: u.dividaCentavos,
    }))
    // online primeiro, depois quem foi visto mais recentemente
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (b.vistoEm ?? "").localeCompare(a.vistoEm ?? "");
    });

  // total de créditos consumidos em produção (todas as pessoas somadas)
  const creditosGastos = gastos.reduce((s, g) => s + Math.abs(g._sum.valor ?? 0), 0);

  // --- recorrência e reembolso de assinatura (só contas de usuário comum) ---
  // admin/demo têm assinatura de cortesia e entortariam a taxa.
  const rolePor = new Map(listaUsuarios.map((u) => [u.id, u.role]));
  // type guard: descarta o userId nulo (transação de conta excluída, auditoria #14)
  const soUser = (id: string | null): id is string => !!id && rolePor.get(id) === "user";
  const idsRecorrentes = new Set(renovacoesPagas.map((r) => r.userId).filter(soUser));
  // "é ou já foi assinante" = tem qualquer bonus_assinatura no extrato OU está
  // com a flag assinante hoje (cobre concessão manual que ainda não ganhou bônus)
  const idsJaAssinantes = new Set(bonusAssinaturaTodos.map((b) => b.userId).filter(soUser));
  for (const u of listaUsuarios) if (u.assinante && u.role === "user") idsJaAssinantes.add(u.id);
  const assinantesRecorrentes = idsRecorrentes.size;
  const totalJaAssinantes = idsJaAssinantes.size;
  const pctRecorrencia =
    totalJaAssinantes > 0 ? (assinantesRecorrentes / totalJaAssinantes) * 100 : 0;
  const reembolsosAssinatura = new Set(
    estornosPlataforma.map((e) => e.userId).filter(soUser),
  ).size;

  return {
    stats: {
      usuarios,
      online,
      videos,
      emProducao,
      prontos,
      erros,
      creditosGastos,
      assinantesRecorrentes,
      totalJaAssinantes,
      pctRecorrencia,
      reembolsosAssinatura,
    },
    pendencias: { reportes: pendReportes, sugestoes: pendSugestoes, bonus: pendBonus },
    grafico,
    usuarios: linhas,
    recentes: recentes.map((r) => ({
      id: r.id,
      produto: r.produto,
      formato: r.formato,
      // vídeo do avatar (Grok) mora em media.../avatares/: mostra como tipo próprio
      tipo:
        (r.midias ?? "").includes("/avatares/") || (r.saidas ?? "").includes("/avatares/")
          ? "avatar"
          : r.tipo || "produto",
      status: r.status,
      criadoEm: r.criadoEm,
      nome: r.user?.nome ?? null,
    })),
  };
}


// ---- Feed de vídeos gerados (admin) ----------------------------------------
export type VideoAdmin = {
  job: VideoJob;
  usuario: { nome: string; email: string };
};

/**
 * Vídeos prontos de TODOS os usuários (mais recentes primeiro), paginado. Só admin.
 * `busca` filtra no BANCO (nome ou e-mail de quem gerou, ou nome do produto), então
 * pega a base inteira: antes o filtro era só na página carregada e dava "não achei"
 * pra quem estava na página seguinte.
 */
export async function getVideosAdmin(opts: {
  pagina: number;
  porPagina: number;
  busca?: string;
}): Promise<{ itens: VideoAdmin[]; total: number; pagina: number; porPagina: number }> {
  const pagina = Math.max(1, opts.pagina);
  const porPagina = Math.min(60, Math.max(1, opts.porPagina));
  const q = (opts.busca ?? "").trim();
  // vídeo "gerado" = job pronto com mídias (tem a URL tocável)
  const where = {
    status: "pronto",
    midias: { not: null },
    ...(q
      ? {
          OR: [
            { produto: { contains: q } },
            { user: { nome: { contains: q } } },
            { user: { email: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: { user: { select: { nome: true, email: true } } },
    }),
  ]);

  const itens: VideoAdmin[] = jobs
    .map((j) => ({
      job: paraVideoJob(j),
      usuario: { nome: j.user?.nome ?? "-", email: j.user?.email ?? "-" },
    }))
    // segurança extra: só entra quem realmente tem mídia tocável
    .filter((v) => (v.job.midias?.length ?? 0) > 0);

  return { itens, total, pagina, porPagina };
}


// ---- Criação dos usuários: vídeo + imagem + avatar numa lista só ------------

/**
 * Junta as 3 tabelas (Job, ImagemGerada, Avatar) dentro do mesmo filtro e
 * ordena por data. O "carregar mais" corta pela data do último item (`antes`),
 * e não por página numerada, porque com 3 fontes o número da página não bate.
 * Rótulos e tipos ficam em `lib/criacoes.ts` (puro, a galeria também usa).
 */
export async function getCriacoes(
  f: FiltroCriacoes,
): Promise<{ itens: ItemCriacao[]; temMais: boolean }> {
  const limite = Math.min(120, Math.max(1, f.limite ?? 60));
  const tipos: TipoCriacao[] = f.tipos?.length ? f.tipos : ["video", "imagem", "avatar"];
  const q = (f.busca ?? "").trim();

  // quem: id exato ganha do texto digitado
  const dono = f.userId
    ? { userId: f.userId }
    : q
      ? { user: { OR: [{ nome: { contains: q } }, { email: { contains: q } }] } }
      : {};

  const desde = f.dias && f.dias > 0 ? new Date(Date.now() - f.dias * 86_400_000) : null;
  const antes = f.antes ? new Date(f.antes) : null;
  const quando =
    desde || antes
      ? {
          criadoEm: {
            ...(desde ? { gte: desde } : {}),
            // "lte" e não "lt": um lote de marca d'água cria vários na mesma
            // fração de segundo, e cortar no "menor que" faria sumir os empatados.
            // A galeria descarta pela chave o que já está na tela.
            ...(antes ? { lte: antes } : {}),
          },
        }
      : {};

  const base = { ...dono, ...quando };
  const take = limite + 1; // o +1 diz se ainda tem mais depois deste lote
  const quem = { user: { select: { id: true, nome: true, email: true } } };

  const [videos, imagens, avatares] = await Promise.all([
    tipos.includes("video")
      ? prisma.job.findMany({
          // "recebendo" é rascunho de upload e "excluido" tem tela própria
          where: { ...base, status: { notIn: ["recebendo", "excluido"] } },
          orderBy: { criadoEm: "desc" },
          take,
          include: quem,
        })
      : [],
    tipos.includes("imagem")
      ? prisma.imagemGerada.findMany({
          where: base,
          orderBy: { criadoEm: "desc" },
          take,
          include: quem,
        })
      : [],
    tipos.includes("avatar")
      ? prisma.avatar.findMany({
          where: base,
          orderBy: { criadoEm: "desc" },
          take,
          include: quem,
        })
      : [],
  ]);

  const itens: ItemCriacao[] = [
    ...videos.map((v) => ({
      chave: `video:${v.id}`,
      id: v.id,
      tipo: "video" as const,
      quando: v.criadoEm.toISOString(),
      titulo: v.produto,
      ferramenta: ferramentaDoVideo(v),
      usuarioId: v.user.id,
      usuarioNome: v.user.nome,
      usuarioEmail: v.user.email,
      job: paraVideoJob(v),
      creditos: null as number | null,
    })),
    ...imagens.map((i) => ({
      chave: `imagem:${i.id}`,
      id: i.id,
      tipo: "imagem" as const,
      quando: i.criadoEm.toISOString(),
      titulo: i.titulo,
      ferramenta: FERRAMENTA_IMAGEM[i.origem] ?? i.origem,
      usuarioId: i.user.id,
      usuarioNome: i.user.nome,
      usuarioEmail: i.user.email,
      imagemUrl: i.imagemUrl,
      extra: i.videos > 0 ? `${i.videos} vídeo${i.videos > 1 ? "s" : ""}` : undefined,
    })),
    ...avatares.map((a) => {
      const origem = origemDoAvatar(a.escolhas);
      return {
        chave: `avatar:${a.id}`,
        id: a.id,
        tipo: "avatar" as const,
        quando: a.criadoEm.toISOString(),
        titulo: a.nome,
        ferramenta: FERRAMENTA_AVATAR[origem] ?? origem,
        usuarioId: a.user.id,
        usuarioNome: a.user.nome,
        usuarioEmail: a.user.email,
        imagemUrl: a.imagemUrl,
        extra: a.genero === "male" ? "Homem" : "Mulher",
      };
    }),
  ].sort((x, y) => (x.quando < y.quando ? 1 : x.quando > y.quando ? -1 : 0));

  const temMais = itens.length > limite;
  const pagina = itens.slice(0, limite);

  // quanto cada vídeo custou de crédito (só dos que ficaram nesta página)
  const idsVideo = pagina.filter((i) => i.tipo === "video").map((i) => i.id);
  if (idsVideo.length) {
    const txs = await prisma.creditoTransacao.findMany({
      where: {
        jobId: { in: idsVideo },
        tipo: { in: ["debito_geracao", "debito_processamento"] },
      },
      select: { jobId: true, valor: true },
    });
    const porJob = new Map<string, number>();
    for (const t of txs) {
      if (!t.jobId) continue;
      porJob.set(t.jobId, (porJob.get(t.jobId) ?? 0) + Math.abs(t.valor));
    }
    for (const item of pagina) {
      if (item.tipo === "video") item.creditos = porJob.get(item.id) ?? null;
    }
  }

  return { itens: pagina, temMais };
}

/** Só o nome da pessoa, pra escrever "criações de fulano" no topo da tela. */
export async function getNomeUsuario(
  userId: string,
): Promise<{ nome: string; email: string } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { nome: true, email: true },
  });
  return u ?? null;
}
