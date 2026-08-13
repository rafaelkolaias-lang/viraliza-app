import type { ReactNode } from "react";
import { FerramentasBarra } from "@/components/app/ferramentas-barra";

/**
 * Casca das telas do grupo "Ferramentas" (os dois editores automáticos, PRO e
 * Basic, o Criar um Corte, a marca em lote, o MapsLeads, os cortes e o minerador).
 *
 * O parêntese no nome da pasta é o que faz ela sumir do endereço: as telas aqui
 * dentro continuam em `/painel/novo`, `/painel/lote` e assim por diante, sem o
 * "(ferramentas)" no meio. A pasta existe só pra todas elas terem uma casca em
 * comum, que é onde a barrinha flutuante do rodapé mora. Ferramenta nova criada
 * aqui dentro já nasce com a barrinha, sem ninguém precisar lembrar.
 *
 * A folga de rodapé vem de dentro da própria barrinha (ver barra-ferramentas.tsx),
 * porque é ela, sendo flutuante, que cria a necessidade do espaço.
 */
export default function FerramentasLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FerramentasBarra />
    </>
  );
}
