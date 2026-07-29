import type { Metadata } from "next";
import Link from "next/link";
import {
  Users,
  Film,
  Clock,
  CheckCircle2,
  Wifi,
  XCircle,
  Coins,
  Flag,
  MessageSquarePlus,
  Camera,
  ChevronRight,
} from "lucide-react";
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

const PENDENCIAS = [
  {
    chave: "reportes" as const,
    label: "Reportes de vídeo",
    desc: "problemas aguardando decisão",
    href: "/admin/reportes",
    Icon: Flag,
  },
  {
    chave: "sugestoes" as const,
    label: "Sugestões novas",
    desc: "enviadas pelos usuários",
    href: "/painel/sugestoes",
    Icon: MessageSquarePlus,
  },
  {
    chave: "bonus" as const,
    label: "Bônus IG pendentes",
    desc: "pedidos de +300 créditos",
    href: "/admin/bonus",
    Icon: Camera,
  },
];

export default async function AdminPage() {
  const { stats, pendencias, grafico, usuarios, recentes } = await getPainelAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe usuários, presença e a produção de vídeos da plataforma.
        </p>
      </div>

      {/* Pendências: o que precisa da sua ação agora */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PENDENCIAS.map(({ chave, label, desc, href, Icon }) => {
          const n = pendencias[chave];
          return (
            <Link
              key={chave}
              href={href}
              className={
                n > 0
                  ? "group flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 transition-colors hover:border-amber-500/70"
                  : "group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              }
            >
              <span
                className={
                  n > 0
                    ? "grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-500"
                    : "grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"
                }
              >
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-semibold">
                  {label}
                  <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
              <span
                className={
                  n > 0
                    ? "rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-black text-black"
                    : "rounded-full bg-muted px-2.5 py-0.5 text-sm font-bold text-muted-foreground"
                }
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Usuários" value={stats.usuarios} icon={Users} />
        <StatCard label="Online agora" value={stats.online} icon={Wifi} />
        <StatCard label="Vídeos gerados" value={stats.videos} icon={Film} />
        <StatCard label="Em produção" value={stats.emProducao} icon={Clock} />
        <StatCard label="Prontos" value={stats.prontos} icon={CheckCircle2} />
        <StatCard label="Erros" value={stats.erros} icon={XCircle} />
        <StatCard
          label="Créditos gastos"
          value={stats.creditosGastos.toLocaleString("pt-BR")}
          icon={Coins}
        />
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
          Gerenciar pra adicionar/remover crédito. 1 crédito = R$ 0,01.
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
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
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
                      {v.tipo === "avatar" ? (
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          Vídeo com avatar
                        </span>
                      ) : v.tipo === "cortes" ? (
                        "Cortes"
                      ) : v.formato === "voz" ? (
                        "Voz narrada"
                      ) : (
                        "Legenda"
                      )}
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
