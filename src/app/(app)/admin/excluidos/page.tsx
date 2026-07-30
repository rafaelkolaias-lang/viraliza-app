import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AdminExcluidos, type ExcluidoDTO } from "@/components/app/admin-excluidos";

export const metadata: Metadata = { title: "Admin · Vídeos excluídos" };
export const dynamic = "force-dynamic";

export default async function AdminExcluidosPage() {
  await requireAdmin();

  const rows = await prisma.job.findMany({
    where: { status: "excluido" },
    orderBy: { excluidoEm: "desc" },
    take: 200,
    select: {
      id: true,
      produto: true,
      tipo: true,
      formato: true,
      duracao: true,
      midias: true,
      saidas: true,
      criadoEm: true,
      excluidoEm: true,
      excluidoPor: true,
      user: { select: { nome: true, email: true } },
    },
  });

  // créditos gastos em cada um (pra saber o que foi pago)
  const ids = rows.map((r) => r.id);
  const txs = ids.length
    ? await prisma.creditoTransacao.groupBy({
        by: ["jobId"],
        where: { jobId: { in: ids }, tipo: { in: ["debito_geracao", "debito_processamento"] } },
        _sum: { valor: true },
      })
    : [];
  const gastoPor = new Map(txs.map((t) => [t.jobId, Math.abs(t._sum.valor ?? 0)]));

  const itens: ExcluidoDTO[] = rows.map((r) => {
    let videoUrl: string | undefined;
    let thumb: string | undefined;
    try {
      const m = r.midias ? (JSON.parse(r.midias) as { arquivo?: string; thumb?: string }[]) : [];
      videoUrl = m[0]?.arquivo || undefined;
      thumb = m[0]?.thumb || undefined;
    } catch {
      /* json inválido */
    }
    if (!videoUrl) {
      try {
        const s = r.saidas ? (JSON.parse(r.saidas) as string[]) : [];
        videoUrl = s[0];
      } catch {
        /* json inválido */
      }
    }
    return {
      id: r.id,
      produto: r.produto,
      tipo: r.tipo,
      duracao: r.duracao ?? undefined,
      videoUrl,
      thumb,
      criadoEm: r.criadoEm.toISOString(),
      excluidoEm: r.excluidoEm ? r.excluidoEm.toISOString() : null,
      excluidoPor: r.excluidoPor ?? "-",
      dono: r.user.nome || r.user.email,
      email: r.user.email,
      creditos: gastoPor.get(r.id) ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Trash2 className="size-6 text-primary" />
          Vídeos excluídos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tudo que foi excluído ({itens.length}): qual vídeo, de quem era, quem excluiu e
          quando. Excluir não devolve créditos (reembolso só via reporte/estorno).
        </p>
      </div>

      <AdminExcluidos itens={itens} />
    </div>
  );
}
