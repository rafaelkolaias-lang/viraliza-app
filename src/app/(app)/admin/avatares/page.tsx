import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AdminAvatares, type AvatarAdminDTO } from "@/components/app/admin-avatares";

export const metadata: Metadata = { title: "Admin · Avatares" };
export const dynamic = "force-dynamic";

/** Lê a origem de dentro do JSON de escolhas (quiz/foto/produto/upload). */
function origemDe(escolhas: string | null): string {
  if (!escolhas) return "quiz";
  try {
    const o = JSON.parse(escolhas) as { origem?: string };
    return typeof o.origem === "string" ? o.origem : "quiz";
  } catch {
    return "quiz";
  }
}

export default async function AdminAvataresPage() {
  await requireAdmin();

  const rows = await prisma.avatar.findMany({
    orderBy: { criadoEm: "desc" },
    take: 300,
    include: { user: { select: { nome: true, email: true } } },
  });
  const avatares: AvatarAdminDTO[] = rows.map((a) => ({
    id: a.id,
    nome: a.nome,
    genero: a.genero,
    imagemUrl: a.imagemUrl,
    origem: origemDe(a.escolhas),
    criadoEm: a.criadoEm.toISOString(),
    usuario: a.user.nome || a.user.email,
    email: a.user.email,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <UserRound className="size-6 text-primary" />
          Avatares dos usuários
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos os avatares criados ou enviados na plataforma ({avatares.length}), do mais
          recente pro mais antigo, com quem fez cada um.
        </p>
      </div>

      <AdminAvatares avatares={avatares} />
    </div>
  );
}
