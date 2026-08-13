"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { BarraEnvio, BolhaMensagem, type ChatMsg } from "@/components/app/chat-ui";

/**
 * Painel da conversa do USUÁRIO com a equipe. Responde com texto ou áudio.
 *
 * É só o PAINEL: quem tem o botão flutuante é a boia única (`chat-boia.tsx`), e
 * é ela também que descobre se esta conversa existe (só o admin abre) e conta as
 * não lidas, no poll do resumo. Aqui só é montado quando a caixa está aberta —
 * por isso o poll de 5s pode ser incondicional.
 */
export function ChatEquipe({ onFechar }: { onFechar: () => void }) {
  const [mensagens, setMensagens] = useState<ChatMsg[]>([]);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/chat?ler=1", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { mensagens?: ChatMsg[] };
      if (d.mensagens) setMensagens(d.mensagens);
    } catch {
      /* poll seguinte resolve */
    }
  }, []);

  // aberta (= montada): carrega e fica atualizando a cada 5s.
  // O lint acha que isto é setState síncrono no efeito, mas `carregar` é async e
  // só mexe no estado DEPOIS do await do fetch - nunca na mesma passada.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    const id = setInterval(carregar, 5_000);
    return () => clearInterval(id);
  }, [carregar]);

  // rola pro fim quando chega mensagem
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens.length]);

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

  return (
    // mesma âncora do painel do robô (`bottom-28`, `sm:bottom-36`): só um dos
    // dois fica aberto por vez, então eles podem — e devem — ocupar o mesmo lugar
    <div className="fixed bottom-28 right-6 z-[60] flex h-[26rem] max-h-[calc(100vh-9rem)] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:bottom-36 sm:right-20 sm:max-h-[calc(100vh-11rem)]">
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
          onClick={onFechar}
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
  );
}
