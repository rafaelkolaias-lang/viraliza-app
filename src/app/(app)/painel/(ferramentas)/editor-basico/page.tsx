import type { Metadata } from "next";
import { EditorBasico } from "@/components/app/editor-basico";
import { getCurrentUser } from "@/lib/dal";
import { getConfigReuso } from "@/lib/jobs";

/**
 * EDITOR AUTOMÁTICO BASIC (/painel/editor-basico).
 *
 * A versão de tela única do editor, ao lado do PRO (`/painel/novo`, funil de 5
 * etapas). Mesma casca, mesmos parâmetros de URL e o MESMO backend (`/api/jobs`):
 * a diferença mora só no componente. Ver o cabeçalho do `editor-basico.tsx`.
 *
 * Está dentro do route group `(ferramentas)` (parêntese = pasta que não entra
 * no endereço), então ela já nasce com a barrinha do rodapé do grupo.
 */
export const metadata: Metadata = {
  title: "Editor automático BASIC",
};

export default async function EditorBasicoPage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string; nome?: string; reutilizar?: string }>;
}) {
  const user = await getCurrentUser();
  const bloqueado = user?.role === "demo";

  const sp = await searchParams;
  // O Basic não tem o fluxo de produto pré-selecionado da Shopee (`shopee=1`):
  // ali a tela já mostra o "É um produto?" ligado ou desligado de cara.
  const videoInicial = sp.video ? { url: sp.video, nome: sp.nome ?? "" } : undefined;

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
              : "Editor automático BASIC"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {videoInicial
            ? "Ajuste cortes e textos como quiser. Ao gerar, sai uma cópia nova - o vídeo original continua intacto."
            : reusando
              ? "Os mesmos ajustes do vídeo anterior já vêm preenchidos. Adicione as mídias e gere de novo (ou mude o que quiser)."
              : "A versão simples: tudo numa tela só, sem passo a passo. Suba as mídias, ajuste do lado e gere."}
        </p>
      </div>
      <EditorBasico
        bloqueado={bloqueado}
        videoInicial={videoInicial}
        configInicial={configInicial}
      />
    </div>
  );
}
