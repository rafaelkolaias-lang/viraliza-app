"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, X, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PedidoBonusIg } from "@/lib/bonus-instagram";

const BADGE: Record<string, { txt: string; cls: string }> = {
  pendente: { txt: "Pendente", cls: "bg-amber-500/15 text-amber-500" },
  aprovado: { txt: "Aprovado", cls: "bg-emerald-500/15 text-emerald-500" },
  recusado: { txt: "Recusado", cls: "bg-red-500/15 text-red-500" },
};

export function AdminBonusInstagram({ pedidos }: { pedidos: PedidoBonusIg[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function decidir(id: string, acao: "aprovar" | "recusar") {
    setOcupado(id + acao);
    try {
      const r = await fetch("/api/admin/bonus-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao }),
      });
      if (r.ok) router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  if (pedidos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nenhum pedido de bônus por enquanto.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Usuário</th>
            <th className="px-4 py-3 font-medium">Instagram</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 text-right font-medium">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pedidos.map((p) => {
            const badge = BADGE[p.status] ?? BADGE.pendente;
            return (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`https://www.instagram.com/${p.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Camera className="size-3.5" />@{p.instagram}
                    <ExternalLink className="size-3" />
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}
                  >
                    {badge.txt}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.status === "pendente" ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => decidir(p.id, "aprovar")}
                        disabled={!!ocupado}
                      >
                        {ocupado === p.id + "aprovar" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decidir(p.id, "recusar")}
                        disabled={!!ocupado}
                      >
                        {ocupado === p.id + "recusar" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <X className="size-4" />
                        )}
                        Recusar
                      </Button>
                    </div>
                  ) : (
                    <p className="text-right text-xs text-muted-foreground">
                      {p.status === "aprovado" ? "300 créditos liberados" : "sem crédito"}
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
