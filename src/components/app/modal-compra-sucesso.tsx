"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Coins, Sparkles, X, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// 1 crédito = R$ 0,01, então o saldo em centavos é o próprio número de créditos.
// (não dá pra importar de @/lib/creditos aqui: aquele módulo é server-only)
function fmtCreditos(centavos: number) {
  return Math.round(centavos).toLocaleString("pt-BR");
}

/**
 * Modal de "Pagamento aprovado" que aparece quando a pessoa volta do checkout da
 * Cakto. Dispara pela URL `?compra=sucesso` (a Cakto redireciona pra cá depois do
 * pagamento). Ao fechar, limpa o parametro pra nao reabrir no refresh. O credito
 * entra pelo webhook (assincrono), entao damos um refresh curto pra pegar o saldo
 * novo caso ainda nao tenha aparecido.
 */

// confete deterministico (sem Math.random pra nao quebrar hidratacao): 16 peças
const CONFETES = Array.from({ length: 16 }, (_, i) => {
  const cores = ["#22c55e", "#f59e0b", "#38bdf8", "#ec4899", "#a78bfa", "#facc15"];
  return {
    esquerda: (i * 6.25 + (i % 3) * 3) % 100, // espalha no eixo X
    cor: cores[i % cores.length],
    atraso: (i % 8) * 0.12, // escalona a queda
    duracao: 1.8 + (i % 5) * 0.25,
    tamanho: 6 + (i % 3) * 3,
    redondo: i % 2 === 0,
  };
});

export function ModalCompraSucesso({ saldoCentavos }: { saldoCentavos: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const sucesso = params.get("compra") === "sucesso";
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (sucesso) setAberto(true);
  }, [sucesso]);

  // ao voltar do pagamento, o credito pode levar 1-2s pra entrar pelo webhook.
  // Damos um refresh unico ~2,5s depois pra o saldo exibido ficar em dia.
  useEffect(() => {
    if (!sucesso) return;
    const t = setTimeout(() => router.refresh(), 2500);
    return () => clearTimeout(t);
  }, [sucesso, router]);

  function fechar() {
    setAberto(false);
    // limpa o ?compra=sucesso da URL sem recarregar
    router.replace("/painel/creditos", { scroll: false });
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => (o ? setAberto(true) : fechar())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl transition-all duration-300 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          {/* topo festivo com brilho + confete + check animado */}
          <div className="relative overflow-hidden bg-gradient-to-b from-primary/25 to-transparent px-6 pt-9 pb-6 text-center">
            <div className="grain absolute inset-0 opacity-60" />
            {/* confete caindo */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {CONFETES.map((c, i) => (
                <span
                  key={i}
                  className="absolute top-[-12px] animate-confete"
                  style={{
                    left: `${c.esquerda}%`,
                    width: c.tamanho,
                    height: c.tamanho,
                    background: c.cor,
                    borderRadius: c.redondo ? "9999px" : "2px",
                    animationDelay: `${c.atraso}s`,
                    animationDuration: `${c.duracao}s`,
                  }}
                />
              ))}
            </div>

            {/* check com anel pulsante */}
            <div className="relative mx-auto grid size-20 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              <span className="absolute inset-0 rounded-full bg-primary/15" />
              <span className="relative grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 animate-check-pop">
                <Check className="size-9" strokeWidth={3} />
              </span>
            </div>

            <Dialog.Title className="mt-5 text-2xl font-bold tracking-tight text-glow">
              Pagamento aprovado! 🎉
            </Dialog.Title>
            <Dialog.Description className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              Obrigado pela sua compra! Seus créditos já foram adicionados na sua
              conta e estão prontinhos pra usar.
            </Dialog.Description>
          </div>

          {/* saldo atual */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3.5">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <Coins className="size-5" />
              </span>
              <div className="text-left">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Seu saldo agora
                </p>
                <p className="text-xl font-bold leading-none text-foreground">
                  {fmtCreditos(saldoCentavos)}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    créditos
                  </span>
                </p>
              </div>
            </div>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Sparkles className="size-3.5 shrink-0 text-primary" />
              Acabou de comprar? O saldo atualiza em instantes.
            </p>

            {/* acoes */}
            <div className="mt-5 flex flex-col gap-2">
              <Button
                size="lg"
                className="h-12 w-full text-base"
                render={<Link href="/painel" onClick={fechar} />}
              >
                <Wand2 className="size-5" />
                Começar a criar vídeos
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={fechar}
              >
                Continuar aqui nos créditos
              </Button>
            </div>
          </div>

          {/* fechar (X) */}
          <Dialog.Close
            render={<Button variant="ghost" size="icon-sm" className="absolute right-3 top-3" />}
          >
            <X className="size-4" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>

          {/* animações locais do modal */}
          <style>{`
            @keyframes confete {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(240px) rotate(420deg); opacity: 0; }
            }
            .animate-confete { animation: confete linear forwards; }
            @keyframes check-pop {
              0% { transform: scale(0); }
              60% { transform: scale(1.15); }
              100% { transform: scale(1); }
            }
            .animate-check-pop { animation: check-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
          `}</style>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
