"use client";

import { useState } from "react";
import {
  Lightbulb,
  Sparkles,
  AlertTriangle,
  Send,
  Loader2,
  Check,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SugestaoItem } from "@/lib/sugestoes";

/**
 * Aba "Sugestões e melhorias". Usuário: manda e vê só as dele. Admin: vê TODAS
 * (com quem mandou) e marca o status (nova/lida/resolvida).
 */

const TIPOS = [
  { chave: "sugestao", label: "Sugestão", Icon: Lightbulb, cor: "text-amber-500" },
  { chave: "melhoria", label: "Melhoria", Icon: Sparkles, cor: "text-primary" },
  { chave: "problema", label: "Problema", Icon: AlertTriangle, cor: "text-red-500" },
] as const;

const STATUS: Record<string, { label: string; cls: string }> = {
  nova: { label: "Nova", cls: "border-primary/40 bg-primary/10 text-primary" },
  lida: { label: "Lida", cls: "border-border bg-muted text-muted-foreground" },
  resolvida: { label: "Resolvida", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" },
};

function tipoDe(chave: string) {
  return TIPOS.find((t) => t.chave === chave) ?? TIPOS[0];
}

function quando(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function SugestoesPainel({
  admin,
  inicial,
}: {
  admin: boolean;
  inicial: SugestaoItem[];
}) {
  const [lista, setLista] = useState<SugestaoItem[]>(inicial);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<string>("sugestao");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (texto.trim().length < 3) {
      toast.info("Escreva sua sugestão. 🙂");
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/sugestoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, tipo }),
      });
      const data = (await r.json().catch(() => ({}))) as { erro?: string; sugestao?: SugestaoItem };
      if (!r.ok || !data.sugestao) {
        toast.error(data.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      setLista((prev) => [data.sugestao!, ...prev]);
      setTexto("");
      toast.success("Obrigado! Sua sugestão foi enviada. 💚");
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function marcar(id: string, status: string) {
    setLista((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    try {
      await fetch("/api/sugestoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
    } catch {
      toast.error("Não consegui salvar o status.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      {/* ===== HERÓI ===== */}
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-primary/12 via-card to-background p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <MessageSquarePlus className="size-3.5" />
            Sugestões e melhorias
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            {admin ? (
              <>O que os usuários estão pedindo</>
            ) : (
              <>
                Ajude a{" "}
                <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
                  melhorar a plataforma
                </span>
              </>
            )}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {admin
              ? "Tudo que os usuários mandaram. Marque como lida ou resolvida conforme for cuidando."
              : "Manda sua ideia, o que falta ou um problema que achou. A gente lê tudo. 💚"}
          </p>
        </div>
      </div>

      {/* ===== FORM (todos podem mandar) ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => {
            const ativo = tipo === t.chave;
            return (
              <button
                key={t.chave}
                type="button"
                onClick={() => setTipo(t.chave)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
                  ativo
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                <t.Icon className={cn("size-3.5", ativo ? "" : t.cor)} />
                {t.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Escreva aqui sua sugestão, melhoria ou problema..."
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{texto.length}/2000</span>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar
          </button>
        </div>
      </div>

      {/* ===== LISTA ===== */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">
          {admin ? `Todas as sugestões (${lista.length})` : "Suas sugestões"}
        </h2>

        {lista.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Lightbulb className="size-6" />
            </span>
            <p className="font-medium">
              {admin ? "Ninguém mandou sugestão ainda" : "Você ainda não mandou nenhuma"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {admin
                ? "Quando os usuários mandarem, aparece aqui."
                : "Manda a primeira ali em cima. Toda ideia ajuda. 💡"}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {lista.map((s) => {
              const t = tipoDe(s.tipo);
              const st = STATUS[s.status] ?? STATUS.nova;
              return (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", t.cor)}>
                      <t.Icon className="size-3.5" />
                      {t.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", st.cls)}>
                        {st.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{quando(s.criadoEm)}</span>
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{s.texto}</p>

                  {admin && s.autor && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      por <span className="font-medium text-foreground">{s.autor.nome}</span> · {s.autor.email}
                    </p>
                  )}

                  {admin && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <BotaoStatus
                        ativo={s.status === "lida"}
                        onClick={() => marcar(s.id, "lida")}
                        label="Marcar lida"
                      />
                      <BotaoStatus
                        ativo={s.status === "resolvida"}
                        onClick={() => marcar(s.id, "resolvida")}
                        label="Resolvida"
                        verde
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BotaoStatus({
  ativo,
  onClick,
  label,
  verde,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
  verde?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
        ativo
          ? verde
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
            : "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {ativo && <Check className="size-3.5" strokeWidth={3} />}
      {label}
    </button>
  );
}
