import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  UsuariosAdmin,
  type AdminUsuario,
  type Papel,
} from "@/components/app/usuarios-admin";

export const metadata: Metadata = { title: "Admin · Usuários" };
export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const eu = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { criadoEm: "asc" },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      bloqueado: true,
      criadoEm: true,
      _count: { select: { jobs: true } },
    },
  });

  const papel = (r: string): Papel =>
    r === "admin" ? "admin" : r === "demo" ? "demo" : "user";

  const usuarios: AdminUsuario[] = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: papel(u.role),
    bloqueado: u.bloqueado,
    videos: u._count.jobs,
    criadoEm: u.criadoEm.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {usuarios.length}{" "}
          {usuarios.length === 1 ? "usuário cadastrado" : "usuários cadastrados"} na
          plataforma.
        </p>
      </div>

      <UsuariosAdmin usuarios={usuarios} currentUserId={eu.id} />
    </div>
  );
}
