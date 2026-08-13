import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { OrigemVideo, VideoFormato, VideoJob, VideoMidia } from "@/lib/types";

// Mídia enviada pelo usuário (entrada da fábrica) - fora do public, baixada pelo worker.
export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");
// Vídeos prontos (saída) - servidos pela web em /videos/<id>/...
export const VIDEOS_OUT_DIR = path.join(process.cwd(), "public", "videos");

export function pastaEntrada(jobId: string) {
  return path.join(UPLOADS_DIR, jobId);
}
export function pastaSaida(jobId: string) {
  return path.join(VIDEOS_OUT_DIR, jobId);
}

/** Tipo do banco -> formato que os componentes usam. */
export function paraVideoJob(job: {
  id: string;
  produto: string;
  tipo: string;
  formato: string;
  status: string;
  variantes: number;
  duracao: number | null;
  saidas: string | null;
  midias: string | null;
  erro: string | null;
  etapa: string | null;
  criadoEm: Date;
  opcoes?: string | null;
}): VideoJob {
  let saidas: string[] = [];
  try {
    if (job.saidas) saidas = JSON.parse(job.saidas) as string[];
  } catch {
    /* ignora json inválido */
  }
  let midias: VideoMidia[] = [];
  try {
    if (job.midias) midias = JSON.parse(job.midias) as VideoMidia[];
  } catch {
    /* ignora json inválido */
  }
  // de onde o vídeo veio: o Lab e o Boost marcam isso nas opções na hora de criar
  let origem: OrigemVideo = job.tipo === "cortes" ? "cortes" : "editor";
  let audioAjustavel = false;
  let ehAvatar = false;
  let volumes: VideoJob["volumes"];
  try {
    const o = job.opcoes
      ? (JSON.parse(job.opcoes) as {
          lab?: boolean;
          boost?: boolean;
          avatar?: boolean;
          stems?: { orig?: string; musica?: string; voz?: string };
          volumes?: { original?: number; musica?: number; voz?: number };
        })
      : null;
    if (o?.boost) origem = "boost";
    else if (o?.lab) origem = "lab";
    ehAvatar = !!o?.avatar;
    // faixas separadas guardadas no render = dá pra refazer só o áudio depois
    audioAjustavel = !!(o?.stems && (o.stems.orig || o.stems.musica || o.stems.voz));
    if (audioAjustavel) {
      volumes = {
        original: Math.round(o?.volumes?.original ?? 100),
        musica: Math.round(o?.volumes?.musica ?? 20),
        voz: Math.round(o?.volumes?.voz ?? 100),
      };
    }
  } catch {
    /* opções inválidas: fica com o padrão */
  }

  return {
    id: job.id,
    produto: job.produto,
    tipo: job.tipo || "produto",
    origem,
    formato: (["voz", "transcrever", "nenhum"].includes(job.formato) ? job.formato : "legenda") as VideoFormato,
    status: job.status as VideoJob["status"],
    variantes: job.variantes,
    criadoEm: job.criadoEm.toISOString(),
    duracaoSeg: job.duracao ?? undefined,
    saidas,
    midias,
    erro: job.erro ?? undefined,
    etapa: job.etapa ?? undefined,
    audioAjustavel,
    ehAvatar: ehAvatar || undefined,
    volumes,
  };
}

export async function getJobsDoUsuario(userId: string): Promise<VideoJob[]> {
  const jobs = await prisma.job.findMany({
    // "recebendo" = rascunho no upload; "excluido" = a pessoa apagou (fica só
    // pro admin auditar em /admin/excluidos). Nenhum dos dois aparece aqui.
    where: { userId, status: { notIn: ["recebendo", "excluido"] } },
    orderBy: { criadoEm: "desc" },
  });
  const lista = jobs.map(paraVideoJob);

  // créditos debitados por job (custo real), pra mostrar no card
  const ids = lista.map((j) => j.id);
  if (ids.length) {
    const txs = await prisma.creditoTransacao.findMany({
      where: {
        jobId: { in: ids },
        tipo: { in: ["debito_geracao", "debito_processamento"] },
      },
      select: { jobId: true, valor: true },
    });
    const porJob = new Map<string, number>();
    for (const t of txs) {
      if (!t.jobId) continue;
      porJob.set(t.jobId, (porJob.get(t.jobId) ?? 0) + Math.abs(t.valor));
    }
    for (const j of lista) {
      const c = porJob.get(j.id);
      if (c) j.creditosGastos = c;
    }
  }
  return lista;
}

