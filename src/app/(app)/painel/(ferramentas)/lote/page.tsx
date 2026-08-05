import type { Metadata } from "next";
import { LoteEmMassa } from "@/components/app/lote-em-massa";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Em lote",
};

export default async function LotePage() {
  const user = await getCurrentUser();
  const demo = user?.role === "demo";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Aplicar marca em lote
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {demo
            ? "Veja como funciona: já deixamos a moldura e um vídeo de exemplo prontos - é só gerar."
            : "Suba vários vídeos e um template (sua logo/@) - a gente gera um vídeo com a marca pra cada um, de uma vez só."}
        </p>
      </div>
      <LoteEmMassa demo={demo} />
    </div>
  );
}
