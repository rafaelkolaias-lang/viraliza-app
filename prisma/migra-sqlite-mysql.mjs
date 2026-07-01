// Migração ÚNICA: copia usuários + jobs do SQLite antigo (/app/data/prod.db)
// pro MySQL novo. Roda no entrypoint a cada boot, mas é idempotente:
//  - se não existe o prod.db antigo  -> não faz nada
//  - se o MySQL já tem usuários       -> não faz nada (já migrou)
// Lê SQLite com o módulo NATIVO do Node 22 (node:sqlite) - sem dependência extra.
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const SQLITE_PATH = process.env.SQLITE_ANTIGO || "/app/data/prod.db";

function dt(v) {
  // Prisma/SQLite guarda DateTime como ms (número) ou texto ISO. Aceita os dois.
  const d = v == null ? null : new Date(v);
  return d && !isNaN(d.getTime()) ? d : new Date();
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.log(`→ migração: sem ${SQLITE_PATH} (nada a migrar).`);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const jaTem = await prisma.user.count();
    if (jaTem > 0) {
      console.log(`→ migração: MySQL já tem ${jaTem} usuário(s) - pulando.`);
      return;
    }

    const db = new DatabaseSync(SQLITE_PATH);
    const users = db.prepare("SELECT * FROM User").all();
    const jobs = db.prepare("SELECT * FROM Job").all();
    db.close();
    console.log(`→ migração: ${users.length} usuário(s) e ${jobs.length} job(s) do SQLite...`);

    const usersData = users.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      senhaHash: u.senhaHash,
      role: u.role || "user",
      bloqueado: !!u.bloqueado,
      criadoEm: dt(u.criadoEm),
    }));

    const jobsData = jobs.map((j) => ({
      id: j.id,
      userId: j.userId,
      produto: j.produto,
      descricao: j.descricao ?? null,
      formato: j.formato || "legenda",
      tom: j.tom || "agressivo",
      variantes: j.variantes ?? 1,
      preco: j.preco ?? null,
      legendaPos: j.legendaPos || "baixo",
      status: j.status || "na_fila",
      duracao: j.duracao ?? null,
      saidas: j.saidas ?? null,
      midias: j.midias ?? null,
      erro: j.erro ?? null,
      criadoEm: dt(j.criadoEm),
    }));

    // usuários primeiro (jobs referenciam userId), tudo numa transação
    await prisma.$transaction([
      prisma.user.createMany({ data: usersData, skipDuplicates: true }),
      prisma.job.createMany({ data: jobsData, skipDuplicates: true }),
    ]);

    console.log("→ migração: concluída ✓");
  } finally {
    await prisma.$disconnect();
  }
}

// nunca derruba o boot por causa da migração - loga e segue
main().catch((e) => {
  console.error("→ migração FALHOU (seguindo o boot):", e?.message || e);
  process.exit(0);
});
