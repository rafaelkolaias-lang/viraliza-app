import type { Metadata } from "next";
import { Users, Film, Clock, CheckCircle2, Wifi, XCircle } from "lucide-react";
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
import { GraficoProducao } from "@/components/app/grafico-producao";
import { AdminUsuarios } from "@/components/app/admin-usuarios";
import { getPainelAdmin } from "@/lib/admin";
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
  const { stats, grafico, usuarios, recentes } = await getPainelAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe usuários, presença e a produção de vídeos da plataforma.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Usuários" value={stats.usuarios} icon={Users} />
        <StatCard label="Online agora" value={stats.online} icon={Wifi} />
        <StatCard label="Vídeos gerados" value={stats.videos} icon={Film} />
        <StatCard label="Em produção" value={stats.emProducao} icon={Clock} />
        <StatCard label="Prontos" value={stats.prontos} icon={CheckCircle2} />
        <StatCard label="Erros" value={stats.erros} icon={XCircle} />
      </div>

      {/* Gráfico por dia */}
      <GraficoProducao dias={grafico} />

      {/* Usuários: presença + gasto + gerenciar crédito */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          Usuários ({usuarios.length}) · presença, consumo e crédito
        </h2>
        <AdminUsuarios usuarios={usuarios} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Gasto = créditos consumidos em produção (geração + processamento). Clique em
          "Gerenciar" pra adicionar/remover crédito. 1 crédito = R$ 0,01.
        </p>
      </div>

      {/* Vídeos recentes */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Vídeos recentes</h2>
        {recentes.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
            <Film className="size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhum vídeo ainda</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
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
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {v.produto}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{v.nome ?? "-"}</TableCell>
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
