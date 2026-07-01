import type { Metadata } from "next";
import { Users, Film, Clock, CheckCircle2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { prisma } from "@/lib/prisma";
import type { VideoStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Admin · Visão geral" };
export const dynamic = "force-dynamic";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminPage() {
  const [totalUsuarios, totalVideos, emProducao, prontos, recentes] =
    await Promise.all([
      prisma.user.count(),
      prisma.job.count(),
      prisma.job.count({
        where: { status: { in: ["na_fila", "renderizando"] } },
      }),
      prisma.job.count({ where: { status: "pronto" } }),
      prisma.job.findMany({
        orderBy: { criadoEm: "desc" },
        take: 12,
        select: {
          id: true,
          produto: true,
          formato: true,
          status: true,
          criadoEm: true,
          user: { select: { nome: true } },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe usuários e a produção de vídeos da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Usuários" value={totalUsuarios} icon={Users} />
        <StatCard label="Vídeos gerados" value={totalVideos} icon={Film} />
        <StatCard label="Em produção" value={emProducao} icon={Clock} />
        <StatCard label="Prontos" value={prontos} icon={CheckCircle2} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Vídeos recentes</h2>
        {recentes.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
            <Film className="size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhum vídeo ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Os vídeos aparecem aqui assim que os usuários começarem a gerar.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="hidden sm:table-cell">Formato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.produto}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.user?.nome ?? "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {v.formato === "voz" ? "Voz narrada" : "Legenda"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={v.status as VideoStatus} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {fmtData.format(new Date(v.criadoEm))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
