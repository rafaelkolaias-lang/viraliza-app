import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { ViralBoost } from "@/components/app/viral-boost";

export const metadata: Metadata = { title: "Viral Boost" };
export const dynamic = "force-dynamic";

export default async function ViralBoostPage() {
  await requireUser();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary sm:text-xs">
          <Flame className="size-3.5" />
          Historinhas de fruta, a trend do momento
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Viral <span className="text-primary">Boost</span>
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
          Escolha as frutas, o drama e o cenário. A gente monta a cena e entrega o vídeo pronto
          de 15 segundos, com fala em português.
        </p>
      </div>

      <ViralBoost />
    </div>
  );
}
