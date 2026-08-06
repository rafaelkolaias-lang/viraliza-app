"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Headphones,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Undo2,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bandeiras, BandeiraPix } from "@/components/app/bandeiras";
import { ContadorOferta } from "@/components/app/contador-oferta";
import { ProvaSocial } from "@/components/app/prova-social";
import { cpfValido, formatarCpf } from "@/lib/cpf";
import {
  GARANTIAS,
  INCLUI_PLANO,
  OFERTA_MINUTOS,
  PLANO_BASE_REAIS,
  PLANO_DE_REAIS,
  brl,
} from "@/lib/oferta-publica";

/**
 * Checkout público da assinatura: o visitante vem da landing page e paga aqui
 * mesmo, sem sair do site e sem precisar de conta.
 *
 * Existe porque no Viraliza a conta só nasce DEPOIS da compra (trava anti-farm
 * do crédito de boas-vindas). O e-mail digitado aqui é o que vai liberar o
 * cadastro quando o pagamento confirmar, por isso a tela insiste nele.
 *
 * Dois caminhos de pagamento, e eles NÃO são a mesma coisa:
 *  - cartão: vira assinatura de verdade, renova sozinho todo mês;
 *  - Pix: paga 1 mês. Pix não tem cobrança automática (ninguém debita da sua
 *    conta sem você mandar), então a renovação é na mão, avisada por e-mail 3
 *    dias antes. A tela fala isso na cara, porque descobrir depois vira
 *    reclamação de "cortaram meu acesso".
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
      existente.addEventListener("error", () => reject(new Error("SDK")));
      return;
    }
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("SDK"));
    document.head.appendChild(s);
  });
}

/**
 * Selos de segurança. Não é enfeite: em checkout, dizer QUEM processa o
 * pagamento e o que acontece com o dado do cartão é o que tira o dedo do
 * cliente do botão de fechar. Tudo aqui é verdade verificável, e a própria
 * lista de qualidade do Mercado Pago recomenda exibir a marca deles.
 */
function SeloMercadoPago() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
        <ShieldCheck className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-sky-300">Compra protegida</p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Pagamento processado pelo <b className="text-foreground">Mercado Pago</b>,
          com toda a proteção ao comprador.
        </p>
      </div>
    </div>
  );
}

const ICONE_GARANTIA = [Zap, Headphones, Users, Undo2];

