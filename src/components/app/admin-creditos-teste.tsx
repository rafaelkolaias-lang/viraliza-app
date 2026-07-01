"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Coins, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { creditarTeste, alternarAssinaturaTeste } from "@/app/actions/creditos";

/**
 * Controles de TESTE só pro admin - creditar a si mesmo e ligar/desligar a
 * assinatura, enquanto pagamento (Kiwify) e débito real (worker) não entram.
 */
export function AdminCreditosTeste({ assinante }: { assinante: boolean }) {
  const [pendente, iniciar] = useTransition();

  function creditar(reais: number) {
    iniciar(async () => {
      await creditarTeste(reais);
      toast.success(`+ R$ ${reais},00 creditado (teste).`);
    });
  }

  function alternar() {
    iniciar(async () => {
      await alternarAssinaturaTeste();
      toast.success(assinante ? "Assinatura desativada." : "Assinatura ativada (teste).");
    });
  }

  return (
    <section className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-300">
        <Coins className="size-4" />
        Painel de teste (admin)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Provisório - até a Kiwify (pagamento) e o worker (débito real) entrarem.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[10, 20, 50, 100].map((v) => (
          <Button
            key={v}
            size="sm"
            variant="outline"
            disabled={pendente}
            onClick={() => creditar(v)}
          >
            {pendente ? <Loader2 className="size-4 animate-spin" /> : `+ R$ ${v}`}
          </Button>
        ))}
        <Button size="sm" disabled={pendente} onClick={alternar}>
          <Crown className="size-4" />
          {assinante ? "Desativar assinatura" : "Ativar assinatura"}
        </Button>
      </div>
    </section>
  );
}
