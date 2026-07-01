// Importa (uma vez) os leads dos JSON em data/leads/ pro MySQL (upsert por chave).
// Uso: node prisma/importar-leads.mjs
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function uf(endereco) {
  const m = / - ([A-Z]{2})[,\s]/.exec(endereco || "");
  return m ? m[1] : "";
}
function chaveDe(l) {
  return l.lugar_id || `${l.nome}|${l.cidade ?? ""}`;
}

async function main() {
  // dono dos seeds = admin (Lucas). Sem admin, aborta.
  const admin =
    (await prisma.user.findFirst({ where: { role: "admin" } })) ||
    (await prisma.user.findFirst());
  if (!admin) {
    console.error("Nenhum usuário no banco pra ser dono dos leads.");
    process.exit(1);
  }
  const userId = admin.id;
  console.log(`Dono dos seeds: ${admin.nome} <${admin.email}>`);

  const dir = path.join(process.cwd(), "data", "leads");
  const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  let n = 0;

  for (const f of arquivos) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const arr = Array.isArray(payload) ? payload : payload.leads || [];
    for (const l of arr) {
      if (!l?.nome) continue;
      const dados = {
        lugarId: l.lugar_id || "",
        nome: String(l.nome).slice(0, 255),
        categoria: (l.categoria || "").slice(0, 255),
        telefone: l.telefone || "",
        site: l.site || null,
        email: l.email || "",
        instagram: l.instagram || null,
        whatsapp: l.whatsapp || "",
        redeSocial: l.rede_social || null,
        nota: l.nota === "" || l.nota == null ? null : Number(l.nota),
        totalAvaliacoes: Number(l.total_avaliacoes) || 0,
        scoreLead: Number(l.score_lead) || 0,
        oportunidades: l.oportunidades || null,
        mensagem: l.mensagem_sugerida || null,
        endereco: l.endereco || null,
        googleMaps: l.google_maps || null,
        cidade: (l.cidade || "").slice(0, 255),
        uf: uf(l.endereco).slice(0, 2),
        nicho: (l.nicho || "").slice(0, 255),
        capturadoEm: l.capturado_em || "",
      };
      const chave = chaveDe(l);
      await prisma.lead.upsert({
        where: { userId_chave: { userId, chave } },
        create: { userId, chave, ...dados },
        update: dados,
      });
      n += 1;
      if (n % 100 === 0) console.log(`  ${n}...`);
    }
  }
  console.log(`Importados/atualizados: ${n} leads.`);
}

main()
  .catch((e) => {
    console.error("Falhou:", e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
