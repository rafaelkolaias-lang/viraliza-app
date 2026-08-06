"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Payment Brick do Mercado Pago: o formulário de pagamento OFICIAL deles,
 * renderizado dentro da nossa página.
 *
 * Por que Brick e não campos na mão: ele já traz cartão de crédito, débito,
 * pré-pago, Pix e boleto num componente só, com máscara, bandeira, parcelas
 * calculadas e mensagem de erro em português. A versão feita à mão tinha só
 * cartão e Pix, e ainda ficava feia.
 *
 * Segurança: o número do cartão vive dentro de iframes do MP e vai direto pra
 * eles. O que chega no nosso servidor é só um token.
 */

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      opts?: { locale?: string },
    ) => {
      bricks: () => {
        create: (
          tipo: string,
          containerId: string,
          settings: Record<string, unknown>,
        ) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2";

function carregarSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existente) {
      existente.addEventListener("load", () => resolve());
      existente.addEventListener("error", () => reject(new Error("SDK não carregou")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("SDK não carregou"));
    document.head.appendChild(s);
  });
}

export type ResultadoBrick = {
  paymentId: string;
  status: string;
  statusDetalhe?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  linkBoleto?: string;
};

export function MpBrick({
  publicKey,
  valor,
  containerId = "mp-brick",
  onResultado,
  onErro,
}: {
  publicKey: string;
  /** valor a cobrar, em reais */
  valor: number;
  containerId?: string;
  onResultado: (r: ResultadoBrick) => void;
  onErro: (msg: string) => void;
}) {
  const [carregando, setCarregando] = useState(true);
  // guardados em ref porque o Brick só lê os callbacks uma vez, na criação:
  // sem isso ele congelaria a primeira versão das funções
  const resRef = useRef(onResultado);
  const errRef = useRef(onErro);
  const valorRef = useRef(valor);
  resRef.current = onResultado;
  errRef.current = onErro;
  valorRef.current = valor;

  useEffect(() => {
    let vivo = true;
    let controller: { unmount: () => void } | null = null;

    (async () => {
      try {
        await carregarSdk();
        if (!vivo || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        controller = await mp.bricks().create("payment", containerId, {
          initialization: { amount: valorRef.current },
          customization: {
            paymentMethods: {
              creditCard: "all",
              debitCard: "all",
              prepaidCard: "all",
              bankTransfer: "all", // Pix
              ticket: "all", // boleto
            },
            visual: {
              hideFormTitle: true,
              style: {
                theme: "dark",
                customVariables: {
                  baseColor: "#f97316",
                  formBackgroundColor: "transparent",
                  borderRadiusMedium: "12px",
                  borderRadiusLarge: "16px",
                  fontSizeMedium: "14px",
                },
              },
            },
          },
          callbacks: {
            onReady: () => {
              if (vivo) setCarregando(false);
            },
            onSubmit: ({ formData }: { formData: unknown }) =>
              // o Brick espera uma Promise: enquanto ela não resolve, ele
              // mantém o botão travado com o "processando" dele
              fetch("/api/mercadopago/pagar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: valorRef.current, form: formData }),
              })
                .then(async (res) => {
                  const d = (await res.json()) as ResultadoBrick & { erro?: string };
                  if (!res.ok || !d.paymentId) throw new Error(d.erro || "falhou");
                  resRef.current(d);
                })
                .catch((e: unknown) => {
                  errRef.current(
                    e instanceof Error && e.message !== "falhou"
                      ? e.message
                      : "Não consegui processar o pagamento. Tente de novo.",
                  );
                  throw e; // devolve o erro pro Brick destravar o formulário
                }),
            onError: (erro: { message?: string }) => {
              console.error("[brick]", erro);
              if (vivo) setCarregando(false);
            },
          },
        });
      } catch {
        if (vivo) {
          setCarregando(false);
          errRef.current("Não consegui carregar o pagamento. Recarregue a página.");
        }
      }
    })();

    return () => {
      vivo = false;
      // obrigatório pela doc: sem desmontar, reabrir a tela duplica o Brick
      try {
        controller?.unmount();
      } catch {
        // já desmontado
      }
    };
  }, [publicKey, containerId]);

  return (
    <div className="relative min-h-[220px]">
      {carregando && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Carregando formas de pagamento…
        </div>
      )}
      <div id={containerId} />
    </div>
  );
}
