"use client";

import { usePathname } from "next/navigation";
import {
  Clapperboard,
  MapPin,
  Pickaxe,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Stamp,
} from "lucide-react";
import { BarraFerramentas } from "@/components/app/barra-ferramentas";
import type { ItemDock } from "@/components/app/lab-dock";

/**
 * Barrinha flutuante do grupo "Ferramentas": as mesmas sete telas do submenu da
 * barra lateral, também no rodapé. Mesma ideia da do Labs (ver lab-barra.tsx).
 *
 * Diferente dos outros dois grupos, estas seis telas NÃO ficam debaixo de um
 * endereço comum (são `/painel/novo`, `/painel/lote` e por aí vai). O que junta
 * elas é a pasta `(ferramentas)`, que existe só pra isso: com parênteses no
 * nome, o Next não põe ela no endereço. Ferramenta nova criada lá dentro já
 * nasce com a barrinha.
 *
 * A ordem é a do submenu, de propósito.
 */

/** tela de apresentação do grupo (a porta de entrada, que explica as 7). */
export const FERRAMENTAS_INICIO = "/painel/ferramentas";

const FERRAMENTAS: ItemDock[] = [
  {
    chave: "editor-basico",
    href: "/painel/editor-basico",
    label: "Editor automático BASIC",
    Icone: SlidersHorizontal,
    descricao: "O mesmo editor, numa tela só e sem passo a passo",
  },
  {
    chave: "editor",
    href: "/painel/novo",
    label: "Editor automático PRO",
    Icone: Sparkles,
    descricao: "Seu vídeo montado com voz, legenda e trilha, passo a passo",
  },
  {
    chave: "criar-corte",
    href: "/painel/criar-corte",
    label: "Criar um Corte",
    Icone: Scissors,
    descricao: "Corta o silêncio e os pedaços ruins do seu vídeo",
  },
  {
    chave: "lote",
    href: "/painel/lote",
    label: "Aplicar marca em lote",
    Icone: Stamp,
    descricao: "Carimba a sua logo em vários vídeos de uma vez",
  },
  {
    chave: "leads",
    href: "/painel/leads",
    label: "MapsLeads",
    Icone: MapPin,
    descricao: "Lista de empresas com telefone, por ramo e cidade",
  },
  {
    chave: "cortes",
    href: "/painel/cortes",
    label: "Cortes de qualquer vídeo",
    Icone: Clapperboard,
    descricao: "Manda o link e ele corta o vídeo em partes",
  },
  {
    chave: "minerador",
    href: "/painel/minerador",
    label: "Minerador",
    Icone: Pickaxe,
    descricao: "Garimpa os vídeos que mais vendem no seu nicho",
  },
];

export function FerramentasBarra() {
  const pathname = usePathname();

  // Na tela de apresentação do grupo a barrinha some: aquela tela JÁ é esta
  // lista, só que grande e com a explicação de cada uma. Ter as duas na mesma
  // página seria o mesmo menu duas vezes (mesma regra da do Labs).
  if (pathname === FERRAMENTAS_INICIO) return null;

  return <BarraFerramentas itens={FERRAMENTAS} />;
}
