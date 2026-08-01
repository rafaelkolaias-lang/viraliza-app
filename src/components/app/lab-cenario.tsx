"use client";

import {
  Home,
  Camera,
  Sun,
  Dumbbell,
  CookingPot,
  Briefcase,
  BedDouble,
  ShowerHead,
  Palmtree,
  Coffee,
  Store,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Passo "Cenário" do Viraliza Lab: onde a cena acontece. `motor` é a chave que o
 * gerador de imagem já entende (CENARIOS em avatar-modelo.ts); quando não existe
 * equivalente lá, mandamos a descrição em `texto` (o motor aceita cenário livre).
 */

export type CenarioLab = {
  chave: string;
  label: string;
  Icone: typeof Home;
  motor?: string; // chave de CENARIOS
  texto?: string; // descrição livre quando não tem equivalente no motor
};

export const CENARIOS_LAB: CenarioLab[] = [
  { chave: "casa", label: "Casa", Icone: Home, motor: "sala" },
  {
    chave: "estudio",
    label: "Estúdio",
    Icone: Camera,
    texto: "um estúdio fotográfico simples, fundo liso e iluminação suave de softbox",
  },
  { chave: "ar_livre", label: "Ao ar livre", Icone: Sun, motor: "quintal" },
  { chave: "academia", label: "Academia", Icone: Dumbbell, motor: "academia" },
  { chave: "cozinha", label: "Cozinha", Icone: CookingPot, motor: "cozinha" },
  {
    chave: "escritorio",
    label: "Escritório",
    Icone: Briefcase,
    texto: "um escritório simples com mesa, cadeira e um computador ao fundo desfocado",
  },
  { chave: "quarto", label: "Quarto", Icone: BedDouble, motor: "quarto" },
  {
    chave: "banheiro",
    label: "Banheiro",
    Icone: ShowerHead,
    texto:
      "um banheiro de casa comum, pia com espelho e azulejos claros ao fundo desfocado",
  },
  {
    chave: "praia",
    label: "Praia",
    Icone: Palmtree,
    texto: "uma praia brasileira ensolarada, areia e mar ao fundo desfocado",
  },
  {
    chave: "cafeteria",
    label: "Cafeteria",
    Icone: Coffee,
    texto: "uma cafeteria aconchegante, balcão e mesas de madeira ao fundo desfocado",
  },
  {
    chave: "loja",
    label: "Loja",
    Icone: Store,
    texto: "o interior de uma loja de roupas, araras e prateleiras ao fundo desfocado",
  },
  { chave: "outros", label: "Outros", Icone: MoreHorizontal },
];

export function LabCenario({
  escolhido,
  textoLivre,
  onEscolher,
  onTextoLivre,
}: {
  escolhido: string | null;
  textoLivre: string;
  onEscolher: (chave: string) => void;
  onTextoLivre: (t: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Onde a cena acontece. O fundo aparece desfocado, com o produto e o avatar
        sempre nítidos.
      </p>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {CENARIOS_LAB.map(({ chave, label, Icone }) => {
          const ativo = escolhido === chave;
          return (
            <button
              key={chave}
              type="button"
              onClick={() => onEscolher(chave)}
              aria-pressed={ativo}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-xs font-medium transition-all",
                ativo
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground",
              )}
            >
              <Icone className="size-5" />
              {label}
            </button>
          );
        })}
      </div>

      {escolhido === "outros" && (
        <input
          value={textoLivre}
          onChange={(e) => onTextoLivre(e.target.value.slice(0, 160))}
          maxLength={160}
          placeholder="Descreva o cenário (ex: em uma varanda com plantas, no fim da tarde)"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60"
        />
      )}
    </div>
  );
}
