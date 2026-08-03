"use client";

import { useEffect, useState } from "react";
import { Heart, Loader2, MessageCircle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VALORES_SUGERIDOS } from "@/lib/apoios-const";
import type { ApoioItem } from "@/lib/apoios";

/**
 * "Apoie o projeto": doação por Pix, sem contrapartida.
 *
 * A pessoa escolhe um valor sugerido ou digita o dela, e vai pro checkout da
 * InfinitePay. Quando volta com ?obrigado=1, aparece o modal de agradecimento
 * com o WhatsApp pra ela dar opinião.
 */

const ZAP = "5512996623567";
const ZAP_BONITO = "(12) 99662-3567";

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function quando(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function ApoiarPainel({
  admin,
  meus,
  todos,
}: {
  admin: boolean;
  meus: ApoioItem[];
  todos: ApoioItem[];
}) {
  const [escolhido, setEscolhido] = useState<number | null>(VALORES_SUGERIDOS[1]);
  const [outro, setOutro] = useState("");
  const [indo, setIndo] = useState(false);
  const [obrigado, setObrigado] = useState(false);

  // volta do checkout com ?obrigado=1 -> mostra o modal e limpa a URL, pra um
  // F5 depois não abrir o agradecimento de novo
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("obrigado") === "1") {
      setObrigado(true);
      url.searchParams.delete("obrigado");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const valorCentavos = (() => {
    if (escolhido !== null) return escolhido;
    const n = parseFloat(outro.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  })();

  async function apoiar() {
    if (valorCentavos < 200) {
      toast.error("O valor mínimo é R$ 2,00.");
      return;
    }
    setIndo(true);
    try {
      const r = await fetch("/api/infinitepay/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valorCentavos }),
      });
      const d = await r.json();
      if (!r.ok || !d?.url) {
        toast.error(d?.erro ?? "Não consegui abrir o pagamento.");
        setIndo(false);
        return;
      }
      window.location.href = d.url;
    } catch {
      toast.error("Sem conexão. Tente de novo.");
      setIndo(false);
    }
  }

  const total = todos.reduce((s, a) => s + a.valorCentavos, 0);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Heart className="size-7 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Apoie o projeto</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          O Viraliza é feito por gente pequena, e cada ferramenta nova que entra
          aqui sai do que a gente consegue bancar. Se a plataforma te ajudou, um
          apoio de qualquer valor faz diferença de verdade.
        </p>
        <p className="mx-auto mt-3 max-w-md text-xs text-muted-foreground">
          Isso é uma doação: você não ganha crédito nem desbloqueia nada. É só
          apoio mesmo, e a gente agradece do fundo do coração.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-medium">Escolha um valor</p>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VALORES_SUGERIDOS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setEscolhido(v);
                setOutro("");
              }}
              className={cn(
                "rounded-xl border px-3 py-3 text-sm font-semibold transition",
                escolhido === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40",
              )}
            >
              {reais(v)}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <label className="text-xs text-muted-foreground" htmlFor="outro-valor">
            Ou digite outro valor
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-border px-3 focus-within:border-primary/50">
            <span className="text-sm text-muted-foreground">R$</span>
            <input
              id="outro-valor"
              inputMode="decimal"
              placeholder="0,00"
              value={outro}
              onChange={(e) => {
                setOutro(e.target.value.replace(/[^\d.,]/g, ""));
                setEscolhido(null);
              }}
              className="w-full bg-transparent py-3 text-sm outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={apoiar}
          disabled={indo || valorCentavos < 200}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {indo ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
          {indo ? "Abrindo o Pix" : `Apoiar com ${reais(Math.max(valorCentavos, 0))}`}
        </button>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pagamento por Pix, na hora. Você sai daqui pro checkout e volta em
          seguida.
        </p>
      </div>

      {meus.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium">Seus apoios</p>
          <ul className="mt-3 space-y-2">
            {meus.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-500" />
                  {reais(a.valorCentavos)}
                </span>
                <span className="text-xs text-muted-foreground">{quando(a.pagoEm)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Obrigado, de verdade.</p>
        </div>
      )}

      {admin && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Quem apoiou (admin)</p>
            <span className="text-sm font-semibold text-emerald-500">{reais(total)}</span>
          </div>
          {todos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Ninguém apoiou ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {todos.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{a.apoiador?.nome}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.apoiador?.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">{reais(a.valorCentavos)}</span>
                    <span className="block text-xs text-muted-foreground">{quando(a.pagoEm)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {obrigado && <ModalObrigado onFechar={() => setObrigado(false)} />}
    </div>
  );
}

/** O agradecimento depois do pagamento, com o canal direto pra dar opinião. */
function ModalObrigado({ onFechar }: { onFechar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted"
        >
          <X className="size-4" />
        </button>

        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Heart className="size-7 text-primary" />
        </div>

        <h2 className="mt-4 text-lg font-semibold tracking-tight">Obrigado pelo apoio!</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sério mesmo, muito obrigado. É apoio assim que mantém o Viraliza de pé
          e faz ferramenta nova aparecer aqui dentro.
        </p>

        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-left">
          <p className="text-sm font-medium">Quer dar uma opinião?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Me chama no WhatsApp e fala o que você achou, o que está faltando ou
            o que te incomoda. Eu leio tudo, é o meu número mesmo.
          </p>
          <a
            href={`https://wa.me/${ZAP}?text=${encodeURIComponent("Oi Lucas! Acabei de apoiar o Viraliza e queria falar uma coisa:")}`}
            target="_blank"
            rel="noopener"
            className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <MessageCircle className="size-4" />
            {ZAP_BONITO}
          </a>
        </div>

        <button
          type="button"
          onClick={onFechar}
          className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
