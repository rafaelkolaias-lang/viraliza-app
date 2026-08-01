"use client";

import { useState } from "react";
import { Sparkles, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LIMITE_PALAVRAS,
  ROTULOS_BATIDA,
  contarPalavras,
  type HistorinhaPropria,
  type FrutaPersonagem,
} from "@/lib/viral-boost";

/**
 * Editor da historinha ESCRITA PELA PESSOA. Três batidas (abertura, clímax e
 * chamada) com contador de palavras, porque o vídeo tem 10 segundos e a soma das
 * falas precisa caber em ~34 palavras.
 *
 * O botão do assistente é o atalho: ela conta a ideia numa frase e a IA devolve
 * as três batidas já dentro do orçamento e nas regras que funcionam (abrir no
 * meio da ação, clímax que só serve pra aquele personagem, chamada barata).
 */
export function BoostHistorinhaPropria({
  formato,
  personagens,
  valor,
  onMudar,
}: {
  formato: string;
  personagens: FrutaPersonagem[];
  valor: HistorinhaPropria;
  onMudar: (h: HistorinhaPropria) => void;
}) {
  const [ideia, setIdeia] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);

  const palavras = valor.batidas.reduce((s, b) => s + contarPalavras(b.fala), 0);
  const passou = palavras > LIMITE_PALAVRAS;

  function mudarBatida(i: number, campo: "acao" | "fala", texto: string) {
    const batidas = valor.batidas.map((b, idx) => (idx === i ? { ...b, [campo]: texto } : b));
    onMudar({ ...valor, batidas });
  }

  async function escreverComIA() {
    if (ideia.trim().length < 5) {
      toast.error("Conte em uma frase o que acontece.");
      return;
    }
    setEscrevendo(true);
    try {
      const r = await fetch("/api/boost/roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideia,
          formato,
          personagens: personagens.map((p) => ({ nome: p.nome, jeito: p.jeito })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui escrever agora.");
      onMudar(d.roteiro as HistorinhaPropria);
      toast.success("Roteiro pronto! Ajuste o que quiser.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui escrever agora.");
    } finally {
      setEscrevendo(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Conte a ideia e a IA escreve pra você</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={ideia}
            onChange={(e) => setIdeia(e.target.value.slice(0, 200))}
            placeholder="Ex: ela descobre que foi trocada pela fruta mais nova do mercado"
            className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
          />
          <button
            type="button"
            onClick={escreverComIA}
            disabled={escrevendo}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {escrevendo ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Escrever com IA
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          De graça, não gasta crédito. Depois é só ajustar o texto do seu jeito.
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <input
          value={valor.nome}
          onChange={(e) => onMudar({ ...valor, nome: e.target.value.slice(0, 60) })}
          placeholder="Nome da historinha"
          className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
        />
        <input
          value={valor.tom}
          onChange={(e) => onMudar({ ...valor, tom: e.target.value.slice(0, 80) })}
          placeholder="Tom (ex: tragicômico, drama exagerado)"
          className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
        />
      </div>

      <div className="space-y-3">
        {valor.batidas.map((b, i) => (
          <div key={i} className="space-y-1.5 rounded-xl border border-border/60 bg-background/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              {b.rotulo || ROTULOS_BATIDA[i]}
              <span className="ml-2 font-normal normal-case text-muted-foreground">
                {i === 0
                  ? "comece no meio da ação, sem apresentação"
                  : i === 1
                    ? "a frase que só funciona com esse personagem"
                    : "peça a coisa mais barata: marcar alguém ou deixar no gancho"}
              </span>
            </p>
            <input
              value={b.acao}
              onChange={(e) => mudarBatida(i, "acao", e.target.value.slice(0, 200))}
              placeholder="O que acontece na cena"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/60"
            />
            <textarea
              value={b.fala}
              onChange={(e) => mudarBatida(i, "fala", e.target.value.slice(0, 160))}
              rows={2}
              placeholder="A fala, exatamente como vai ser dita"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
          </div>
        ))}
      </div>

      <p
        className={cn(
          "flex items-center gap-1.5 text-xs",
          passou ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {passou && <TriangleAlert className="size-3.5" />}
        {palavras} de {LIMITE_PALAVRAS} palavras no total
        {passou ? ", corte um pouco pra caber nos 15 segundos" : ""}
      </p>
    </div>
  );
}
