import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AdminReportes, type ReporteDTO } from "@/components/app/admin-reportes";

export const metadata: Metadata = { title: "Admin · Reportes de vídeo" };
export const dynamic = "force-dynamic";

/** Puxa do Job reportado: a URL do vídeo/thumb e as mídias de ENTRADA (opcoes). */
function midiaDoJob(job?: { midias: string | null; saidas: string | null; opcoes: string | null }) {
  if (!job) return {};
  let videoUrl: string | undefined;
  let thumb: string | undefined;
  try {
    const m = job.midias ? (JSON.parse(job.midias) as { arquivo?: string; thumb?: string }[]) : [];
    videoUrl = m[0]?.arquivo || undefined;
    thumb = m[0]?.thumb || undefined;
  } catch {
    /* json inválido */
  }
  if (!videoUrl) {
    try {
      const s = job.saidas ? (JSON.parse(job.saidas) as string[]) : [];
      videoUrl = s[0];
    } catch {
      /* json inválido */
    }
  }
  let entrada;
  try {
    const o = job.opcoes ? (JSON.parse(job.opcoes) as { entrada?: unknown }) : {};
    entrada = o.entrada as
      | { avatarUrl?: string; produtoFotos?: string[]; cenario?: string | null }
      | undefined;
  } catch {
    /* json inválido */
  }
  return { videoUrl, thumb, entrada };
}

export default async function AdminReportesPage() {
  await requireAdmin();

  const rows = await prisma.reporteVideo.findMany({
    orderBy: { criadoEm: "desc" },
    take: 200,
    include: { user: { select: { nome: true, email: true } } },
  });

  // jobs reportados (podem já ter sido excluídos): traz vídeo + entradas
  const jobIds = [...new Set(rows.map((r) => r.jobId))];
  const jobs = jobIds.length
    ? await prisma.job.findMany({
        where: { id: { in: jobIds } },
        select: { id: true, midias: true, saidas: true, opcoes: true },
      })
    : [];
  const jobPor = new Map(jobs.map((j) => [j.id, j]));

  const reportes: ReporteDTO[] = rows.map((r) => {
    const { videoUrl, thumb, entrada } = midiaDoJob(jobPor.get(r.jobId));
    return {
      id: r.id,
      jobId: r.jobId,
      produto: r.produto,
      motivo: r.motivo,
      creditos: r.creditos,
      status: r.status,
      criadoEm: r.criadoEm.toISOString(),
      usuario: r.user.nome || r.user.email,
      email: r.user.email,
      videoUrl,
      thumb,
      avatarUrl: entrada?.avatarUrl,
      produtoFotos: entrada?.produtoFotos ?? [],
      cenario: entrada?.cenario ?? undefined,
    };
  });
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
