import type { Metadata } from "next";
import {
  Clapperboard,
  MapPin,
  Pickaxe,
  Scissors,
  Sparkles,
  Stamp,
  Wrench,
} from "lucide-react";
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import {
  GradeFerramentas,
  type CartaoFerramenta,
} from "@/components/app/grade-ferramentas";

export const metadata: Metadata = { title: "Ferramentas" };

/**
 * Porta de entrada do grupo "Ferramentas": apresenta as 6 e diz o que cada uma
 * faz. É pra onde o nome "Ferramentas" do menu leva.
 *
 * ATENÇÃO, LEIA ANTES DE MEXER: já existiu uma `/painel/ferramentas` e ela foi
 * APAGADA em 05/08/2026, justamente por ser uma grade de atalhos repetidos, um
 * clique a mais pros mesmos destinos. O que justifica a volta dela é a
 * EXPLICAÇÃO, não o atalho: os nomes daqui não se explicam sozinhos (ninguém
 * adivinha a diferença entre "Criar um Corte" e "Cortes de qualquer vídeo"), e a
 * frase que a barrinha do rodapé tem só aparece no balãozinho do mouse, que no
 * celular não existe. Se um dia alguém tirar as descrições e deixar só os
 * botões, esta tela vira aquilo de novo e merece ser apagada de novo.
 *
 * Quem já sabe o caminho não passa por aqui: continua clicando direto no submenu
 * da barra lateral ou na barrinha do rodapé.
 *
 * Ela mora DENTRO do route group `(ferramentas)` pra herdar a casca do grupo; o
 * parêntese não entra no endereço, então o caminho é `/painel/ferramentas`.
 * Não tem nada de servidor pra fazer (é texto e link) e o login já é exigido
 * pelo layout do painel.
 */

// O endereço desta tela mora em `ferramentas-barra.tsx` (`FERRAMENTAS_INICIO`),
// que é quem precisa dele pra sumir aqui. Página do App Router só aceita os
// exports que o Next conhece (default, metadata e afins): exportar a constante
// daqui quebra a validação de tipos do build.

const FERRAMENTAS: CartaoFerramenta[] = [
  {
    href: "/painel/novo",
    titulo: "Editor automático",
    chave: "editor-automatico",
    foto: true,
    Icone: Sparkles,
    descricao:
      "Você já gravou o vídeo e ele monta o resto: corta, escreve a copy, põe legenda ou narração e encaixa as fotos do produto no meio da sua fala.",
  },
  {
    href: "/painel/criar-corte",
    titulo: "Criar um Corte",
    chave: "criar-corte",
    foto: true,
    Icone: Scissors,
    descricao:
      "Pra limpar uma gravação sua: você tira os pedaços que não presta e o silêncio entre as falas. Não entra IA nenhuma, é só o seu vídeo mais enxuto.",
  },
  {
    href: "/painel/lote",
    titulo: "Aplicar marca em lote",
    chave: "marca-lote",
    foto: true,
    Icone: Stamp,
    descricao:
      "Carimba a sua logo ou o seu @ em vários vídeos de uma vez, na posição que você arrastar. Serve pra assinar tudo que você posta.",
  },
  {
    href: "/painel/leads",
    titulo: "MapsLeads",
    chave: "mapsleads",
    foto: true,
    Icone: MapPin,
    descricao:
      "Diga o ramo e a cidade e ele devolve a lista de empresas com telefone e endereço, pronta pra baixar e prospectar.",
  },
  {
    href: "/painel/cortes",
    titulo: "Cortes de qualquer vídeo",
    chave: "cortes-video",
    foto: true,
    Icone: Clapperboard,
    descricao:
      "Cole o link de um vídeo do YouTube e a IA escolhe os melhores momentos, corta no formato de celular e legenda cada um.",
  },
  {
    href: "/painel/minerador",
    titulo: "Minerador",
    chave: "minerador",
    foto: true,
    Icone: Pickaxe,
    descricao:
      "Garimpa no acervo os vídeos que mais vendem no seu nicho, pra você ver o que está funcionando antes de gravar o seu.",
  },
];

export default function FerramentasInicioPage() {
  return (
    <div>
      <LabCabecalho
        Icone={Wrench}
        chamada="As ferramentas que trabalham em cima do que você já tem"
        titulo={
          <>
            <span className="text-primary">Ferramentas</span>
          </>
        }
        descricao="São seis aqui dentro, e elas não competem entre si: cada uma resolve um pedaço diferente. Veja o que cada uma faz e escolha por onde começar."
      />
      <div className="mt-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
        {/* 3 colunas: são 6 cartões, e em 4 colunas sobrava uma linha de 2 */}
        <GradeFerramentas itens={FERRAMENTAS} colunas={3} />
      </div>
    </div>
  );
}
