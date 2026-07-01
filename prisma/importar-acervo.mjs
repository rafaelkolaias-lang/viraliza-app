// Importa o catálogo do acervo (data/acervo.json) pro MySQL.
// Uso: node prisma/importar-acervo.mjs
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const p = path.join(process.cwd(), "data", "acervo.json");
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  const categorias = d.categorias || [];
  const itens = d.itens || {};

  // limpa pra reimportar do zero
  await prisma.acervoVideo.deleteMany();
  await prisma.acervoCategoria.deleteMany();

  // categorias (com ordem = posição na lista)
  await prisma.acervoCategoria.createMany({
    data: categorias.map((c, i) => ({
      slug: c.slug,
      nome: c.nome,
      cover: c.cover || "",
      ordem: i,
      total: c.count || (itens[c.slug] || []).length,
    })),
    skipDuplicates: true,
  });

  // vídeos (todos juntos, em lotes)
  const todos = [];
  for (const c of categorias) {
    for (const it of itens[c.slug] || []) {
      if (!it.id) continue;
      todos.push({
        driveId: it.id,
        nome: String(it.nome || "").slice(0, 300),
        categoriaSlug: c.slug,
      });
    }
  }

  let inseridos = 0;
  for (const lote of chunk(todos, 2000)) {
    const r = await prisma.acervoVideo.createMany({
      data: lote,
      skipDuplicates: true,
    });
    inseridos += r.count;
    console.log(`  ${inseridos}/${todos.length}...`);
  }

  console.log(
    `OK: ${categorias.length} categorias, ${inseridos} vídeos no MySQL.`,
  );
}

main()
  .catch((e) => {
    console.error("Falhou:", e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
