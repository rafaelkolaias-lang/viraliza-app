"use client";

import { useState } from "react";
import { Gift, Check, UserX, Loader2, Trophy, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { IndicacaoAdmin } from "@/lib/afiliados-admin";

/**
 * Admin do Indique e Ganhe: toda venda que veio de indicação, quem indicou,
 * se o indicado criou conta aqui e o botão pra soltar o bônus em créditos.
 *
 * O crédito não é automático de propósito: só faz sentido pagar quando a
 * indicação virou gente usando a plataforma, e isso o admin confere na hora.
 */

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AdminIndicacoes({
  indicacoes,
  bonusCentavos,
}: {
  indicacoes: IndicacaoAdmin[];
  bonusCentavos: number;
}) {
  const [lista, setLista] = useState(indicacoes);
  const [enviando, setEnviando] = useState<string | null>(null);

  const pagas = lista.filter((i) => i.status === "paid");
  const afiliados = new Set(pagas.map((i) => i.afiliadoEmail)).size;
  const comissaoTotal = pagas.reduce((s, i) => s + i.comissaoCentavos, 0);
  const aBonificar = pagas.filter((i) => i.cadastrou && !i.bonificado).length;

  async function bonificar(refId: string) {
    setEnviando(refId);
    try {
      const r = await fetch("/api/admin/indicacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui creditar.");
      setLista((atual) =>
        atual.map((i) => (i.refId === refId ? { ...i, bonificado: true } : i)),
      );
      toast.success("Créditos liberados pro afiliado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui creditar.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { Icone: Users, r: "Afiliados vendendo", v: String(afiliados) },
          { Icone: Trophy, r: "Vendas indicadas", v: String(pagas.length) },
          { Icone: Wallet, r: "Comissão paga", v: reais(comissaoTotal) },
          { Icone: Gift, r: "Bônus a liberar", v: String(aBonificar) },
        ].map((c) => (
          <div key={c.r} className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <c.Icone className="size-3.5" />
              {c.r}
            </p>
            <p className="mt-1 text-2xl font-bold">{c.v}</p>
          </div>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
          <p className="text-sm font-semibold">Nenhuma venda por indicação ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Quando um afiliado vender, a venda aparece aqui sozinha, com o e-mail de quem indicou.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Quando</th>
                <th className="px-4 py-3 font-medium">Quem indicou</th>
                <th className="px-4 py-3 font-medium">Quem comprou</th>
                <th className="px-4 py-3 text-right font-medium">Comissão</th>
                <th className="px-4 py-3 text-right font-medium">Bônus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lista.map((i) => {
                const perdida = i.status !== "paid";
                return (
                  <tr key={i.refId} className={cn(perdida && "opacity-50")}>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {i.quando
                        ? new Date(i.quando).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                      {perdida && <span className="block text-destructive">{i.status}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.afiliadoNome ?? i.afiliadoEmail}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.afiliadoUserId ? i.afiliadoEmail : `${i.afiliadoEmail} · sem conta aqui`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{i.compradorNome || i.compradorEmail}</p>
                      {i.cadastrou ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <Check className="size-3" />
                          cadastrou
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <UserX className="size-3" />
                          não criou conta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {reais(i.comissaoCentavos)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {i.bonificado ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                          <Check className="size-3.5" />
                          liberado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => bonificar(i.refId)}
                          disabled={
                            enviando === i.refId || perdida || !i.cadastrou || !i.afiliadoUserId
                          }
                          title={
                            !i.cadastrou
                              ? "O indicado ainda não criou conta"
                              : !i.afiliadoUserId
                                ? "O afiliado não tem conta na plataforma"
                                : `Dar ${bonusCentavos} créditos`
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {enviando === i.refId ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Gift className="size-3.5" />
                          )}
                          {bonusCentavos} créditos
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
