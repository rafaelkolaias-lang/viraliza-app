/**
 * Backfill ESTIMADO da tabela GastoApi (aba Financas > gasto por usuario).
 *
 * Por que existe: a medicao real de consumo so comecou em 05/08/2026 (e o worker
 * instrumentado so entrou no serverrk em 06/08/2026). Todo video gerado ANTES
 * disso nao tem linha de gasto, entao a coluna "Custo APIs" por usuario fica
 * zerada pro passado. Este script le os jobs antigos CONCLUIDOS que nao tem
 * nenhuma linha de gasto e grava linhas ESTIMADAS por media, marcadas com
 * origem "backfill:..." pra sempre dar pra identificar (e desfazer).
 *
 * O que ele estima (numeros ajustaveis nas constantes abaixo):
 *  - Video do Lab / Avatar / Boost (Grok): duracao x media de R$0,61 por 10s
 *    (mesma conta do registrarGrokVideo em src/lib/gastos-api.ts).
 *  - Video da fabrica (tipo "produto"): ~7.000 tokens Gemini por variante
 *    (media de 3 jobs MEDIDOS de verdade em 05-06/08/2026: 6.739 / 6.896 / 7.381).
 *    Se o formato for "voz", soma ElevenLabs: ~15 caracteres por segundo de fala.
 *  - Cortes: 1 chamada Gemini (~20.000 tokens, chute documentado; a transcricao
 *    e local/gratis).
 *
 * O que ele NAO estima (de proposito):
 *  - Veo (cena animada da fabrica): sem como saber quais jobs antigos geraram
 *    cena nem quantos segundos; ficaria pura invencao.
 *  - Imagens do Grok: custo padrao e 0 (coberto pela assinatura), so inflaria a
 *    contagem do card.
 *  - OpenAI: o total retroativo REAL vem da fatura oficial (OPENAI_ADMIN_KEY).
 *  - Marca em lote / MapsLeads / Editor sem IA: nao usam API paga.
 *
 * Uso (na raiz do projeto, precisa do DATABASE_URL no .env ou no ambiente):
 *   node scripts/backfill-gastos-api.mjs             -> DRY-RUN: so mostra o que faria
 *   node scripts/backfill-gastos-api.mjs --aplicar   -> grava as linhas no banco
 *   node scripts/backfill-gastos-api.mjs --desfazer  -> apaga TODAS as linhas "backfill:"
 *
 * Idempotente: job que ja tem qualquer linha de gasto e pulado, entao rodar duas
 * vezes nao duplica. As linhas nascem com criadoEm = data do job, pra cair no
 * periodo certo do filtro da aba Financas.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Constantes da estimativa (mesmas fontes de src/lib/gastos-api.ts e precos.ts)
// ---------------------------------------------------------------------------
const CAMBIO = Number(process.env.USD_BRL || "") || 5.5; // R$ por US$
const GEMINI_USD_MTOK = 0.3; // gemini-2.5-flash, US$ por 1M tokens
const ELEVEN_USD_MIL_CHARS = 0.18; // ElevenLabs, US$ por 1000 caracteres
const GROK_CENTAVOS_10S = Number(process.env.GROK_CUSTO_10S_CENTAVOS || "") || 61;

const TOKENS_GEMINI_FABRICA = 7000; // media real medida (3 jobs instrumentados)
const TOKENS_GEMINI_CORTES = 20000; // chute: transcricao inteira + escolha dos momentos
const CHARS_VOZ_POR_SEG = 15; // fala ~150 palavras/min ~= 15 chars/seg
const DURACAO_NOMINAL_SEG = 35; // job sem duracao gravada (igual precos.ts)
const DURACAO_GROK_PADRAO = 10; // video de IA sem duracao gravada

const miliDeUsd = (usd) => Math.max(0, Math.round(usd * CAMBIO * 100_000));
const miliDeCentavos = (c) => Math.max(0, Math.round(c * 1000));

// ---------------------------------------------------------------------------

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(path.join(raiz, ".env"), "utf8");
    const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) process.env.DATABASE_URL = m[1];
  } catch {}
}
if (!process.env.DATABASE_URL) {
  console.error("Sem DATABASE_URL (nem no ambiente, nem no .env). Abortando.");
  process.exit(1);
}

const APLICAR = process.argv.includes("--aplicar");
const DESFAZER = process.argv.includes("--desfazer");
const prisma = new PrismaClient();

const fmtReais = (mili) =>
  (mili / 100_000).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function desfazer() {
  const quantas = await prisma.gastoApi.count({
    where: { origem: { startsWith: "backfill" } },
  });
  if (!quantas) {
    console.log("Nenhuma linha de backfill no banco. Nada a desfazer.");
    return;
  }
  const r = await prisma.gastoApi.deleteMany({
    where: { origem: { startsWith: "backfill" } },
  });
  console.log(`Apagadas ${r.count} linhas de backfill.`);
}

async function principal() {
  // 1. Jobs concluidos (pronto ou excluido depois de pronto): so eles gastaram API.
  const jobs = await prisma.job.findMany({
    where: { status: { in: ["pronto", "excluido"] } },
    select: {
      id: true,
      userId: true,
      tipo: true,
      formato: true,
      variantes: true,
      duracao: true,
      opcoes: true,
      saidas: true,
      midias: true,
      criadoEm: true,
    },
    orderBy: { criadoEm: "asc" },
  });

  // 2. Jobs que JA tem linha de gasto (medida ou de backfill anterior): fora.
  const comGasto = new Set(
    (
      await prisma.gastoApi.findMany({
        where: { jobId: { not: null } },
        select: { jobId: true },
        distinct: ["jobId"],
      })
    ).map((l) => l.jobId),
  );

  const linhas = []; // o que sera inserido
  const resumo = { grok: 0, fabrica: 0, cortes: 0, pulados: 0, jaMedidos: 0 };
  const porUsuario = new Map(); // userId -> custoMili

  for (const job of jobs) {
    if (comGasto.has(job.id)) {
      resumo.jaMedidos++;
      continue;
    }

    let opcoes = {};
    try {
      opcoes = JSON.parse(job.opcoes || "{}");
    } catch {}

    const variantes = Math.max(1, job.variantes || 1);
    const somar = (linha) => {
      linhas.push({ ...linha, userId: job.userId, jobId: job.id, criadoEm: job.criadoEm });
      porUsuario.set(job.userId, (porUsuario.get(job.userId) ?? 0) + linha.custoMili);
    };

    // Avatar antigo nascia SEM marca nas opcoes; o plano B e o mesmo do admin
    // (ferramentaDoJob em src/lib/criacoes.ts): saidas/midias em "/avatares/".
    const avatarAntigo =
      !opcoes.lab && !opcoes.avatar && !opcoes.boost &&
      ((job.saidas ?? "").includes("/avatares/") || (job.midias ?? "").includes("/avatares/"));

    if (job.tipo === "produto" && (opcoes.lab || opcoes.avatar || opcoes.boost || avatarAntigo)) {
      // Video de IA (Grok): mesma conta media do site
      const origem = opcoes.lab
        ? "backfill:lab-video"
        : opcoes.avatar || avatarAntigo
          ? "backfill:avatar-video"
          : "backfill:boost-video";
      const seg = Math.max(1, job.duracao || DURACAO_GROK_PADRAO);
      somar({
        api: "grok",
        recurso: "segundos",
        quantidade: seg,
        custoMili: miliDeCentavos((seg / 10) * GROK_CENTAVOS_10S),
        origem,
      });
      resumo.grok++;
    } else if (job.tipo === "produto") {
      // Fabrica (video do produto): Gemini sempre, Eleven se narrado
      const tokens = TOKENS_GEMINI_FABRICA * variantes;
      somar({
        api: "gemini",
        recurso: "tokens",
        quantidade: tokens,
        custoMili: miliDeUsd((tokens / 1_000_000) * GEMINI_USD_MTOK),
        origem: "backfill:fabrica",
      });
      if (job.formato === "voz") {
        const seg = Math.max(1, job.duracao || DURACAO_NOMINAL_SEG);
        const chars = seg * CHARS_VOZ_POR_SEG * variantes;
        somar({
          api: "eleven",
          recurso: "chars",
          quantidade: chars,
          custoMili: miliDeUsd((chars / 1000) * ELEVEN_USD_MIL_CHARS),
          origem: "backfill:fabrica",
        });
      }
      resumo.fabrica++;
    } else if (job.tipo === "cortes") {
      somar({
        api: "gemini",
        recurso: "tokens",
        quantidade: TOKENS_GEMINI_CORTES,
        custoMili: miliDeUsd((TOKENS_GEMINI_CORTES / 1_000_000) * GEMINI_USD_MTOK),
        origem: "backfill:cortes",
      });
      resumo.cortes++;
    } else {
      resumo.pulados++; // marca em lote etc: sem API paga
    }
  }

  // 3. Relatorio
  const totalMili = linhas.reduce((s, l) => s + l.custoMili, 0);
  const porApi = new Map();
  for (const l of linhas) porApi.set(l.api, (porApi.get(l.api) ?? 0) + l.custoMili);

  console.log(`Jobs concluidos no banco: ${jobs.length}`);
  console.log(`  ja tinham consumo medido (pulados): ${resumo.jaMedidos}`);
  console.log(`  sem API paga (marca/outros, pulados): ${resumo.pulados}`);
  console.log(`  a estimar -> Grok: ${resumo.grok} | fabrica: ${resumo.fabrica} | cortes: ${resumo.cortes}`);
  console.log(`Linhas de gasto a criar: ${linhas.length}`);
  for (const [api, mili] of porApi) console.log(`  ${api}: ${fmtReais(mili)}`);
  console.log(`Custo total estimado do periodo antigo: ${fmtReais(totalMili)}`);

  const top = [...porUsuario.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) {
    const contas = await prisma.user.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      select: { id: true, email: true },
    });
    const emailPorId = new Map(contas.map((c) => [c.id, c.email]));
    console.log("Top 10 usuarios (custo estimado):");
    for (const [id, mili] of top) {
      console.log(`  ${emailPorId.get(id) ?? id}: ${fmtReais(mili)}`);
    }
  }

  if (!APLICAR) {
    console.log("\nDRY-RUN: nada foi gravado. Rode com --aplicar pra gravar.");
    return;
  }

  if (linhas.length) {
    const r = await prisma.gastoApi.createMany({ data: linhas });
    console.log(`\nGravadas ${r.count} linhas (origem "backfill:...").`);
    console.log('Pra desfazer: node scripts/backfill-gastos-api.mjs --desfazer');
  } else {
    console.log("\nNada a gravar.");
  }
}

try {
  if (DESFAZER) await desfazer();
  else await principal();
} finally {
  await prisma.$disconnect();
}
