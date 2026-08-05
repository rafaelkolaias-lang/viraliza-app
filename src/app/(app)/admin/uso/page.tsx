import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { contarUsoPorUsuario } from "@/lib/admin";
import { AdminUso, type LinhaUso } from "@/components/app/admin-uso";
import {
  DIAS_USO_PADRAO,
  FERRAMENTAS,
  PERIODOS_USO,
  usoVazio,
} from "@/lib/uso-ferramentas";

export const metadata: Metadata = { title: "Admin · Uso das ferramentas" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminUsoPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const pedido = Number(sp?.dias);
  const dias = PERIODOS_USO.some((p) => p.v === pedido) ? pedido : DIAS_USO_PADRAO;
  const desde = dias > 0 ? new Date(Date.now() - dias * 86_400_000) : null;

  const [users, usoPor] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, nome: true, email: true, role: true },
      orderBy: { criadoEm: "asc" },
    }),
    contarUsoPorUsuario(desde),
  ]);

  const linhas: LinhaUso[] = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    uso: usoPor.get(u.id) ?? usoVazio(),
  }));

  const label = PERIODOS_USO.find((p) => p.v === dias)?.label ?? `${dias} dias`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Uso das ferramentas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quantas vezes cada pessoa usou cada uma das {FERRAMENTAS.length} ferramentas.
          Serve pra ver o que a galera mais gosta e onde vale focar. Período:{" "}
          <b className="text-foreground">{label === "Tudo" ? "desde o começo" : label}</b>.
        </p>
      </div>

      <AdminUso linhas={linhas} dias={dias} />
    </div>
  );
}
