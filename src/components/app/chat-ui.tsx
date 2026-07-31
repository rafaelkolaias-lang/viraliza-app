"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, SendHorizontal, Square, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Peças compartilhadas do chat interno (usuário e admin): bolha de mensagem,
 * gravador de áudio (MediaRecorder do navegador) e a barra de envio.
 */

export type ChatMsg = {
  id: string;
  autor: "admin" | "user" | string;
  texto?: string | null;
  audioUrl?: string | null;
  criadoEm: string;
};

const fmtHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Uma mensagem do chat. `minha` = alinhada à direita (quem está olhando enviou). */
export function BolhaMensagem({ msg, minha }: { msg: ChatMsg; minha: boolean }) {
  return (
    <div className={cn("flex", minha ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2",
          minha
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted text-foreground",
        )}
      >
        {msg.texto && <p className="whitespace-pre-wrap break-words text-sm">{msg.texto}</p>}
        {msg.audioUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls preload="none" src={msg.audioUrl} className="mt-0.5 h-10 w-52 max-w-full" />
        )}
        <p
          className={cn(
            "mt-0.5 text-right text-[10px]",
            minha ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {fmtHora.format(new Date(msg.criadoEm))}
        </p>
      </div>
    </div>
  );
}

const MAX_SEG = 120; // ~2 min de áudio

/** Barra de envio: texto + botão de gravar áudio + enviar. */
export function BarraEnvio({
  onEnviar,
  enviando = false,
}: {
  // texto OU audio (data URL); quem usa faz o POST
  onEnviar: (dados: { texto?: string; audio?: string }) => Promise<void> | void;
  enviando?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelarRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        recRef.current?.stream.getTracks().forEach((t) => t.stop());
      } catch {
        /* já parado */
      }
    };
  }, []);

  async function comecarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      cancelarRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setGravando(false);
        setSegundos(0);
        if (cancelarRef.current || !chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const leitor = new FileReader();
        leitor.onload = () => {
          const dataUrl = String(leitor.result ?? "");
          if (dataUrl.startsWith("data:")) onEnviar({ audio: dataUrl });
        };
        leitor.readAsDataURL(blob);
      };
      rec.start();
      recRef.current = rec;
      setGravando(true);
      setSegundos(0);
      timerRef.current = setInterval(() => {
        setSegundos((s) => {
          if (s + 1 >= MAX_SEG) {
            try {
              recRef.current?.stop();
            } catch {
              /* já parou */
            }
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Não consegui acessar o microfone. Libere a permissão no navegador.");
    }
  }

  function pararEEnviar() {
    try {
      recRef.current?.stop();
    } catch {
      /* já parado */
    }
  }

  function cancelarGravacao() {
    cancelarRef.current = true;
    try {
      recRef.current?.stop();
    } catch {
      /* já parado */
    }
  }

  async function enviarTexto() {
    const t = texto.trim();
    if (!t || enviando) return;
    setTexto("");
    await onEnviar({ texto: t });
  }

  if (gravando) {
    return (
      <div className="flex items-center gap-2 border-t border-border p-2.5">
        <span className="flex items-center gap-2 text-sm font-medium text-red-500">
          <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
          Gravando {String(Math.floor(segundos / 60)).padStart(1, "0")}:
          {String(segundos % 60).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={cancelarGravacao}
          className="ml-auto grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
          aria-label="Cancelar gravação"
        >
          <X className="size-4" />
        </button>
        <button
          type="button"
          onClick={pararEEnviar}
          className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          aria-label="Parar e enviar áudio"
        >
          <Square className="size-4" fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5 border-t border-border p-2.5">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviarTexto();
          }
        }}
        placeholder="Escreva sua mensagem..."
        rows={1}
        maxLength={2000}
        className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {texto.trim() ? (
        <button
          type="button"
          onClick={enviarTexto}
          disabled={enviando}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
          aria-label="Enviar"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={comecarGravacao}
          disabled={enviando}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-60"
          aria-label="Gravar áudio"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
        </button>
      )}
    </div>
  );
}
