import { Clapperboard, Compass, Images, PenLine } from "lucide-react";

import {
  GradeFerramentas,
  type CartaoFerramenta,
} from "@/components/app/grade-ferramentas";

/**
 * Os 4 cartões da tela de apresentação do Viraliza Labs (`/painel/lab/inicio`).
 *
 * Aqui mora só a LISTA. O desenho do cartão (vídeo, ícone, texto, botão) e o
 * porquê de cada decisão estão em `grade-ferramentas.tsx`, que é o mesmo
 * componente usado pelas telas de apresentação do "Personalize com IA" e do
 * "Ferramentas". Antes o JSX vivia aqui dentro; com três telas iguais, copiar
 * era garantir que um dia elas ficariam diferentes.
 *
 * Estes quatro são os ÚNICOS que já têm vídeo (campo `chave`). Os das outras
 * duas telas ainda caem no ícone grande, esperando o dono mandar os arquivos.
 */

const FERRAMENTAS: CartaoFerramenta[] = [
  {
    href: "/painel/lab",
    titulo: "Criar criativo",
    Icone: Compass,
    descricao:
      "O caminho guiado, do produto até o vídeo pronto. Ele pergunta uma coisa de cada vez e monta tudo pra você. É por aqui que quase todo mundo começa.",
    chave: "criar-criativo",
  },
  {
    href: "/painel/lab/livre",
    titulo: "Vídeo livre",
    Icone: Clapperboard,
    descricao:
      "Sem passo a passo: você escreve com as suas palavras o vídeo que quer, anexa as imagens de referência e a IA grava aquilo.",
    chave: "video-livre",
  },
  {
    href: "/painel/lab/imagens",
    titulo: "Minhas imagens",
    Icone: Images,
    descricao:
      "Tudo que você já gerou fica guardado aqui. Dá pra baixar, favoritar e gerar um vídeo novo de uma imagem sem pagar ela outra vez.",
    chave: "minhas-imagens",
  },
  {
    href: "/painel/lab/prompt",
    titulo: "Gerador de prompt",
    Icone: PenLine,
    descricao:
      "Suba suas fotos e a IA escreve a descrição técnica do vídeo, do jeito que os profissionais escrevem. Depois é só levar pro Vídeo livre.",
    chave: "gerador-prompt",
  },
];

export function LabInicio() {
  return <GradeFerramentas itens={FERRAMENTAS} />;
}
