"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, AlertTriangle, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notificacao {
  id: string;
  tipo: "video_pronto" | "video_erro" | "admin";
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  criadoEm: string;
}

const POLL_MS = 15000;

function tempoRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function IconeTipo({ tipo }: { tipo: Notificacao["tipo"] }) {
  if (tipo === "video_pronto")
    return <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />;
  if (tipo === "video_erro")
    return <AlertTriangle className="size-5 shrink-0 text-destructive" />;
  return <Megaphone className="size-5 shrink-0 text-primary" />;
}

export function NotificacoesSino() {
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/notificacoes", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { itens: Notificacao[]; naoLidas: number };
      setItens(data.itens ?? []);
      setNaoLidas(data.naoLidas ?? 0);
    } catch {
      /* sem rede - tenta no próximo ciclo */
    }
  }, []);

  // busca inicial + polling
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);
    return () => clearInterval(t);
  }, [carregar]);

  // fecha ao clicar fora ou apertar ESC
  useEffect(() => {
    if (!aberto) return;
    const onClick = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  async function abrir() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir) {
      carregar();
      if (naoLidas > 0) {
        // zera o contador na hora (otimista) e marca no servidor
        setNaoLidas(0);
        setItens((xs) => xs.map((x) => ({ ...x, lida: true })));
        try {
          await fetch("/api/notificacoes/lidas", { method: "POST" });
        } catch {
          /* se falhar, o próximo poll corrige */
        }
      }
    }
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-label={naoLidas > 0 ? `${naoLidas} notificação(ões) nova(s)` : "Notificações"}
        aria-expanded={aberto}
        className="relative grid size-10 place-items-center rounded-lg text-foreground transition-colors hover:bg-muted active:bg-muted"
      >
        <Bell className="size-5.5" />
        {naoLidas > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl md:left-0 md:right-auto"
          role="dialog"
          aria-label="Notificações"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Notificações</p>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {itens.length === 0 ? (
              <div className="grid place-items-center px-4 py-10 text-center">
                <Bell className="size-7 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Tudo em dia</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Você não tem notificações por enquanto.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {itens.map((n) => {
                  const conteudo = (
                    <div className="flex gap-3 px-4 py-3">
                      <IconeTipo tipo={n.tipo} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{n.titulo}</p>
                        {n.mensagem && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {n.mensagem}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {tempoRelativo(n.criadoEm)}
                        </p>
                      </div>
                    </div>
                  );
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "transition-colors hover:bg-accent/60",
                        !n.lida && "bg-primary/[0.06]",
                      )}
                    >
                      {n.link ? (
                        <Link href={n.link} onClick={() => setAberto(false)} className="block">
                          {conteudo}
                        </Link>
                      ) : (
                        conteudo
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
