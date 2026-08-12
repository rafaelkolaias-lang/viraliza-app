import type { Metadata } from "next";
import { GeradorPrompt } from "@/components/app/gerador-prompt";

export const metadata: Metadata = { title: "Gerador de prompt" };
export const dynamic = "force-dynamic";

/**
 * "Gerador de prompt": a pessoa sobe as fotos e a IA escreve o prompt. Era uma
 * aba do dock do Labs e agora tem rota própria. O botão "Usar no Vídeo livre"
 * leva o prompt pronto pra outra rota (ver lab-handoff.ts).
 *
 * O `LabCabecalho` é montado DENTRO do componente (e não aqui, como nas outras
 * telas do Labs) porque a tela virou um funil de 5 etapas e a trilha delas fica
 * logo abaixo do título, igual no "Criar criativo". Trilha precisa de estado,
 * então precisa ser do lado do cliente.
 */
export default function LabPromptPage() {
  return <GeradorPrompt />;
}
