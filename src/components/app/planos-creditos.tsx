"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Zap, TrendingUp, Rocket, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plano = {
  valor: number;
  etiqueta: string;
  sub: string;
  icon: typeof Sparkles;
  destaque?: boolean;
};

const PLANOS: Plano[] = [
  {
    valor: 10,
    etiqueta: "Para experimentar",
    sub: "Ideal pra testar a plataforma",
    icon: Sparkles,
  },
  {
    valor: 20,
    etiqueta: "Mais escolhido",
    sub: "O melhor pra começar pra valer",
    icon: Zap,
    destaque: true,
  },
  {
    valor: 50,
    etiqueta: "Melhor custo",
    sub: "Pra quem posta toda semana",
    icon: TrendingUp,
  },
  {
    valor: 100,
    etiqueta: "Para escalar",
    sub: "Volume alto de vídeos no mês",
    icon: Rocket,
  },
];

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PlanosCreditos() {
  const [carregando, setCarregando] = useState<number | null>(null);

  function comprar(valor: number) {
    // Pagamento ainda não integrado - entra a Kiwify depois.
    setCarregando(valor);
    setTimeout(() => {
      setCarregando(null);
      toast.info("Pagamento em breve", {
        description: `A compra de ${brl(valor)} será liberada na integração com a Kiwify. 🛒`,
      });
    }, 600);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLANOS.map((p) => {
        const Icon = p.icon;
        const ocupado = carregando === p.valor;
        return (
          <div
            key={p.valor}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-5 transition-all duration-200",
              p.destaque
                ? "border-primary shadow-lg shadow-primary/10"
                : "border-border hover:-translate-y-1 hover:border-primary/50",
            )}
          >
            {p.destaque && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground shadow">
                Mais popular
              </span>
            )}

            <span
              className={cn(
                "grid size-11 place-items-center rounded-xl",
                p.destaque ? "bg-primary/15 text-primary" : "bg-accent text-foreground",
              )}
            >
              <Icon className="size-6" />
            </span>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {p.etiqueta}
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {brl(p.valor)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{p.sub}</p>

            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-primary" />
              {(p.valor * 100).toLocaleString("pt-BR")} créditos de IA
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-primary" />
              Vale pra texto e áudio
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 shrink-0 text-primary" />
              Validade de 12 meses
            </p>

            <Button
              type="button"
              size="lg"
              variant={p.destaque ? "default" : "outline"}
              className="mt-5 h-11 w-full"
              disabled={ocupado}
              onClick={() => comprar(p.valor)}
            >
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Comprar"
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