/** Só a CONTAGEM dos vídeos do usuário (prontos e em produção), pra tela de Início.
 *  Existe separado do `getJobsDoUsuario` de propósito: a Início só quer os dois
 *  números, e ali seria carregar todos os jobs (mais a consulta de créditos gastos)
 *  pra jogar tudo fora depois. Aqui são dois `count`, sem trazer linha nenhuma. */
export async function contarVideosDoUsuario(userId: string) {
  const [prontos, emProducao] = await Promise.all([
    prisma.job.count({ where: { userId, status: "pronto" } }),
    prisma.job.count({
      // mesmos 3 status que o painel trata como "em produção"
      where: {
        userId,
        status: { in: ["preparando", "na_fila", "renderizando", "processando"] },
      },
    }),
  ]);
  return { prontos, emProducao };
}

/** A ficha de uma cena do roteiro guardado no job (pro reuso no editor). */
export type CenaReuso = {
  nome: string;
  tipo?: string; // "video" | "image"
  papel?: string; // "principal" | "apoio"
  in?: number;
  out?: number;
  entra?: number | null;
  trecho?: number | null;
  /** tamanho manual escolhido no painel da etapa 5 (fica na tela esse tempo) */
  dura?: number | null;
  descricao?: string;
};

/**
 * Config de um vídeo pra REUTILIZAR no editor (mesmos ajustes). Só do dono.
 * Não serve pra cortes (esses têm fluxo próprio). null = não achou/não aplica.
 *
 * REUSO COMPLETO (tarefa 21): além dos campos textuais, devolve o que estava no
 * `opcoes` (roteiro das cenas, volumes, textos, edição, corte de silêncio...) e,
 * quando a pasta de entrada AINDA existe no servidor (retenção de 24h), a lista
 * das mídias originais em `midiasServidor` - a tela baixa cada uma e devolve os
 * arquivos pré-carregados sem a pessoa subir nada de novo.
 */
export async function getConfigReuso(userId: string, id: string) {
  const j = await prisma.job.findFirst({
    where: { id, userId },
    select: {
      id: true,
      produto: true,
      descricao: true,
      preco: true,
      formato: true,
      vozId: true,
      tom: true,
      legendaPos: true,
      tipo: true,
      opcoes: true,
    },
  });
  if (!j || j.tipo === "cortes") return null;

  // o `opcoes` guarda a montagem inteira que a tela mandou na geração original
  let o: {
    semCopy?: boolean;
    semMusica?: boolean;
    musica?: string;
    audioVideo?: string;
    legendaEstilo?: string;
    volumes?: { original?: number; musica?: number; voz?: number };
    velocidadeMusica?: number;
    cortarSilencio?: number;
    roteiroFala?: string;
    edicao?: Record<string, boolean>;
    textos?: { texto?: string; pos?: string; in?: number; out?: number }[];
    roteiro?: CenaReuso[];
  } = {};
  try {
    if (j.opcoes) o = JSON.parse(j.opcoes);
  } catch {
    /* opções inválidas: segue só com o textual */
  }

  const cenas: CenaReuso[] = Array.isArray(o.roteiro)
    ? o.roteiro.filter((c): c is CenaReuso => !!c && typeof c.nome === "string")
    : [];

  // mídias de entrada ainda no servidor? (a limpeza roda em 24h)
  const midiasServidor: { nome: string; tamanho: number }[] = [];
  for (const sub of ["videos", "imagens"] as const) {
    let nomes: string[] = [];
    try {
      nomes = await fs.readdir(path.join(pastaEntrada(j.id), sub));
    } catch {
      continue; // subpasta não existe (ou a entrada inteira já expirou)
    }
    for (const nome of nomes) {
      try {
        const st = await fs.stat(path.join(pastaEntrada(j.id), sub, nome));
        if (st.isFile()) midiasServidor.push({ nome, tamanho: st.size });
      } catch {
        /* arquivo sumiu no meio: segue */
      }
    }
  }

  return {
    jobId: j.id,
    nome: j.produto,
    descricao: j.descricao ?? "",
    preco: j.preco ?? "",
    formato: (["voz", "transcrever", "nenhum"].includes(j.formato) ? j.formato : "legenda") as "legenda" | "voz" | "transcrever" | "nenhum",
    // mesmo padrão da tela e da rota (dono, 12/08/2026; era agressivo). Só cai
    // aqui job antigo que ficou sem tom gravado.
    tom: j.tom || "equilibrado",
    legendaPos: j.legendaPos || "baixo",
    voz: j.vozId ?? undefined,
    ehProduto: !o.semCopy,
    audioVideo: (o.audioVideo === "remover" ? "remover" : "manter") as "manter" | "remover",
    comMusica: !o.semMusica,
    musicaNome: typeof o.musica === "string" ? o.musica : "",
    legendaEstilo:
      o.legendaEstilo === "palavra" || o.legendaEstilo === "completo"
        ? (o.legendaEstilo as "palavra" | "completo")
        : undefined,
    volumes: o.volumes,
    velocidadeMusica: typeof o.velocidadeMusica === "number" ? o.velocidadeMusica : undefined,
    cortarSilencio: typeof o.cortarSilencio === "number" ? o.cortarSilencio : undefined,
    roteiroFala: typeof o.roteiroFala === "string" ? o.roteiroFala : "",
    edicao: o.edicao,
    textos: Array.isArray(o.textos) ? o.textos : [],
    cenas,
    midiasServidor: midiasServidor.length ? midiasServidor : undefined,
  };
}

