"use client";

import { useState } from "react";
import {
  Clock,
  Mic,
  MicOff,
  MessageSquare,
  Sparkles,
  Loader2,
  Eraser,
  TriangleAlert,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DURACOES_LAB,
  TONS_LAB,
  VOZES_LAB,
  TONALIDADES_LAB,
  duracaoPorChave,
  limitePalavras,
  dicaDoTake,
} from "@/lib/lab-video";

/**
 * Etapa "Gerar vídeo" do Lab: duração (que define quantos TAKES), voz, tom e a
 * fala de cada take. Regras da casa: 6s é SEMPRE sem fala; a partir de 30s o
 * vídeo é montado em takes de 15s que precisam emendar um no outro.
 */

export type ConfigVideoLab = {
  duracao: string;
  tom: string;
  voz: string;
  tonalidade: string;
  falas: string[];
  instrucoes: string;
  movimento: string | null;
};

function contarPalavras(t: string) {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

/** Pílula de escolha (usada em tom, voz e tonalidade). */
function Pilula({
  ativo,
  titulo,
  desc,
  onClick,
}: {
  ativo: boolean;
  titulo: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-all",
        ativo
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border/60 hover:border-primary/40 hover:bg-card",
      )}
    >
      <p className={cn("text-sm font-medium", ativo && "text-primary")}>{titulo}</p>
      {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
    </button>
  );
}

