"use client";

import { usePathname } from "next/navigation";
import { Clapperboard, Compass, Images, PenLine } from "lucide-react";
import { BarraFerramentas } from "@/components/app/barra-ferramentas";
import type { ItemDock } from "@/components/app/lab-dock";

/**
 * Barrinha flutuante do Viraliza Labs: o mesmo atalho das quatro ferramentas que
 * já existe no submenu da barra lateral, agora também no rodapé da tela.
 *
 * É de propósito que os dois existam: no celular a barra lateral fica escondida
 * atrás do botão de menu, e a barrinha resolve a troca de ferramenta com um
 * toque. No computador ela aparece do mesmo jeito, com o nome escrito ao lado do
 * ícone da ferramenta aberta.
 *
 * Cada item LEVA pra rota da ferramenta (nada de aba interna): assim a tela é a
 * mesma que o menu lateral abre, e cada ferramenta continua morando num lugar só.
 *
 * A ordem aqui é igual à do submenu da barra lateral de propósito, senão os dois
 * caminhos pro mesmo lugar teriam listas em ordens diferentes.
 */

/** tela de apresentação do Labs (a porta de entrada, que explica as 4). */
export const LAB_INICIO = "/painel/lab/inicio";

const FERRAMENTAS: ItemDock[] = [
  {
    chave: "criar",
    href: "/painel/lab",
    // `exato` porque essa rota é o começo de todas as outras do Labs: sem ele,
    // a tela de apresentação (/painel/lab/inicio) acenderia este item.
    exato: true,
    label: "Criar criativo",
    Icone: Compass,
    descricao: "O caminho guiado, do produto ao vídeo",
  },
  {
    chave: "livre",
    href: "/painel/lab/livre",
    label: "Vídeo livre",
    Icone: Clapperboard,
    descricao: "Você escreve o que quer e a IA grava",
  },
  {
    chave: "imagens",
    href: "/painel/lab/imagens",
    label: "Minhas imagens",
    Icone: Images,
    descricao: "Tudo que você já gerou, salvo",
  },
  {
    chave: "prompt",
    href: "/painel/lab/prompt",
    label: "Gerador de prompt",
    Icone: PenLine,
    descricao: "A IA escreve o prompt perfeito pra você",
  },
];

export function LabBarra() {
  const pathname = usePathname();

  // Na tela de apresentação do Labs a barrinha some: aquela tela JÁ é esta lista,
  // só que grande e com a explicação de cada ferramenta. Ter as duas na mesma
  // página seria o mesmo menu duas vezes.
  if (pathname === LAB_INICIO) return null;

  return <BarraFerramentas itens={FERRAMENTAS} />;
}
