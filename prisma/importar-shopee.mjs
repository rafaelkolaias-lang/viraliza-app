// Importa Produtos e Vídeos virais Shopee pro MySQL, juntando o catálogo
// (data/*.json) com o mapa de IDs do Drive (gerado por `rclone lsjson`).
// Idempotente: usa createMany com skipDuplicates - rode de novo conforme o
// upload dos vídeos for terminando (novos entram, os já existentes são pulados).
//
// Uso:
//   node prisma/importar-shopee.mjs <map_produtos.json> <map_videos.json>
//   (padrão: C:/tmp/map_produtos.json e C:/tmp/map_videos.json)

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const MAP_PROD = process.argv[2] || "C:/tmp/map_produtos.json";
const MAP_VID = process.argv[3] || "C:/tmp/map_videos.json";

function lerJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** Map<nomeDoArquivo, driveId> a partir do lsjson do rclone. */
function mapaDrive(p) {
  const arr = lerJson(p);
  const m = new Map();
  for (const f of arr) if (f.Name && f.ID) m.set(f.Name, f.ID);
  return m;
}

function dataDe(s) {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : new Date();
}

async function criarEmLotes(model, registros, label) {
  let total = 0;
  for (let i = 0; i < registros.length; i += 1000) {
    const lote = registros.slice(i, i + 1000);
    const r = await model.createMany({ data: lote, skipDuplicates: true });
    total += r.count;
  }
  console.log(`  ${label}: ${total} novos (de ${registros.length} com Drive)`);
}

async function main() {
  const raiz = process.cwd();

  // ---- Produtos ----
  const produtos = lerJson(path.join(raiz, "data", "produtos.json"));
  const mapProd = mapaDrive(MAP_PROD);
  const regProd = [];
  for (const p of produtos) {
    const nome = p.arquivo ? path.basename(p.arquivo) : null;
    const driveId = nome ? mapProd.get(nome) : null;
    if (!driveId) continue;
    regProd.push({
      id: p.id,
      driveId,
      titulo: (p.titulo || "Produto").slice(0, 500),
      link: p.link ? p.link.slice(0, 500) : null,
      canal: p.canal || null,
      adicionadoEm: dataDe(p.adicionadoEm),
    });
  }
  console.log(`Produtos: ${produtos.length} no catálogo, ${mapProd.size} no Drive, ${regProd.length} casados`);
  await criarEmLotes(prisma.produtoShopee, regProd, "ProdutoShopee");

  // ---- Vídeos ----
  const videos = lerJson(path.join(raiz, "data", "virais.json"));
  const mapVid = mapaDrive(MAP_VID);
  const regVid = [];
  for (const v of videos) {
    const nome = v.arquivo ? path.basename(v.arquivo) : null;
    const driveId = nome ? mapVid.get(nome) : null;
    if (!driveId) continue;
    regVid.push({
      id: v.id,
      driveId,
      titulo: (v.titulo || "Vídeo").slice(0, 500),
      link: v.link ? v.link.slice(0, 500) : null,
      duracaoSeg: Number.isFinite(v.duracaoSeg) ? v.duracaoSeg : 0,
      canal: v.canal || null,
      adicionadoEm: dataDe(v.adicionadoEm),
    });
  }
  console.log(`Vídeos: ${videos.length} no catálogo, ${mapVid.size} no Drive, ${regVid.length} casados`);
  await criarEmLotes(prisma.videoShopee, regVid, "VideoShopee");

  const [tp, tv] = await Promise.all([
    prisma.produtoShopee.count(),
    prisma.videoShopee.count(),
  ]);
  console.log(`\nTotal no banco agora → Produtos: ${tp} · Vídeos: ${tv}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