export function LabVideo({
  config,
  onMudar,
  produtoNome,
}: {
  config: ConfigVideoLab;
  onMudar: (c: ConfigVideoLab) => void;
  produtoNome?: string;
}) {
  const [escrevendo, setEscrevendo] = useState(false);
  const dur = duracaoPorChave(config.duracao);
  const comFala = !!dur?.comFala;
  const takes = dur?.takes ?? 1;
  const limite = limitePalavras(dur?.segundos ?? 15);

  function set<K extends keyof ConfigVideoLab>(campo: K, valor: ConfigVideoLab[K]) {
    onMudar({ ...config, [campo]: valor });
  }

  function mudarFala(i: number, texto: string) {
    const falas = [...config.falas];
    falas[i] = texto;
    onMudar({ ...config, falas });
  }

  /** Pede pra IA escrever as falas dos takes (de graça, sem crédito). */
  async function preencherComIA() {
    if (!dur) return;
    setEscrevendo(true);
    try {
      const r = await fetch("/api/lab/falas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produto: produtoNome ?? "",
          takes,
          segundos: dur.segundos,
          tom: config.tom,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui escrever agora.");
      onMudar({ ...config, falas: (d.falas as string[]).slice(0, takes) });
      toast.success("Falas prontas! Pode ajustar do seu jeito.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui escrever agora.");
    } finally {
      setEscrevendo(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* DURAÇÃO */}
      <div className="space-y-2.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-4 text-primary" />
          Duração do vídeo
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {DURACOES_LAB.map((d) => {
            const ativo = config.duracao === d.chave;
            return (
              <button
                key={d.chave}
                type="button"
                onClick={() => {
                  const falas = Array.from({ length: d.takes }, (_, i) => config.falas[i] ?? "");
                  onMudar({ ...config, duracao: d.chave, falas });
                }}
                aria-pressed={ativo}
                className={cn(
                  "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                  ativo
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border/60 hover:border-primary/40 hover:bg-card",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn("text-lg font-bold", ativo && "text-primary")}>
                    {d.total}s
                  </span>
                  {d.comFala ? (
                    <Mic className="size-3.5 text-muted-foreground" />
                  ) : (
                    <MicOff className="size-3.5 text-muted-foreground" />
                  )}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {d.takes > 1 ? `${d.takes} takes de 15s` : d.comFala ? "com fala" : "sem fala"}
                </span>
              </button>
            );
          })}
        </div>
        {dur && (
          <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {dur.nota}
            {dur.takes > 1 &&
              " Os takes são gravados na mesma cena e emendam um no outro, como se fosse um vídeo só."}
          </p>
        )}
      </div>

      {!comFala ? (
        <div className="flex gap-2.5 rounded-xl border border-border/60 bg-card/50 p-3 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
          <MicOff className="mt-0.5 size-4 shrink-0" />
          <p>
            O vídeo de 6 segundos sai <strong>sem fala</strong>, só com o movimento do
            produto. Fica limpo pra usar como capa ou anúncio, e você pode colocar
            música e legenda depois no editor.
          </p>
        </div>
      ) : (
        <>
          {/* TOM */}
          <div className="space-y-2.5">
            <p className="text-sm font-medium">Tom da fala</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {TONS_LAB.map((t) => (
                <Pilula
                  key={t.chave}
                  ativo={config.tom === t.chave}
                  titulo={t.label}
                  desc={t.desc}
                  onClick={() => set("tom", t.chave)}
                />
              ))}
            </div>
          </div>

          {/* VOZ */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2.5">
              <p className="text-sm font-medium">Tipo de voz</p>
              <div className="grid grid-cols-2 gap-2.5">
                {VOZES_LAB.map((v) => (
                  <Pilula
                    key={v.chave}
                    ativo={config.voz === v.chave}
                    titulo={v.label}
                    onClick={() => set("voz", v.chave)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2.5">
              <p className="text-sm font-medium">Tonalidade</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {TONALIDADES_LAB.map((t) => (
                  <Pilula
                    key={t.chave}
                    ativo={config.tonalidade === t.chave}
                    titulo={t.label}
                    onClick={() => set("tonalidade", t.chave)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* FALAS */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="size-4 text-primary" />
                Fala do influenciador
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                  Opcional
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={preencherComIA}
                  disabled={escrevendo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                >
                  {escrevendo ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Escrever com IA
                </button>
                {config.falas.some((f) => f?.trim()) && (
                  <button
                    type="button"
                    onClick={() => set("falas", Array.from({ length: takes }, () => ""))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Eraser className="size-3.5" />
                    Limpar
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe em branco e a IA improvisa na hora (costuma soar mais natural).
              Limite de {limite} palavras por take de {dur?.segundos}s.
            </p>

            <div className="space-y-3">
              {Array.from({ length: takes }, (_, i) => {
                const texto = config.falas[i] ?? "";
                const n = contarPalavras(texto);
                const passou = n > limite;
                const dica = dicaDoTake(i, takes);
                const ini = i * (dur?.segundos ?? 15);
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-xs font-medium">
                        <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        {takes > 1
                          ? `Take ${i + 1} (${ini}s - ${ini + (dur?.segundos ?? 15)}s)`
                          : "O que ela fala"}
                        <span className="text-muted-foreground">
                          · {dica.titulo}: {dica.resumo}
                        </span>
                      </p>
                      <span
                        className={cn(
                          "text-[11px] tabular-nums",
                          passou ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {n}/{limite} palavras
                      </span>
                    </div>
                    <textarea
                      value={texto}
                      onChange={(e) => mudarFala(i, e.target.value.slice(0, 400))}
                      rows={2}
                      placeholder={`Ex: ${dica.exemplo}`}
                      className={cn(
                        "w-full resize-y rounded-xl border bg-background p-3 text-sm outline-none transition-colors",
                        passou
                          ? "border-destructive focus:border-destructive"
                          : "border-border focus:border-primary/60",
                      )}
                    />
                    {passou && (
                      <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                        <TriangleAlert className="size-3.5" />
                        Tire {n - limite} palavra{n - limite > 1 ? "s" : ""} pra caber em{" "}
                        {dur?.segundos} segundos sem atropelar.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {takes > 1 && (
              <p className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                Os takes emendam sozinhos: o primeiro termina em aberto e o seguinte já
                começa falando, sem cumprimentar de novo.
              </p>
            )}
          </div>
        </>
      )}

      {/* INSTRUÇÕES LIVRES */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Quer pedir algo específico?{" "}
          <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
        </p>
        <textarea
          value={config.instrucoes}
          onChange={(e) => set("instrucoes", e.target.value.slice(0, 300))}
          rows={2}
          placeholder="Ex: mostrar o produto bem de perto no fim, abrir a embalagem, apontar pro detalhe do zíper"
          className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary/60"
        />
      </div>
    </div>
  );
}
