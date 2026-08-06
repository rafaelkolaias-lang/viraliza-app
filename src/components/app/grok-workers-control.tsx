"use client";

import { useEffect, useState } from "react";
import { Bot, RefreshCw, Power, Monitor, CheckCircle2, Play, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";

type Worker = {
  name: string;
  vnc_url: string;
  status: "idle" | "gerando" | "offline";
  ativo: boolean;
  last_heartbeat?: number;
};

export function GrokWorkersControl() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [alterando, setAlterando] = useState<string | null>(null);

  async function carregar() {
    try {
      const res = await fetch("/api/admin/grok-workers", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Falha ao carregar a lista de robôs.");
      }
      const data = await res.json();
      setWorkers(data.workers || []);
      setErro(null);
    } catch (e: any) {
      setErro(e.message || "Erro de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, 5000);
    return () => clearInterval(id);
  }, []);

  async function toggleWorker(name: string, atualAtivo: boolean) {
    if (alterando) return;
    setAlterando(name);
    try {
      const res = await fetch("/api/admin/grok-workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ativo: !atualAtivo }),
      });
      if (!res.ok) {
        throw new Error("Erro ao alterar o estado do robô.");
      }
      // recarrega a lista
      await carregar();
    } catch (e: any) {
      alert(e.message || "Erro ao atualizar.");
    } finally {
      setAlterando(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Bot className="size-4" /> Robôs do Grok (Geração de Vídeo)
        </h2>
        <button
          onClick={() => {
            setCarregando(true);
            carregar();
          }}
          disabled={carregando}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3", carregando && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
          <AlertOctagon className="size-4 shrink-0 mt-0.5" />
          <p>{erro}</p>
        </div>
      )}

      {carregando && workers.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          <RefreshCw className="size-6 animate-spin text-muted-foreground/70" />
          <p className="mt-2">Consultando os robôs...</p>
        </div>
      ) : workers.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-center">
          <Bot className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nenhum robô registrado no Master</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Os workers precisam estar rodando e enviando heartbeat para aparecer aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workers.map((w) => {
            const isOnline = w.status !== "offline";
            const isGenerating = w.status === "gerando";
            
            return (
              <div
                key={w.name}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-all duration-300 relative overflow-hidden flex flex-col justify-between",
                  w.ativo && isOnline ? "border-border" : "border-muted/60 opacity-75"
                )}
              >
                {/* Linha de status no topo */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm tracking-tight">{w.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-2 rounded-full inline-block",
                          isGenerating
                            ? "bg-amber-500 animate-pulse"
                            : isOnline
                              ? "bg-green-500"
                              : "bg-muted-foreground/40"
                        )}
                      />
                      {isGenerating ? "Gerando vídeo" : isOnline ? "Disponível" : "Offline"}
                    </p>
                  </div>

                  {/* Toggle Ativo/Inativo */}
                  {isOnline && (
                    <button
                      onClick={() => toggleWorker(w.name, w.ativo)}
                      disabled={alterando === w.name}
                      title={w.ativo ? "Pausar geração neste robô" : "Ativar geração neste robô"}
                      className={cn(
                        "rounded-lg p-1.5 transition-colors border",
                        w.ativo
                          ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                          : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
                      )}
                    >
                      <Power className="size-4" />
                    </button>
                  )}
                </div>

                {/* Ações e links na parte inferior */}
                <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3 gap-2">
                  {/* Link VNC */}
                  {isOnline && w.vnc_url ? (
                    <a
                      href={w.vnc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                    >
                      <Monitor className="size-3.5" />
                      Assistir Tela (VNC)
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Monitor className="size-3.5 opacity-50" />
                      Tela indisponível
                    </span>
                  )}

                  {/* Badges extras de estado */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      w.ativo && isOnline
                        ? "bg-green-500/15 text-green-400"
                        : "bg-destructive/15 text-destructive"
                    )}
                  >
                    {w.ativo && isOnline ? "Fila ON" : "Fila OFF"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
