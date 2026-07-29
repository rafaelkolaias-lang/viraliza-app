"use client";

import { useState } from "react";
import { Flag, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * "Reportar problema" de um vídeo gerado: abre um campo pra pessoa contar o que
 * deu errado e manda pro admin analisar (possível reembolso dos créditos).
 */
export function ReportarProblema({ jobId }: { jobId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (motivo.trim().length < 5 || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, motivo: motivo.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.erro || "Não consegui enviar. Tente de novo.");
        return;
      }
      toast.success("Reporte enviado! Vamos analisar e te avisamos. 💚");
      setEnviado(true);
      setAberto(false);
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Flag className="size-3.5" />
        Problema reportado
      </span>
    );
  }

  if (!aberto) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setAberto(true)}>
        <Flag className="size-4" />
        Reportar problema
      </Button>
    );
  }

  return (
    <div className="flex w-full items-start gap-2 rounded-xl border border-border bg-background p-2">
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="O que deu errado nesse vídeo?"
        maxLength={2000}
        rows={2}
        autoFocus
        className="min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={enviar}
          disabled={motivo.trim().length < 5 || enviando}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {enviando ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          Enviar
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          disabled={enviando}
          className="inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
        >
          <X className="size-3" />
          Fechar
        </button>
      </div>
    </div>
  );
}
