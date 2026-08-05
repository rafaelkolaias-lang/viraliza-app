import type { Metadata } from "next";
import { PenLine } from "lucide-react";
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import { GeradorPrompt } from "@/components/app/gerador-prompt";

export const metadata: Metadata = { title: "Gerador de prompt" };
export const dynamic = "force-dynamic";

/**
 * "Gerador de prompt": a pessoa sobe as fotos e a IA escreve o prompt. Era uma
 * aba do dock do Labs e agora tem rota própria. O botão "Usar no Vídeo livre"
 * leva o prompt pronto pra outra rota (ver lab-handoff.ts).
 */
export default function LabPromptPage() {
  return (
    <div>
      <LabCabecalho
        Icone={PenLine}
        chamada="A IA escreve o prompt perfeito pra você"
        titulo="Gerador de prompt"
        descricao="Suba suas fotos e a IA escreve o prompt perfeito pra você, com a técnica dos profissionais."
      />
      <div className="mt-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
        <GeradorPrompt />
      </div>
    </div>
  );
}
