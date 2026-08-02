import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AdminImagens, type ImagemAdmin } from "@/components/app/admin-imagens";

export const metadata: Metadata = { title: "Admin · Imagens geradas" };
export const dynamic = "force-dynamic";

/**
 * Todas as imagens geradas na plataforma (Lab, Personalize com IA e Viral
 * Boost), das mais novas pras mais antigas. É a tela pra acompanhar a qualidade
 * do que o motor está entregando sem depender de alguém reclamar.
 */
export default async function AdminImagensPage() {
  await requireAdmin();

  const linhas = await prisma.imagemGerada.findMany({
    orderBy: { criadoEm: "desc" },
    take: 200,
    select: {
      id: true,
      origem: true,
      titulo: true,
      imagemUrl: true,
      videos: true,
      criadoEm: true,
      user: { select: { nome: true, email: true } },
    },
  });

  const imagens: ImagemAdmin[] = linhas.map((l) => ({
    id: l.id,
    origem: l.origem,
    titulo: l.titulo,
    imagemUrl: l.imagemUrl,
    videos: l.videos,
    quando: l.criadoEm.toISOString(),
    usuarioNome: l.user?.nome ?? "",
    usuarioEmail: l.user?.email ?? "",
  }));

  const hoje = imagens.filter(
    (i) => new Date(i.quando).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Imagens geradas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          As últimas 200 imagens criadas na plataforma, de todos os usuários. Clique pra abrir o
          arquivo original.
          {hoje > 0 ? ` ${hoje} geradas hoje.` : ""}
        </p>
      </div>

      <AdminImagens imagens={imagens} />
    </div>
  );
}
