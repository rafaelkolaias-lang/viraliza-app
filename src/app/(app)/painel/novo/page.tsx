import type { Metadata } from "next";
import { EditorEstudio } from "@/components/app/editor-estudio";
import { getCurrentUser } from "@/lib/dal";
import { getConfigReuso } from "@/lib/jobs";

export const metadata: Metadata = {
  title: "Editor",
};

export default async function NovoVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string; nome?: string; reutilizar?: string }>;
}) {
  const user = await getCurrentUser();
  const bloqueado = user?.role === "demo";

  const sp = await searchParams;
  const videoInicial = sp.video
    ? { url: sp.video, nome: sp.nome ?? "" }
    : undefined;

  // "Reutilizar": reabre o editor com os mesmos ajustes de um vídeo já feito.
  const configInicial =
    sp.reutilizar && user
      ? (await getConfigReuso(user.id, sp.reutilizar)) ?? undefined
      : undefined;

  const reusando = !!configInicial;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {videoInicial
            ? "Editar vídeo"
            : reusando
              ? "Reutilizar vídeo"
              : "Editor de vídeo"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {videoInicial
            ? "Ajuste cortes e textos como quiser. Ao gerar, sai uma cópia nova - o vídeo original continua intacto."
            : reusando
              ? "Os mesmos ajustes do vídeo anterior já vêm preenchidos. Adicione as mídias e gere de novo (ou mude o que quiser)."
              : "Monte, corte, escreva textos onde quiser e pré-visualize. Pra produto, ative “É um produto?” e a IA escreve a copy."}
        </p>
      </div>
      <EditorEstudio
        bloqueado={bloqueado}
        videoInicial={videoInicial}
        configInicial={configInicial}
      />
    </div>
  );
}
