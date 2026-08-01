import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { listarAvatares } from "@/lib/avatares";
import { ViralizaLab } from "@/components/app/viraliza-lab";

export const metadata: Metadata = { title: "Viraliza Labs" };
export const dynamic = "force-dynamic";

export default async function LabPage() {
  const user = await requireUser();
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
