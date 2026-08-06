"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Pedir reembolso" na aba de Créditos: a pessoa resolve sozinha, sem abrir
 * chamado. Reembolso fácil é o que evita a disputa no cartão, que sai bem mais
 * cara pra plataforma do que devolver o dinheiro.
 *
 * A tela mostra a conta ANTES de confirmar (quanto usou, quanto volta), pra
 * ninguém clicar achando que recebe o valor cheio.
 */

type Compra = {
  orderId: string;
  descricao: string;
  compradoEm: string;
  creditosComprados: number;
  creditosNaoUsados: number;
  fracaoUsada: number;
  devolveCentavos: number;
  comRedutor: boolean;
  diasRestantes: number;
};

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR");

export function MeusReembolsos() {
  const router = useRouter();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [escolhida, setEscolhida] = useState<Compra | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/mercadopago/reembolso")
      .then((r) => r.json())
      .then((d: { compras?: Compra[] }) => {
        if (vivo) setCompras(d.compras ?? []);
      })
      .catch(() => {})
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  async function confirmar() {
    if (!escolhida) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/mercadopago/reembolso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: escolhida.orderId }),
      });
      const d = (await res.json()) as { devolvidoCentavos?: number; erro?: string };
      if (!res.ok) {
        toast.error("Não consegui reembolsar", { description: d.erro });
        return;
      }
      setFeito(d.devolvidoCentavos ?? escolhida.devolveCentavos);
      setCompras((cs) => cs.filter((c) => c.orderId !== escolhida.orderId));
      router.refresh();
    } catch {
      toast.error("Não consegui reembolsar", {
        description: "Confira sua conexão e tente de novo.",
      });
    } finally {
      setOcupado(false);
    }
  }

  function fechar() {
    setEscolhida(null);
    setFeito(null);
  }

  // sem compra na janela: não ocupa espaço na tela
  if (carregando || compras.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <RotateCcw className="size-4 text-muted-foreground" />
        Pedir reembolso
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Comprou e não era o que esperava? Você mesmo resolve aqui, em até 7 dias.
        Devolvemos o valor dos créditos que você ainda não usou.{" "}
        <Link
          href="/reembolso"
          className="underline underline-offset-4 hover:text-foreground"
        >
          Ver a política completa
        </Link>
        .
      </p>

      <ul className="mt-4 space-y-2">
        {compras.map((c) => (
          <li
            key={c.orderId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/50 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.descricao}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {num(c.creditosComprados)} créditos · sobraram {num(c.creditosNaoUsados)} ·
                {c.diasRestantes <= 1
                  ? " último dia pra pedir"
                  : ` faltam ${c.diasRestantes} dias`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-foreground">
                {brl(c.devolveCentavos)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={c.devolveCentavos <= 0}
                onClick={() => setEscolhida(c)}
              >
                Pedir
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog.Root
        open={!!escolhida}
        onOpenChange={(o) => !o && !ocupado && fechar()}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl transition-all duration-300 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {feito !== null ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="size-8" />
                </span>
                <p className="mt-4 text-xl font-bold">Reembolso enviado</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {brl(feito)} voltando pra você. No Pix cai em minutos; no cartão
                  aparece na próxima fatura, conforme o prazo do seu banco.
                </p>
                <Button size="lg" className="mt-6 h-11 w-full" onClick={fechar}>
                  Entendi
                </Button>
              </div>
            ) : escolhida ? (
              <>
                <div className="flex items-start justify-between border-b border-border/60 px-5 py-4">
                  <div>
                    <Dialog.Title className="text-base font-bold tracking-tight">
                      Confirmar o reembolso
                    </Dialog.Title>
                    <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                      Confira a conta antes de confirmar.
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

                <div className="px-5 py-4">
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Você comprou</dt>
                      <dd>{num(escolhida.creditosComprados)} créditos</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Já usou</dt>
                      <dd>
                        {num(escolhida.creditosComprados - escolhida.creditosNaoUsados)}{" "}
                        ({Math.round(escolhida.fracaoUsada * 100)}%)
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Sobraram</dt>
                      <dd>{num(escolhida.creditosNaoUsados)} créditos</dd>
                    </div>
                    {escolhida.comRedutor && (
                      <div className="flex justify-between text-amber-400">
                        <dt>Uso acima de 80%</dt>
                        <dd>-30%</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                      <dt>Você recebe</dt>
                      <dd>{brl(escolhida.devolveCentavos)}</dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Os {num(escolhida.creditosNaoUsados)} créditos que sobraram saem
                    da sua conta. O que você já usou continua usado.
                  </p>

                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      className="h-11 flex-1"
                      disabled={ocupado}
                      onClick={fechar}
                    >
                      Voltar
                    </Button>
                    <Button className="h-11 flex-1" disabled={ocupado} onClick={confirmar}>
                      {ocupado ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "Confirmar"
                      )}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
