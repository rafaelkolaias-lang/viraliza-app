"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

/** Botão de excluir um job (vídeo/cortes), com confirmação inline. */
export function ExcluirVideo({ id }: { id: string }) {
  const router = useRouter();
  const [excluindo, setExcluindo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  async function excluir() {
    setExcluindo(true);
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Não consegui excluir. Tente de novo.");
        return;
      }
      toast.success("Excluído.");
      router.refresh();
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setExcluindo(false);
    }
  }

  if (confirmar) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={excluir}
          disabled={excluindo}
          className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/25"
        >
          {excluindo ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          Excluir
        </button>
        <button
          type="button"
          onClick={() => setConfirmar(false)}
          disabled={excluindo}
          aria-label="Cancelar"
          className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmar(true)}
      aria-label="Excluir"
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
