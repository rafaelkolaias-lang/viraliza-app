import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AdminReportes, type ReporteDTO } from "@/components/app/admin-reportes";

export const metadata: Metadata = { title: "Admin · Reportes de vídeo" };
export const dynamic = "force-dynamic";

export default async function AdminReportesPage() {
  await requireAdmin();

  const rows = await prisma.reporteVideo.findMany({
    orderBy: { criadoEm: "desc" },
    take: 200,
    include: { user: { select: { nome: true, email: true } } },
  });
  const reportes: ReporteDTO[] = rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    produto: r.produto,
    motivo: r.motivo,
    creditos: r.creditos,
    status: r.status,
    criadoEm: r.criadoEm.toISOString(),
    usuario: r.user.nome || r.user.email,
    email: r.user.email,
  }));
  const novos = reportes.filter((r) => r.status === "novo").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes de vídeo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vídeos que os usuários reportaram como problema. Reembolsar devolve os
          créditos gastos; recusar só encerra. O usuário é avisado no sininho.
          {novos > 0 ? ` ${novos} aguardando.` : ""}
        </p>
      </div>

      <AdminReportes reportes={reportes} />
    </div>
  );
}
