import type { Metadata } from "next";
import { Scissors } from "lucide-react";
import { CortesForm } from "@/components/app/cortes-form";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Cortes de qualquer vídeo",
};

export default async function CortesPage() {
  const user = await getCurrentUser();
  const demo = user?.role === "demo";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Scissors className="size-6 text-primary" />
          Cortes de qualquer vídeo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole o link de um vídeo e a IA devolve os melhores cortes 9:16, prontos
          pro TikTok - com legenda se você quiser.
        </p>
      </div>
      <CortesForm demo={demo} />
    </div>
  );
}
