import type { Metadata } from "next";
import { ImageIcon } from "lucide-react";
import { MeusCenarios } from "@/components/app/meus-cenarios";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "Meus cenários" };
export const dynamic = "force-dynamic";

export default async function MeusCenariosPage() {
  await requireUser();
  return (
    <div className="w-full space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary shadow-[0_0_24px_-6px_var(--color-primary)]">
          <ImageIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">Meus cenários</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Guarde seus próprios fundos (a sua loja, a sua cozinha) pra usar nos vídeos
          </p>
        </div>
      </div>
      <MeusCenarios />
    </div>
  );
}
