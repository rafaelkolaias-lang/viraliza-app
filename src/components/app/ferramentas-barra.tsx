"use client";

import { Clapperboard, MapPin, Pickaxe, Sparkles, Stamp } from "lucide-react";
import { BarraFerramentas } from "@/components/app/barra-ferramentas";
import type { ItemDock } from "@/components/app/lab-dock";

/**
 * Barrinha flutuante do grupo "Ferramentas": as mesmas cinco telas do submenu da
 * barra lateral, também no rodapé. Mesma ideia da do Labs (ver lab-barra.tsx).
 *
 * Diferente dos outros dois grupos, estas cinco telas NÃO ficam debaixo de um
 * endereço comum (são `/painel/novo`, `/painel/lote` e por aí vai). O que junta
 * elas é a pasta `(ferramentas)`, que existe só pra isso: com parênteses no
 * nome, o Next não põe ela no endereço. Ferramenta nova criada lá dentro já
 * nasce com a barrinha.
 *
 * A ordem é a do submenu, de propósito.
 */

const FERRAMENTAS: ItemDock[] = [
  {
    chave: "editor",
    href: "/painel/novo",
    label: "Editor automático",
    Icone: Sparkles,
    descricao: "Seu vídeo montado com voz, legenda e trilha",
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
  return <BarraFerramentas itens={FERRAMENTAS} />;
}
