"use client";

import { usePathname } from "next/navigation";
import { LabDock, type ItemDock } from "@/components/app/lab-dock";

/**
 * Barrinha flutuante de rodapé que NAVEGA entre rotas irmãs (a cara é a do
 * LabDock). Cada grupo de telas que quer uma dessas só define a lista de
 * ferramentas (ver lab-barra.tsx, personalize-barra.tsx e ferramentas-barra.tsx)
 * e este componente cuida do resto: descobrir qual item acender pela rota atual.
 *
 * A lista precisa morar num arquivo client como esses porque os ícones são
 * componentes, e componente não atravessa a fronteira servidor -> cliente
 * como prop.
 *
 * A FOLGA do rodapé sai daqui, e não do layout de cada grupo, porque é esta
 * barrinha que cria a necessidade dela: sendo flutuante, sem a folga ela taparia
 * o último botão da tela. Quem não mostra a barrinha (o Labs esconde ela na tela
 * de apresentação) também não ganha o buraco no fim da página.
 */
export function BarraFerramentas({ itens }: { itens: ItemDock[] }) {
  const pathname = usePathname();

  /**
   * Acende o item cuja rota casa com a atual, e na dúvida a MAIS COMPRIDA: a raiz
   * do grupo é começo das outras, então sem isso ela ganharia sempre.
   *
   * `exato` é pra raiz que também é ferramenta (o "Criar criativo" mora na raiz
   * `/painel/lab`): sem ele, uma tela do grupo que não é ferramenta nenhuma
   * acenderia ela pelo começo do endereço.
   */
  const atual = itens
    .filter((i) => {
      if (!i.href) return false;
      if (i.exato) return pathname === i.href;
      return pathname === i.href || pathname.startsWith(`${i.href}/`);
    })
    .sort((a, b) => b.href!.length - a.href!.length)[0]?.chave;

  return (
    <>
      {/* espaço pra barrinha flutuante não tapar o fim da tela. No celular ela
          sobe pra não encostar na boia do suporte, então lá o vão é maior. */}
      <div aria-hidden className="h-40 sm:h-24" />
      <LabDock itens={itens} atual={atual} />
    </>
  );
}
