import type { ReactNode } from "react";
import { PersonalizeBarra } from "@/components/app/personalize-barra";

/**
 * Casca das telas do "Personalize com IA" (criar influenciador, galeria de
 * avatares e meus cenários). Existe só pra barrinha flutuante aparecer nas três
 * sem cada página precisar lembrar de chamar, igual ao layout do Labs.
 *
 * A folga de rodapé vem de dentro da própria barrinha (ver barra-ferramentas.tsx),
 * porque é ela, sendo flutuante, que cria a necessidade do espaço.
 */
export default function PersonalizeLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PersonalizeBarra />
    </>
  );
}
