import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  NotificacoesAdmin,
  type AdminAviso,
  type AdminLote,
  type AdminUsuarioOpt,
} from "@/components/app/notificacoes-admin";

export const metadata: Metadata = { title: "Admin · Notificações" };
export const dynamic = "force-dynamic";

export default async function AdminNotificacoesPage() {
  await requireAdmin();

  const [users, avisosRaw, lotesRaw] = await Promise.all([
    prisma.user.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, email: true },
    }),
    prisma.aviso.findMany({ orderBy: { criadoEm: "desc" } }),
    // envios em massa do sininho (loteId != null) - agrupo em JS
    prisma.notificacao.findMany({
      where: { loteId: { not: null } },
      orderBy: { criadoEm: "desc" },
      take: 400,
      select: { loteId: true, titulo: true, criadoEm: true },
    }),
  ]);

  // nome do usuário alvo de cada barra (pra mostrar "Para: fulano")
  const alvoIds = [...new Set(avisosRaw.map((a) => a.alvoUserId).filter(Boolean))] as string[];
  const alvos = alvoIds.length
    ? await prisma.user.findMany({
        where: { id: { in: alvoIds } },
        select: { id: true, nome: true },
      })
    : [];
  const nomePorId = new Map(alvos.map((u) => [u.id, u.nome]));

  const usuarios: AdminUsuarioOpt[] = users;

  const avisos: AdminAviso[] = avisosRaw.map((a) => ({
    id: a.id,
    mensagem: a.mensagem,
    cor: (["laranja", "vermelho", "azul", "verde"].includes(a.cor)
      ? a.cor
      : "azul") as AdminAviso["cor"],
    link: a.link,
    ativo: a.ativo,
    alvo: a.alvoUserId ? (nomePorId.get(a.alvoUserId) ?? "usuário") : null,
    criadoEm: a.criadoEm.toISOString(),
  }));

  // agrupa por loteId: título representativo, contagem e data mais recente
  const mapa = new Map<string, AdminLote>();
  for (const n of lotesRaw) {
    if (!n.loteId) continue;
    const atual = mapa.get(n.loteId);
    if (atual) {
      atual.total += 1;
    } else {
      mapa.set(n.loteId, {
        loteId: n.loteId,
        titulo: n.titulo,
        total: 1,
        criadoEm: n.criadoEm.toISOString(),
      });
    }
  }
  const lotes: AdminLote[] = [...mapa.values()];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notificações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envie avisos no sininho ou publique uma barra colorida no topo do site.
        </p>
      </div>

      <NotificacoesAdmin usuarios={usuarios} avisos={avisos} lotes={lotes} />
    </div>
  );
}
