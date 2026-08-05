"use client";

import { Image as ImageIcon, Sparkles, UserRound } from "lucide-react";
import { BarraFerramentas } from "@/components/app/barra-ferramentas";
import type { ItemDock } from "@/components/app/lab-dock";

/**
 * Barrinha flutuante do "Personalize com IA": as mesmas três telas do submenu da
 * barra lateral (criar influenciador, galeria de avatares e meus cenários),
 * também no rodapé. Mesma ideia da do Labs (ver lab-barra.tsx): no celular ela
 * troca de tela com um toque sem abrir o menu, e no computador é um caminho a
 * mais pro mesmo lugar. A ordem é a do submenu, de propósito.
 */

const FERRAMENTAS: ItemDock[] = [
  {
    chave: "criar",
    href: "/painel/meus-avatares/criar",
    label: "Novo influenciador",
    Icone: Sparkles,
    descricao: "Crie seu influenciador com inteligência artificial",
  },
  {
    chave: "galeria",
    href: "/painel/meus-avatares",
    label: "Galeria de avatares",
    Icone: UserRound,
    descricao: "Seus influenciadores salvos, prontos pra usar",
  },
  {
    chave: "cenarios",
    href: "/painel/meus-avatares/cenarios",
    label: "Meus cenários",
    Icone: ImageIcon,
    descricao: "Seus fundos guardados pra usar nos vídeos",
  },
];

export function PersonalizeBarra() {
  return <BarraFerramentas itens={FERRAMENTAS} />;
}