// ---------------------------------------------------------------------------
// Retenção das mídias de ENTRADA (tarefa 21): a pasta `data/uploads/<jobId>`
// fica 24h no servidor depois da criação do job, pro "Tentar Novamente" e o
// "Editar novamente" reaproveitarem os arquivos sem upload de novo. A limpeza
// roda na varredura periódica do instrumentation.ts.
// ---------------------------------------------------------------------------

const RETENCAO_ENTRADA_MS = 24 * 60 * 60 * 1000;
/** Job nesses status ainda vai usar (ou está usando) a entrada: nunca limpar. */
const STATUS_ENTRADA_VIVA = new Set([
  "recebendo",
  "preparando",
  "na_fila",
  "renderizando",
  "processando",
]);

/**
 * Rascunho de upload largado no meio.
 *
 * Desde 11/08/2026 o Editor sobe cada mídia já na etapa 3, num job "recebendo"
 * que só serve de depósito. Quem desistir antes de gerar deixa esses arquivos
 * pra trás, e "recebendo" está na lista de entrada viva, ou seja, nunca seria
 * limpo. Passado esse prazo o rascunho vira lixo: a pasta some E a linha
 * "recebendo" do banco também (auditoria #29 - antes ela ficava pra sempre e
 * qualquer contagem nova que esquecesse de filtrar contaria rascunho como
 * vídeo). Só linha em "recebendo" é apagada, nunca um vídeo de verdade.
 */
const RASCUNHO_ABANDONADO_MS = 12 * 60 * 60 * 1000;

/**
 * "preparando" preso: o navegador que ia terminar o encaixe das cenas sumiu
 * (aba fechada, queda de luz). O job não pode ficar de enfeite ocupando vaga de
 * simultâneo pra sempre, então vira erro com o motivo escrito. Como a mídia de
 * entrada continua no servidor pelas 24h de sempre, o "Tentar Novamente" do card
 * reabre o Editor com tudo no lugar.
 */
const PREPARANDO_PRESO_MS = 30 * 60 * 1000;

/** Fecha os jobs que ficaram esperando um navegador que não voltou. */
export async function encerrarPreparandoPresos() {
  const limite = new Date(Date.now() - PREPARANDO_PRESO_MS);
  await prisma.job
    .updateMany({
      where: { status: "preparando", criadoEm: { lt: limite } },
      data: {
        status: "erro",
        etapa: null,
        erro:
          "A preparação do vídeo não terminou: a aba foi fechada antes de a IA " +
          "encaixar as cenas. Use o Tentar Novamente, que as suas mídias continuam aqui.",
      },
    })
    .catch(() => {});
}

