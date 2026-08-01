import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { listarAvatares } from "@/lib/avatares";
import { ViralizaLab } from "@/components/app/viraliza-lab";

export const metadata: Metadata = { title: "Viraliza Lab" };
export const dynamic = "force-dynamic";

export default async function LabPage() {
  const user = await requireUser();
  // Em construção: por enquanto só o admin enxerga (o resto do app segue igual).
  if (user.role !== "admin") notFound();

  const meus = await listarAvatares(user.id);
  return (
    <ViralizaLab
      meusAvatares={meus.map((a) => ({
        id: a.id,
        nome: a.nome,
        imagemUrl: a.imagemUrl,
      }))}
    />
  );
}
