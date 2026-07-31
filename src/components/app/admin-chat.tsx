"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle, Search, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BarraEnvio, BolhaMensagem, type ChatMsg } from "@/components/app/chat-ui";

type Conversa = {
  userId: string;
  nome: string;
  email: string;
  previa: string;
  quando: string;
  naoLidas: number;
};
type Pessoa = { id: string; nome: string; email: string };

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Central de chat do ADMIN: lista as conversas, busca qualquer pessoa pra
 * iniciar uma nova e conversa por texto ou áudio. Poll: lista 15s, thread 5s.
 */
export function AdminChat() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [busca, setBusca] = useState("");
  const [achadas, setAchadas] = useState<Pessoa[]>([]);
  const [ativa, setAtiva] = useState<Pessoa | null>(null);
  const [mensagens, setMensagens] = useState<ChatMsg[]>([]);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregarLista = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/chat", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { conversas?: Conversa[] };
      if (d.conversas) setConversas(d.conversas);
    } catch {
      /* poll seguinte resolve */
    }
  }, []);

  useEffect(() => {
    carregarLista();
    const id = setInterval(carregarLista, 15_000);
    return () => clearInterval(id);
  }, [carregarLista]);

  // busca de pessoas (debounce simples)
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setAchadas([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/chat?buscar=${encodeURIComponent(termo)}`, {
          cache: "no-store",
        });
        const d = (await r.json().catch(() => ({}))) as { pessoas?: Pessoa[] };
        setAchadas(d.pessoas ?? []);
      } catch {
        /* nada */
      }
    }, 350);
    return () => clearTimeout(id);
  }, [busca]);

  const carregarThread = useCallback(async (userId: string) => {
    try {
      const r = await fetch(`/api/admin/chat?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const d = (await r.json()) as { pessoa?: Pessoa; mensagens?: ChatMsg[] };
      if (d.mensagens) setMensagens(d.mensagens);
    } catch {
      /* poll seguinte resolve */
    }
  }, []);

  useEffect(() => {
    if (!ativa) return;
    setMensagens([]);
    carregarThread(ativa.id);
    const id = setInterval(() => carregarThread(ativa.id), 5_000);
    return () => clearInterval(id);
  }, [ativa, carregarThread]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  function abrir(p: Pessoa) {
    setAtiva(p);
    setBusca("");
    setAchadas([]);
  }

  async function enviar(dados: { texto?: string; audio?: string }) {
    if (!ativa) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ativa.id, ...dados }),
      });
      const d = (await r.json().catch(() => ({}))) as { erro?: string; mensagem?: ChatMsg };
      if (!r.ok || !d.mensagem) {
        toast.error(d.erro ?? "Não consegui enviar.");
        return;
      }
      setMensagens((prev) => [...prev, d.mensagem!]);
      carregarLista();
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // ===== thread aberta =====
  if (ativa) {
    return (
      <div className="flex h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => {
              setAtiva(null);
              carregarLista();
            }}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">{ativa.nome}</p>
            <p className="truncate text-[11px] text-muted-foreground">{ativa.email}</p>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {mensagens.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Mande a primeira mensagem: a caixinha aparece pra pessoa na hora.
            </p>
          )}
          {mensagens.map((m) => (
            <BolhaMensagem key={m.id} msg={m} minha={m.autor === "admin"} />
          ))}
          <div ref={fimRef} />
        </div>
        <BarraEnvio onEnviar={enviar} enviando={enviando} />
      </div>
    );
  }

  // ===== lista + busca =====
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pessoa por nome ou email pra iniciar conversa..."
            className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        {achadas.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            {achadas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => abrir(p)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <UserRoundPlus className="size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.nome || p.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {conversas.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
          <MessageCircle className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhuma conversa ainda</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Busque uma pessoa acima e mande a primeira mensagem: a caixinha aparece
            pra ela no painel na hora.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversas.map((c) => (
            <button
              key={c.userId}
              type="button"
              onClick={() => abrir({ id: c.userId, nome: c.nome, email: c.email })}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors hover:border-primary/50",
                c.naoLidas > 0 ? "border-primary/40" : "border-border",
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {(c.nome || c.email).slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{c.nome}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {fmtData.format(new Date(c.quando))}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{c.previa}</span>
                  {c.naoLidas > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">
                      {c.naoLidas > 9 ? "9+" : c.naoLidas}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
