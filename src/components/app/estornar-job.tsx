"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

/** Botão do admin: estorna TODOS os créditos debitados num job (Diagnóstico). */
export function EstornarJob({ jobId, creditos }: { jobId: string; creditos: number }) {
  const router = useRouter();
  const [agindo, setAgindo] = useState(false);
  const [feito, setFeito] = useState(false);

  async function estornar() {
    if (agindo || feito) return;
    setAgindo(true);
    try {
      const r = await fetch("/api/admin/estorno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(data?.erro || "Não consegui estornar.");
        return;
      }
      toast.success(`Estornados ${data.creditos} créditos! 💚`);
      setFeito(true);
      router.refresh();
    } catch {
      toast.error("Sem conexão.");
    } finally {
      setAgindo(false);
    }
  }

  if (feito) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
        <Coins className="size-3.5" />
        Estornado
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={estornar}
      disabled={agindo}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
    >
      {agindo ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
      Estornar {creditos} créditos
    </button>
  );
}
