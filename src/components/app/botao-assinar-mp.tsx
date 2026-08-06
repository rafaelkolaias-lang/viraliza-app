"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BandeiraPix } from "@/components/app/bandeiras";
import { cpfValido, formatarCpf } from "@/lib/cpf";

/**
 * Assinar/renovar SEM sair do site, em dois caminhos que NÃO são equivalentes:
 *
 *  - CARTÃO: vira assinatura recorrente de verdade (Card Payment Brick do
 *    Mercado Pago, o formulário oficial deles). Cobra sozinho todo mês.
 *  - PIX: paga UM mês. Não existe cobrança automática no Pix, então a próxima
 *    renovação é na mão. A tela avisa isso antes de gerar o QR.
 *
 * O número do cartão vive dentro dos iframes do MP: o que chega no nosso
 * servidor é só o token, que vira a assinatura mensal.
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

export function BotaoAssinarMP({
  ativa,
  publicKey,
  valorReais,
}: {
  ativa: boolean;
  publicKey: string;
  valorReais: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [feito, setFeito] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [metodo, setMetodo] = useState<"cartao" | "pix">("cartao");
  const [cpf, setCpf] = useState("");
  const [gerando, setGerando] = useState(false);
  const [pix, setPix] = useState<{
    paymentId: string;
    qrCode?: string;
    qrCodeBase64?: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const feitoRef = useRef(false);

  const valor = valorReais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  useEffect(() => {
    if (!aberto || feito || metodo !== "cartao") return;
    let vivo = true;
    let controller: { unmount: () => void } | null = null;
    setCarregando(true);

    (async () => {
      try {
        await carregarSdk();
        if (!vivo || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        controller = await mp.bricks().create("cardPayment", "mp-assinatura-brick", {
          initialization: { amount: valorReais },
          customization: {
            visual: {
              hideFormTitle: true,
              style: {
                theme: "dark",
                customVariables: {
                  baseColor: "#f97316",
                  formBackgroundColor: "transparent",
                  borderRadiusMedium: "12px",
                },
              },
            },
            // assinatura cobra o mesmo valor todo mês: parcelar não faz sentido
            paymentMethods: { maxInstallments: 1 },
          },
          callbacks: {
            onReady: () => {
              if (vivo) setCarregando(false);
            },
            onSubmit: ({ token }: { token?: string }) =>
              fetch("/api/mercadopago/assinatura", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cardTokenId: token }),
              })
                .then(async (res) => {
                  const d = (await res.json()) as { status?: string; erro?: string };
                  if (!res.ok) throw new Error(d.erro || "falhou");
                  if (d.status === "authorized") {
                    feitoRef.current = true;
                    if (vivo) setFeito(true);
                    router.refresh();
                    return;
                  }
                  toast.info("Assinatura em processamento", {
                    description: "Assim que o pagamento confirmar, seu acesso é liberado.",
                  });
                  if (vivo) setAberto(false);
                })
                .catch((e: unknown) => {
                  toast.error("Não consegui ativar a assinatura", {
                    description:
                      e instanceof Error && e.message !== "falhou"
                        ? e.message
                        : "Confira os dados do cartão e tente de novo.",
                  });
                  throw e; // devolve o erro pro Brick destravar o formulário
                }),
            onError: (erro: { message?: string }) => {
              console.error("[brick-assinatura]", erro);
              if (vivo) setCarregando(false);
            },
          },
        });
      } catch {
        if (vivo) {
          setCarregando(false);
          toast.error("Não consegui carregar o pagamento", {
            description: "Recarregue a página e tente de novo.",
          });
        }
      }
    })();

    return () => {
      vivo = false;
      try {
        controller?.unmount();
      } catch {
        // já desmontado
      }
    };
  }, [aberto, feito, metodo, publicKey, valorReais, router]);

  // com o QR na tela, pergunta o status até aprovar (o Pix cai em segundos)
  useEffect(() => {
    if (!pix) return;
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/mercadopago/pagamento/${pix.paymentId}`);
        const d = (await res.json()) as { status?: string };
        if (vivo && d.status === "approved") {
          clearInterval(t);
          feitoRef.current = true;
          setFeito(true);
          router.refresh();
        }
      } catch {
        // rede oscilou: tenta de novo no próximo ciclo
      }
    }, 4000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [pix, router]);

  async function gerarPix() {
    if (!cpfValido(cpf)) {
      toast.error("CPF inválido", { description: "Confira os números e tente de novo." });
      return;
    }
    setGerando(true);
    try {
      const res = await fetch("/api/mercadopago/assinatura/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      const d = (await res.json()) as {
        paymentId: string;
        qrCode?: string;
        qrCodeBase64?: string;
        erro?: string;
      };
      if (!res.ok) throw new Error(d.erro || "falhou");
      setPix({ paymentId: d.paymentId, qrCode: d.qrCode, qrCodeBase64: d.qrCodeBase64 });
    } catch (e) {
      toast.error("Não consegui gerar o Pix", {
        description: e instanceof Error && e.message !== "falhou" ? e.message : "Tente de novo.",
      });
    } finally {
      setGerando(false);
    }
  }

  async function copiarPix() {
    if (!pix?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error("Não consegui copiar", { description: "Selecione o código na mão." });
    }
  }

  function fechar() {
    setAberto(false);
    setFeito(false);
    setPix(null);
    setMetodo("cartao");
    feitoRef.current = false;
  }

  return (
    <>
      <Button size="lg" className="h-11" onClick={() => setAberto(true)}>
        <Crown className="size-4" />
        {ativa ? "Renovar agora" : "Assinar agora"}
      </Button>

      <Dialog.Root open={aberto} onOpenChange={(o) => !o && fechar()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl transition-all duration-300 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-card px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-bold tracking-tight">
                  Assinatura Viraliza
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  {valor}/mês · 4.000 créditos todo mês · cancele quando quiser
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

            {feito ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="size-8" />
                </span>
                <p className="mt-4 text-xl font-bold">Assinatura ativa!</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Biblioteca liberada e 4.000 créditos de brinde todo mês.
                </p>
                <Button size="lg" className="mt-6 h-11 w-full" onClick={fechar}>
                  Aproveitar
                </Button>
              </div>
            ) : (
              <div className="px-5 py-4">
                {/* abas: cartão renova sozinho, Pix paga um mês */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodo("cartao")}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      metodo === "cartao"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    <CreditCard className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">Cartão</span>
                      <span className="block text-[10px] leading-tight text-muted-foreground">
                        Renova sozinho
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetodo("pix")}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      metodo === "pix"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    <BandeiraPix className="size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">Pix</span>
                      <span className="block text-[10px] leading-tight text-muted-foreground">
                        1 mês, cai na hora
                      </span>
                    </span>
                  </button>
                </div>

                {metodo === "cartao" ? (
                  <>
                    <div className="relative mt-3 min-h-[220px]">
                      {carregando && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-5 animate-spin" />
                          Carregando…
                        </div>
                      )}
                      <div id="mp-assinatura-brick" />
                    </div>
                    <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
                      <ShieldCheck className="size-3.5 shrink-0" />
                      Cobrança mensal pelo Mercado Pago. Os dados do seu cartão não
                      passam pelos nossos servidores.
                    </p>
                  </>
                ) : pix ? (
                  <div className="mt-3 text-center">
                    <p className="text-sm font-semibold">Escaneie pra pagar</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Esta janela vira sozinha quando o pagamento cair.
                    </p>
                    {pix.qrCodeBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/png;base64,${pix.qrCodeBase64}`}
                        alt="QR Code do Pix"
                        className="mx-auto mt-3 size-52 rounded-xl border border-border bg-white p-2"
                      />
                    ) : null}
                    {pix.qrCode ? (
                      <Button size="lg" className="mt-3 h-11 w-full" onClick={copiarPix}>
                        {copiado ? (
                          <>
                            <Check className="size-4" />
                            Código copiado
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" />
                            Copiar código Pix
                          </>
                        )}
                      </Button>
                    ) : null}
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Aguardando o pagamento
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
                      No Pix você paga <b className="text-foreground">1 mês</b> ({valor}). Pix
                      não tem cobrança automática, então a gente te avisa por e-mail 3 dias
                      antes de vencer. Quer no automático? Use o cartão.
                    </p>
                    <label htmlFor="cpf-pix" className="mt-4 block text-sm text-muted-foreground">
                      CPF
                    </label>
                    <Input
                      id="cpf-pix"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => setCpf(formatarCpf(e.target.value))}
                      className="mt-1.5 h-12 rounded-xl text-base"
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      O Pix exige o CPF do pagador. É o banco que confere, a gente não guarda.
                    </p>
                    <Button
                      size="lg"
                      className="mt-4 h-12 w-full font-bold"
                      disabled={gerando}
                      onClick={gerarPix}
                    >
                      {gerando ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Gerando…
                        </>
                      ) : (
                        <>
                          <BandeiraPix className="size-4" />
                          Gerar Pix de {valor}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
