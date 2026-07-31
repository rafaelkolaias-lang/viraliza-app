"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { BarraEnvio, BolhaMensagem, type ChatMsg } from "@/components/app/chat-ui";

/**
 * Caixinha de conversa do USUÁRIO (flutuante, canto de baixo). Só aparece quando
 * o admin abriu uma conversa com a pessoa. Poll leve do resumo (badge) sempre, e
 * das mensagens quando aberta. Responde com texto ou áudio.
 */
export function ChatWidget() {
  const [existe, setExiste] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<ChatMsg[]>([]);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const abertoRef = useRef(false);
  abertoRef.current = aberto;

  // badge: existe conversa? não lidas? (a cada 30s; leve)
  useEffect(() => {
    let cancelado = false;
    async function resumo() {
      try {
        const r = await fetch("/api/chat?resumo=1", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { existe?: boolean; naoLidas?: number };
        if (cancelado) return;
        setExiste(!!d.existe);
        if (!abertoRef.current) setNaoLidas(d.naoLidas ?? 0);
      } catch {
        /* sem rede: tenta no próximo ciclo */
      }
    }
    resumo();
    const id = setInterval(resumo, 30_000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, []);

  const carregar = useCallback(async (marcarLidas: boolean) => {
    try {
      const r = await fetch(`/api/chat${marcarLidas ? "?ler=1" : ""}`, { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { mensagens?: ChatMsg[] };
      if (d.mensagens) setMensagens(d.mensagens);
      if (marcarLidas) setNaoLidas(0);
    } catch {
      /* poll seguinte resolve */
    }
  }, []);

  // aberta: carrega e fica atualizando a cada 5s
  useEffect(() => {
    if (!aberto) return;
    carregar(true);
    const id = setInterval(() => carregar(true), 5_000);
    return () => clearInterval(id);
  }, [aberto, carregar]);

  // rola pro fim quando chega mensagem
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens.length, aberto]);

  async function enviar(dados: { texto?: string; audio?: string }) {
    setEnviando(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const d = (await r.json().catch(() => ({}))) as { erro?: string; mensagem?: ChatMsg };
      if (!r.ok || !d.mensagem) {
        toast.error(d.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      setMensagens((prev) => [...prev, d.mensagem!]);
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!existe) return null;

  return (
    <>
      {/* caixinha */}
      {aberto && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[26rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-border bg-primary/10 px-3.5 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-primary">
              <MessageCircle className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Equipe Viraliza</p>
              <p className="text-[11px] text-muted-foreground">Responda por texto ou áudio</p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Fechar conversa"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {mensagens.map((m) => (
              <BolhaMensagem key={m.id} msg={m} minha={m.autor === "user"} />
            ))}
            <div ref={fimRef} />
          </div>

          <BarraEnvio onEnviar={enviar} enviando={enviando} />
        </div>
      )}

      {/* botão flutuante */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="fixed bottom-4 right-4 z-50 grid size-13 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105"
        aria-label={aberto ? "Fechar conversa" : "Abrir conversa"}
      >
        <MessageCircle className="size-6" />
        {naoLidas > 0 && !aberto && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>
    </>
  );
}
