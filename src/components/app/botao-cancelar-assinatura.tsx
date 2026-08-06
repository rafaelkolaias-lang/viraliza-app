"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Cancelar a renovação da assinatura, direto no painel.
 *
 * A LP e o modal de assinatura prometem "cancele quando quiser, sem multa e sem
 * falar com ninguém": isto aqui é o que cumpre a promessa. Numa cobrança
 * recorrente, cancelamento difícil não é só experiência ruim, é problema com o
 * Código de Defesa do Consumidor.
 *
 * O acesso NÃO cai na hora: o mês já pago continua valendo até o vencimento.
 */
export function BotaoCancelarAssinatura({ venceEm }: { venceEm: string | null }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function cancelar() {
    setOcupado(true);
    try {
      const res = await fetch("/api/mercadopago/assinatura", { method: "DELETE" });
      const d = (await res.json()) as { erro?: string };
      if (!res.ok) {
        toast.error("Não consegui cancelar", {
          description: d.erro || "Tente de novo em instantes.",
        });
        return;
      }
      setAberto(false);
      toast.success("Renovação cancelada", {
        description: venceEm
          ? `Seu acesso continua até ${venceEm}. Depois disso, não cobramos mais.`
          : "Não vamos cobrar de novo. Seu acesso segue até o fim do período pago.",
      });
      router.refresh();
    } catch {
      toast.error("Não consegui cancelar", {
        description: "Confira sua conexão e tente de novo.",
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        Cancelar renovação
      </button>

      <Dialog.Root open={aberto} onOpenChange={(o) => !o && !ocupado && setAberto(false)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl transition-all duration-300 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-bold tracking-tight">
                  Cancelar a renovação?
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                  Sem multa, e você não perde o que já pagou.
                </Dialog.Description>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  Seu acesso continua{venceEm ? <> até <b className="text-foreground">{venceEm}</b></> : " até o fim do período já pago"}.
                </li>
                <li>Depois dessa data, a cobrança mensal para de acontecer.</li>
                <li>Os créditos que já estão na sua conta continuam seus.</li>
                <li>Pode assinar de novo quando quiser, no mesmo lugar.</li>
              </ul>

              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={ocupado}
                  onClick={() => setAberto(false)}
                >
                  Continuar assinante
                </Button>
                <Button
                  variant="destructive"
                  className="h-11 flex-1"
                  disabled={ocupado}
                  onClick={cancelar}
                >
                  {ocupado ? <Loader2 className="size-4 animate-spin" /> : "Cancelar"}
                </Button>
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
