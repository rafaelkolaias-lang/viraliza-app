// Migra os dados do banco ANTIGO (editor, via túnel SSH 3307) para o banco NOVO
// do EasyPanel (db_viraliza, host externo 3306). Idempotente: pode rodar de novo
// (usa skipDuplicates). NÃO copia CreditoTransacao/Notificacao/Aviso (recomeça a
// carteira/avisos do zero no modelo novo).
//
// Rodar com o TÚNEL SSH aberto (ssh -L 3307:127.0.0.1:33060 lucas@192.168.15.50):
//   cd ViralizarApp-V3 && node prisma/migrar-editor-para-viraliza.mjs

import { PrismaClient } from "@prisma/client";

// URL do banco antigo vem por env (NUNCA hardcoded — vaza segredo no git):
//   URL_ANTIGO="mysql://mysql:SENHA@127.0.0.1:3307/editor" node prisma/migrar-editor-para-viraliza.mjs
const URL_ANTIGO = process.env.URL_ANTIGO;
const URL_NOVO = process.env.DATABASE_URL; // do .env = db_viraliza no EasyPanel

if (!URL_ANTIGO) {
  console.error("Defina URL_ANTIGO (conexão do banco antigo) na env antes de rodar.");
  process.exit(1);
}

const antigo = new PrismaClient({ datasources: { db: { url: URL_ANTIGO } } });
const novo = new PrismaClient({ datasources: { db: { url: URL_NOVO } } });

const LOTE = 2000;

// Colunas booleanas por tabela (mysql retorna 0/1 -> precisa virar boolean no Prisma)
const BOOLS = { User: ["bloqueado"], Lead: [] };

function coagir(rows, tabela) {
  const bools = BOOLS[tabela] || [];
  for (const r of rows) {
    for (const b of bools) if (b in r) r[b] = !!r[b];
  }
  return rows;
}

async function migrarTabela(tabela, modelo, { colunas } = {}) {
  // lê do antigo via SQL cru (só colunas que existem lá; colunas novas ficam default)
  const sel = colunas ? colunas.map((c) => `\`${c}\``).join(", ") : "*";
  let rows;
  try {
    rows = await antigo.$queryRawUnsafe(`SELECT ${sel} FROM \`${tabela}\``);
  } catch (e) {
    console.log(`  ✗ ${tabela}: erro lendo antigo -> ${String(e.message).slice(0, 80)}`);
    return;
  }
  coagir(rows, tabela);
  const total = rows.length;
  let inseridos = 0;
  for (let i = 0; i < total; i += LOTE) {
    const chunk = rows.slice(i, i + LOTE);
    const r = await novo[modelo].createMany({ data: chunk, skipDuplicates: true });
    inseridos += r.count;
    process.stdout.write(`\r  ${tabela}: ${Math.min(i + LOTE, total)}/${total} (novos: ${inseridos})   `);
  }
  console.log(`\r  ✓ ${tabela}: ${total} lidos, ${inseridos} inseridos (resto já existia)      `);
}

async function main() {
  console.log("Migrando editor -> db_viraliza\n");

  // 1) Biblioteca (sem FK pra User)
  await migrarTabela("AcervoCategoria", "acervoCategoria");
  await migrarTabela("AcervoVideo", "acervoVideo");
  await migrarTabela("ProdutoShopee", "produtoShopee");
  await migrarTabela("VideoShopee", "videoShopee");

  // 2) Usuários (colunas novas de carteira ficam no default: saldo 0, sem assinatura)
  await migrarTabela("User", "user", {
    colunas: ["id", "nome", "email", "senhaHash", "role", "bloqueado", "criadoEm"],
  });

  // 3) Dependentes de User
  await migrarTabela("Lead", "lead");
  await migrarTabela("Job", "job", {
    colunas: ["id", "userId", "produto", "descricao", "tipo", "fonte", "opcoes",
      "formato", "tom", "variantes", "preco", "legendaPos", "status", "duracao",
      "saidas", "midias", "erro", "criadoEm"],
  });

  console.log("\nConcluído.");
  await antigo.$disconnect();
  await novo.$disconnect();
}

main().catch(async (e) => {
  console.error("\nFALHA:", e.message);
  await antigo.$disconnect().catch(() => {});
  await novo.$disconnect().catch(() => {});
  process.exit(1);
});