/** Apaga as pastas de entrada com mais de 24h de jobs já encerrados. */
export async function limparEntradasVencidas() {
  let nomes: string[] = [];
  try {
    nomes = await fs.readdir(UPLOADS_DIR);
  } catch {
    return; // pasta de uploads nem existe ainda
  }
  if (!nomes.length) return;

  const agora = Date.now();
  const jobs = await prisma.job.findMany({
    where: { id: { in: nomes } },
    select: { id: true, status: true, criadoEm: true },
  });
  const porId = new Map(jobs.map((jb) => [jb.id, jb]));

  for (const nome of nomes) {
    const j = porId.get(nome);
    // rascunho velho perde a proteção de "entrada viva": ninguém vai gerar
    // vídeo com ele mais, e sem isso o disco só cresce
    const rascunhoLargado =
      j?.status === "recebendo" &&
      agora - j.criadoEm.getTime() >= RASCUNHO_ABANDONADO_MS;
    if (j && STATUS_ENTRADA_VIVA.has(j.status) && !rascunhoLargado) continue;
    if (rascunhoLargado) {
      await fs
        .rm(path.join(UPLOADS_DIR, nome), { recursive: true, force: true })
        .catch(() => {});
      // a linha do depósito sai junto (auditoria #29); condicional no status
      // pra nunca derrubar um job que virou vídeo nesse meio tempo
      await prisma.job
        .deleteMany({ where: { id: nome, status: "recebendo" } })
        .catch(() => {});
      continue;
    }
    // referência de idade: a criação do job; pasta órfã (job apagado do banco)
    // usa a data da própria pasta
    let ref = j?.criadoEm.getTime() ?? 0;
    if (!ref) {
      try {
        ref = (await fs.stat(path.join(UPLOADS_DIR, nome))).mtimeMs;
      } catch {
        ref = 0;
      }
    }
    if (agora - ref < RETENCAO_ENTRADA_MS) continue;
    await fs
      .rm(path.join(UPLOADS_DIR, nome), { recursive: true, force: true })
      .catch(() => {});
  }

  // rascunho que nem chegou a ter pasta (criou o depósito e fechou a aba antes
  // do 1º pedaço) não aparece no readdir ali de cima, então a linha dele é
  // varrida direto no banco (auditoria #29)
  await prisma.job
    .deleteMany({
      where: {
        status: "recebendo",
        criadoEm: { lt: new Date(agora - RASCUNHO_ABANDONADO_MS) },
      },
    })
    .catch(() => {});
}

/**
 * Vídeo JÁ PRONTO que a pessoa mandou cortar ("Cortar", em Meus vídeos).
 *
 * Devolve o endereço pra tocar na timeline e o nome do arquivo no servidor. A
 * fonte sai do banco, não do endereço da barra: assim a tela do cortador nunca
 * vira um jeito de mandar o servidor buscar um arquivo qualquer, e quem não é o
 * dono do vídeo simplesmente não acha nada.
 *
 * `null` = não é dele, não ficou pronto, é um lote de cortes (esse tem tela
 * própria) ou o arquivo não existe mais.
 */
export async function getVideoParaCortar(userId: string, id: string) {
  const j = await prisma.job.findFirst({
    where: { id, userId, status: "pronto" },
    select: { id: true, produto: true, tipo: true, duracao: true, saidas: true, midias: true },
  });
  if (!j || j.tipo === "cortes") return null;

  const v = paraVideoJob({
    ...j,
    formato: "nenhum",
    status: "pronto",
    variantes: 1,
    erro: null,
    etapa: null,
    criadoEm: new Date(),
  });
  const caminho = v.midias?.[0]?.arquivo || v.saidas?.[0];
  if (!caminho) return null;

  return {
    jobId: j.id,
    nome: j.produto,
    url: caminho,
    duracaoSeg: j.duracao ?? 0,
  };
}

/** Um job específico do usuário (ou null) - pra página de detalhe dos cortes. */
export async function getJobDoUsuario(
  userId: string,
  id: string,
): Promise<VideoJob | null> {
  const job = await prisma.job.findFirst({
    where: { id, userId, status: { not: "excluido" } },
  });
  return job ? paraVideoJob(job) : null;
}
