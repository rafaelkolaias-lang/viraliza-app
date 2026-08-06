"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { Barcode, CheckCircle2, Copy, ExternalLink, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MpBrick, type ResultadoBrick } from "@/components/app/mp-brick";

/**
 * Checkout do Viraliza: a pessoa paga SEM SAIR do site.
 *
 * O formulário é o Payment Brick do Mercado Pago (cartão de crédito, débito,
 * pré-pago, Pix e boleto num componente só). Depois que o pagamento nasce, a
 * tela muda conforme o meio: cartão aprovado mostra confirmação na hora, Pix
 * mostra o QR e fica esperando cair, boleto entrega o link.
 */

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// motivo de recusa do cartão -> frase que a pessoa entende
const RECUSAS: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a validade do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV).",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_insufficient_amount: "Cartão sem limite disponível pra essa compra.",
  cc_rejected_call_for_authorize: "O banco pediu autorização: ligue pro seu banco e tente de novo.",
  cc_rejected_card_disabled: "Cartão desativado. Fale com seu banco.",
  cc_rejected_duplicated_payment: "Você já fez um pagamento igual há pouco. Aguarde uns minutos.",
  cc_rejected_high_risk: "O pagamento não passou na análise. Tente outro cartão ou o Pix.",
  cc_rejected_other_reason: "O cartão recusou o pagamento. Tente outro cartão ou o Pix.",
};

export function CheckoutMP({
  aberto,
  valor,
  publicKey,
  onFechar,
}: {
  aberto: boolean;
  /** valor do pacote em reais (20, 50, 100) */
  valor: number;
  publicKey: string;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [aprovado, setAprovado] = useState(false);
  const [pix, setPix] = useState<ResultadoBrick | null>(null);
  const [boleto, setBoleto] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  // Pix: fica perguntando se caiu. A rota de status também CREDITA quando
  // aprova, então o saldo aparece na hora mesmo se o webhook atrasar.
  const iniciarPolling = useCallback(
    (paymentId: string) => {
      pararPolling();
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/mercadopago/pagamento/${paymentId}`);
          const d = (await r.json()) as { status?: string };
          if (d.status === "approved") {
            pararPolling();
            setPix(null);
            setAprovado(true);
            router.refresh();
          }
          if (d.status === "cancelled" || d.status === "rejected") {
            pararPolling();
            setPix(null);
            toast.error("O pagamento não foi concluído", {
              description: "Gere um novo código e tente de novo.",
            });
          }
        } catch {
          // hiccup de rede: tenta de novo no próximo ciclo
        }
      }, 4000);
    },
    [pararPolling, router],
  );

  function aoResultado(r: ResultadoBrick) {
    if (r.status === "approved") {
      setAprovado(true);
      router.refresh();
      return;
    }
    if (r.qrCodeBase64) {
      setPix(r);
      iniciarPolling(r.paymentId);
      return;
    }
    if (r.linkBoleto) {
      setBoleto(r.linkBoleto);
      return;
    }
    if (r.status === "in_process" || r.status === "pending") {
      toast.info("Pagamento em análise", {
        description: "Assim que aprovar, os créditos caem sozinhos na sua conta.",
      });
      fechar();
      return;
    }
    toast.error("Pagamento recusado", {
      description: RECUSAS[r.statusDetalhe ?? ""] || "Tente outro cartão ou pague com Pix.",
    });
  }

  async function copiarPix() {
    if (!pix?.qrCode) return;
    await navigator.clipboard.writeText(pix.qrCode);
    toast.success("Código Pix copiado", { description: "Cole no app do seu banco pra pagar." });
  }

  const fechar = useCallback(() => {
    pararPolling();
    setPix(null);
    setBoleto(null);
    setAprovado(false);
    onFechar();
  }, [onFechar, pararPolling]);

  useEffect(() => () => pararPolling(), [pararPolling]);

  const creditos = (valor * 100).toLocaleString("pt-BR");

  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => !o && fechar()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl transition-all duration-300 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-card px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-bold tracking-tight">
                {creditos} créditos de IA
              </Dialog.Title>
              <Dialog.Description className="text-xs text-muted-foreground">
                Pagamento único de {fmtBRL(valor)} · sem mensalidade
              </Dialog.Description>
            </div>
            <button
              type="button"
              onClick={fechar}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {aprovado ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="size-8" />
              </span>
              <p className="mt-4 text-xl font-bold">Pagamento aprovado!</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Seus {creditos} créditos já estão na conta. Bons vídeos!
              </p>
              <Button size="lg" className="mt-6 h-11 w-full" onClick={fechar}>
                Começar a usar
              </Button>
            </div>
          ) : pix ? (
            <div className="flex flex-col items-center px-5 py-6">
              <div className="rounded-2xl bg-white p-3">
                {/* o QR vem pronto do MP em base64 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt="QR Code do Pix"
                  className="size-44"
                />
              </div>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Esperando o pagamento…
              </p>
              <Button variant="outline" className="mt-3 h-10 w-full" onClick={copiarPix}>
                <Copy className="size-4" />
                Copiar código Pix
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Abra o app do seu banco, escolha Pix e cole o código. Assim que
                cair, os créditos entram sozinhos. O código vale 30 minutos.
              </p>
            </div>
          ) : boleto ? (
            <div className="flex flex-col items-center px-6 py-8 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
                <Barcode className="size-7" />
              </span>
              <p className="mt-4 text-lg font-bold">Boleto gerado</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                O banco leva até 2 dias úteis pra compensar. Assim que
                compensar, os créditos entram sozinhos.
              </p>
              <Button
                size="lg"
                className="mt-5 h-11 w-full"
                render={<a href={boleto} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink className="size-4" />
                Abrir boleto
              </Button>
              <Button variant="ghost" className="mt-2 h-10 w-full" onClick={fechar}>
                Fechar
              </Button>
            </div>
          ) : (
            <div className="px-5 py-4">
              <MpBrick
                publicKey={publicKey}
                valor={valor}
                onResultado={aoResultado}
                onErro={(msg) => toast.error("Pagamento", { description: msg })}
              />
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0" />
                Pagamento processado pelo Mercado Pago. Os dados do seu cartão
                não passam pelos nossos servidores.
              </p>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