function Garantias() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {GARANTIAS.map((g, n) => {
        const Icon = ICONE_GARANTIA[n] ?? Check;
        return (
          <div
            key={g.titulo}
            className="flex items-start gap-2 rounded-xl border border-border bg-background/40 px-2.5 py-2"
          >
            <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold leading-tight">{g.titulo}</span>
              <span className="block text-[10px] leading-tight text-muted-foreground">
                {g.sub}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

type Pix = { paymentId: string; qrCode?: string; qrCodeBase64?: string };

export function AssinarPublico({ publicKey }: { publicKey: string }) {
  const [email, setEmail] = useState("");
  const [etapa, setEtapa] = useState<"email" | "pagar" | "aguardando" | "pronto">("email");
  const [metodo, setMetodo] = useState<"cartao" | "pix">("cartao");
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Pix
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState<Pix | null>(null);
  const [copiado, setCopiado] = useState(false);

  const emailLimpo = email.trim().toLowerCase();
  // os callbacks do Brick e o polling são criados uma vez e não enxergam o state
  // novo: a ref é a ponte pro valor atual do e-mail dentro deles
  const emailRef = useRef(emailLimpo);
  useEffect(() => {
    emailRef.current = emailLimpo;
  }, [emailLimpo]);

  // monta o formulário de cartão só depois do e-mail: um campo por vez converte
  // melhor, e evita carregar o SDK pra quem só está olhando o preço
  useEffect(() => {
    if (etapa !== "pagar" || metodo !== "cartao") return;
    let vivo = true;
    let controller: { unmount: () => void } | null = null;
    setCarregando(true);

    (async () => {
      try {
        await carregarSdk();
        if (!vivo || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        controller = await mp.bricks().create("cardPayment", "brick-assinar", {
          initialization: { amount: PLANO_BASE_REAIS, payer: { email: emailRef.current } },
          customization: {
            visual: {
              hideFormTitle: true,
              style: {
                theme: "dark",
                customVariables: {
                  baseColor: "#f97316",
                  formBackgroundColor: "transparent",
                  borderRadiusMedium: "12px",
                  borderRadiusLarge: "14px",
                },
              },
            },
            // mensalidade não parcela
            paymentMethods: { maxInstallments: 1 },
          },
          callbacks: {
            onReady: () => vivo && setCarregando(false),
            onSubmit: ({ token }: { token?: string }) => {
              setOcupado(true);
              return fetch("/api/publico/assinar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailRef.current, cardTokenId: token }),
              })
                .then(async (res) => {
                  const d = (await res.json()) as {
                    status?: string;
                    liberado?: boolean;
                    erro?: string;
                  };
                  if (!res.ok) throw new Error(d.erro || "falhou");
                  // assinatura autorizada = cartão aceito, cadastro liberado na
                  // hora. Sem autorização (raro), cai na tela de espera, que
                  // pergunta até o pagamento confirmar.
                  if (vivo) setEtapa(d.liberado ? "pronto" : "aguardando");
                })
                .catch((e: unknown) => {
                  toast.error("Não consegui concluir", {
                    description:
                      e instanceof Error && e.message !== "falhou"
                        ? e.message
                        : "Confira os dados do cartão e tente de novo.",
                  });
                  throw e; // devolve pro Brick destravar o botão
                })
                .finally(() => vivo && setOcupado(false));
            },
            onError: () => vivo && setCarregando(false),
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
  }, [etapa, metodo, publicKey]);

  // com o QR na tela, pergunta o status até aprovar: o Pix cai em segundos e a
  // pessoa não deve precisar recarregar nada pra ver que deu certo
  useEffect(() => {
    if (!pix) return;
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/publico/pagamento/${pix.paymentId}?email=${encodeURIComponent(emailRef.current)}`,
        );
        const d = (await res.json()) as { status?: string };
        if (vivo && d.status === "approved") {
          clearInterval(t);
          setEtapa("pronto");
        }
      } catch {
        // rede oscilou: tenta de novo no próximo ciclo
      }
    }, 4000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [pix]);

  // cartão autorizado: fica perguntando se a cobrança de verdade já caiu
  useEffect(() => {
    if (etapa !== "aguardando") return;
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/publico/liberado?email=${encodeURIComponent(emailRef.current)}`,
        );
        const d = (await res.json()) as { liberado?: boolean };
        if (vivo && d.liberado) {
          clearInterval(t);
          setEtapa("pronto");
        }
      } catch {
        // rede oscilou: tenta de novo no próximo ciclo
      }
    }, 4000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [etapa]);

  async function gerarPix() {
    if (!nome.trim().includes(" ")) {
      toast.error("Escreva seu nome completo");
      return;
    }
    if (!cpfValido(cpf)) {
      toast.error("CPF inválido", { description: "Confira os números e tente de novo." });
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch("/api/publico/assinar/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailRef.current, nome: nome.trim(), cpf }),
      });
      const d = (await res.json()) as Pix & { erro?: string };
      if (!res.ok) throw new Error(d.erro || "falhou");
      setPix({ paymentId: d.paymentId, qrCode: d.qrCode, qrCodeBase64: d.qrCodeBase64 });
    } catch (e) {
      toast.error("Não consegui gerar o Pix", {
        description: e instanceof Error && e.message !== "falhou" ? e.message : "Tente de novo.",
      });
    } finally {
      setOcupado(false);
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

  // ---------- esperando a cobrança cair ----------
  if (etapa === "aguardando") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/15 text-primary">
          <Loader2 className="size-9 animate-spin" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Quase lá!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estamos confirmando seu pagamento com o Mercado Pago. Esta tela vira
          sozinha assim que terminar.
        </p>
        <p className="mt-4 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          Pode fechar esta página se quiser: assim que confirmar, mandamos o link
          pra criar sua conta em{" "}
          <b className="text-foreground">{emailLimpo}</b>.
        </p>
      </div>
    );
  }

  // ---------- confirmação ----------
  if (etapa === "pronto") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="size-9" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Pagamento confirmado!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Falta um passo: criar sua conta com o mesmo e-mail que você usou aqui.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium">
          <Mail className="size-4 text-primary" />
          {emailLimpo}
        </p>
        <Button size="lg" className="mt-6 h-14 w-full text-base font-bold" render={<a href="/cadastro" />}>
          Criar minha conta
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          Também mandamos esse link pro seu e-mail.
        </p>
      </div>
    );
  }

  // ---------- checkout ----------
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:py-12">
      <ProvaSocial />

      <div className="mb-6 flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">
          Viraliza<span className="text-primary">.</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <Lock className="size-3.5" />
          Ambiente seguro
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ===== coluna do pagamento ===== */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            {/* passo 1 */}
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                1
              </span>
              <h2 className="text-sm font-semibold">Seus dados</h2>
            </div>

            {etapa === "email" ? (
              <div className="mt-4">
                <label htmlFor="email" className="text-sm text-muted-foreground">
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="voce@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && emailValido(emailLimpo)) setEtapa("pagar");
                  }}
                  className="mt-1.5 h-12 rounded-xl text-base"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  É com este e-mail que você cria sua conta depois do pagamento.
                </p>
                <Button
                  size="lg"
                  className="mt-4 h-12 w-full font-semibold"
                  disabled={!emailValido(emailLimpo)}
                  onClick={() => setEtapa("pagar")}
                >
                  Continuar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEtapa("email");
                  setPix(null);
                }}
                className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-3 text-left transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-emerald-400" />
                  {emailLimpo}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <RefreshCw className="size-3" />
                  trocar
                </span>
              </button>
            )}

            {/* passo 2 */}
            <div className="mt-6 flex items-center gap-2">
              <span
                className={
                  etapa === "pagar"
                    ? "grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                    : "grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-muted-foreground"
                }
              >
                2
              </span>
              <h2
                className={
                  etapa === "pagar"
                    ? "text-sm font-semibold"
                    : "text-sm font-semibold text-muted-foreground"
                }
              >
                Forma de pagamento
              </h2>
            </div>

            {etapa !== "pagar" ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Preencha o e-mail acima pra liberar esta etapa.
              </p>
            ) : (
              <>
                {/* abas cartão / pix */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodo("cartao")}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors ${
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
                    className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left transition-colors ${
                      metodo === "pix"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    <BandeiraPix className="size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">Pix</span>
                      <span className="block text-[10px] leading-tight text-muted-foreground">
                        Cai na hora
                      </span>
                    </span>
                  </button>
                </div>

                {metodo === "cartao" ? (
                  <div className="relative mt-4 min-h-[240px]">
                    {(carregando || ocupado) && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-card/80 text-sm text-muted-foreground backdrop-blur-sm">
                        <Loader2 className="size-5 animate-spin" />
                        {ocupado ? "Confirmando sua assinatura…" : "Carregando…"}
                      </div>
                    )}
                    <div id="brick-assinar" />
                  </div>
                ) : pix ? (
                  <div className="mt-4 text-center">
                    <p className="text-sm font-semibold">Escaneie pra pagar</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Abre o app do banco, aponta a câmera e pronto. Esta tela vira
                      sozinha quando o pagamento cair.
                    </p>
                    {pix.qrCodeBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/png;base64,${pix.qrCodeBase64}`}
                        alt="QR Code do Pix"
                        className="mx-auto mt-4 size-56 rounded-xl border border-border bg-white p-2"
                      />
                    ) : null}
                    {pix.qrCode ? (
                      <>
                        <p className="mt-4 break-all rounded-xl border border-border bg-background/60 p-3 text-left font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {pix.qrCode}
                        </p>
                        <Button
                          size="lg"
                          className="mt-3 h-12 w-full font-semibold"
                          onClick={copiarPix}
                        >
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
                      </>
                    ) : null}
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Aguardando o pagamento
                    </p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground">
                      No Pix você paga <b className="text-foreground">1 mês</b>. Não existe
                      cobrança automática no Pix, então a gente te avisa por e-mail 3 dias
                      antes de vencer pra você renovar. Quer no automático? Use o cartão.
                    </p>
                    <label htmlFor="nome" className="mt-4 block text-sm text-muted-foreground">
                      Nome completo
                    </label>
                    <Input
                      id="nome"
                      autoComplete="name"
                      placeholder="Como está no seu documento"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl text-base"
                    />
                    <label htmlFor="cpf" className="mt-3 block text-sm text-muted-foreground">
                      CPF
                    </label>
                    <Input
                      id="cpf"
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
                      disabled={ocupado}
                      onClick={gerarPix}
                    >
                      {ocupado ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Gerando…
                        </>
                      ) : (
                        <>
                          <BandeiraPix className="size-4" />
                          Gerar Pix de {brl(PLANO_BASE_REAIS)}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* selos de confiança: quem processa, o que acontece com o cartão */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { Icon: Lock, titulo: "Compra 100% segura", sub: "Conexão criptografada" },
              { Icon: CreditCard, titulo: "Cartão protegido", sub: "Não passa por nós" },
              { Icon: Undo2, titulo: "Cancele quando quiser", sub: "Sem multa" },
            ].map(({ Icon, titulo, sub }) => (
              <div
                key={titulo}
                className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <Icon className="size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold leading-tight">{titulo}</span>
                  <span className="block text-[10px] text-muted-foreground">{sub}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <SeloMercadoPago />
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <BadgeCheck className="size-3.5 shrink-0 text-primary" />
            Os dados do seu cartão são digitados direto no Mercado Pago e nunca
            passam pelos nossos servidores.
          </p>
        </div>

        {/* ===== resumo do pedido ===== */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold">Resumo do pedido</h2>

            <div className="mt-4 flex items-start justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <p className="text-sm font-semibold">Assinatura Viraliza</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Mensal · renova sozinho</p>
              </div>
              <p className="whitespace-nowrap text-right text-sm font-semibold">
                <span className="block text-xs font-normal text-muted-foreground line-through">
                  {brl(PLANO_DE_REAIS)}
                </span>
                {brl(PLANO_BASE_REAIS)}
              </p>
            </div>

            <ul className="mt-4 space-y-2">
              {INCLUI_PLANO.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-end justify-between">
                <span className="text-sm font-semibold">Total hoje</span>
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground line-through">
                    {brl(PLANO_DE_REAIS)}
                  </span>
                  <span className="text-2xl font-bold tracking-tight">
                    {brl(PLANO_BASE_REAIS)}
                    <span className="text-sm font-medium text-muted-foreground">/mês</span>
                  </span>
                </span>
              </div>
              <p className="mt-1 text-right text-[11px] font-semibold text-emerald-400">
                Você economiza {brl(PLANO_DE_REAIS - PLANO_BASE_REAIS)}
              </p>
            </div>

            <div className="mt-4">
              <ContadorOferta minutos={OFERTA_MINUTOS} />
            </div>

            <div className="mt-4">
              <Garantias />
            </div>

            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Aceitamos
              </p>
              <Bandeiras />
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Ao assinar você concorda com a{" "}
            <a href="/reembolso" className="underline underline-offset-4">
              política de reembolso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" className="underline underline-offset-4">
              privacidade
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
