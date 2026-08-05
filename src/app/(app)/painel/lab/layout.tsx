import type { ReactNode } from "react";
import { LabBarra } from "@/components/app/lab-barra";

/**
 * Casca das telas do Viraliza Labs (apresentação, criar criativo, vídeo livre,
 * minhas imagens e gerador de prompt). Ela existe só pra barrinha flutuante
 * aparecer sem cada página precisar lembrar de chamar.
 *
 * A folga de rodapé vem de dentro da própria barrinha, não daqui: na tela de
 * apresentação ela não aparece, e lá também não deve sobrar buraco no fim.
 */
export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LabBarra />
    </>
  );
}
