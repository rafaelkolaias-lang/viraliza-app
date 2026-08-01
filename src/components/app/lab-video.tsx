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
  contarPalavrasFala,
  ESTRUTURA_FALA,
  EXEMPLO_FALA,
} from "@/lib/lab-video";

/**
 * Etapa "Gerar vídeo" do Lab: duração, voz, tom e a fala do influenciador.
 * Regras da casa: 6s é SEMPRE sem fala (capa/anúncio) e o vídeo mais longo é o de
 * 15s, que é o que o motor grava de uma vez só.
 */

export type ConfigVideoLab = {
  duracao: string;
  tom: string;
  voz: string;
  tonalidade: string;
  fala: string;
  instrucoes: string;
  movimento: string | null;
  /** true = a pessoa pediu o vídeo mudo mesmo numa duração que aceita fala */
  semFala?: boolean;
};

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
  // a duração aceita fala E a pessoa não pediu mudo
  const aceitaFala = !!dur?.comFala;
  const comFala = aceitaFala && !config.semFala;
  const limite = limitePalavras(dur?.segundos ?? 15);
  const palavras = contarPalavrasFala(config.fala);
  const passou = palavras > limite;

  function set<K extends keyof ConfigVideoLab>(campo: K, valor: ConfigVideoLab[K]) {
    onMudar({ ...config, [campo]: valor });
  }

  /** Pede pra IA escrever a fala do vídeo (de graça, sem crédito). */
  async function preencherComIA() {
    if (!dur) return;
    setEscrevendo(true);
    try {
      const r = await fetch("/api/lab/falas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produto: produtoNome ?? "",
          segundos: dur.segundos,
          tom: config.tom,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui escrever agora.");
      set("fala", d.fala as string);
      toast.success("Fala pronta! Pode ajustar do seu jeito.");
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
        <div className="grid grid-cols-3 gap-2.5">
          {DURACOES_LAB.map((d) => {
            const ativo = config.duracao === d.chave;
            return (
              <button
                key={d.chave}
                type="button"
                onClick={() => set("duracao", d.chave)}
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
                    {d.segundos}s
                  </span>
                  {d.comFala ? (
                    <Mic className="size-3.5 text-muted-foreground" />
                  ) : (
                    <MicOff className="size-3.5 text-muted-foreground" />
                  )}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {d.comFala ? "com fala" : "sem fala"}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    ativo ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {d.custo} créditos
                </span>
              </button>
            );
          })}
        </div>
        {dur && (
          <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {dur.nota} Cobramos os {dur.custo} créditos só quando o vídeo fica pronto.
          </p>
        )}
      </div>

      {/* nos 10s e 15s a pessoa escolhe: com fala ou mudo (o de 6s é sempre mudo) */}
      {aceitaFala && (
        <div className="space-y-2.5">
          <p className="text-sm font-medium">Áudio do vídeo</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Pilula
              ativo={!config.semFala}
              titulo="Com fala"
              desc="A pessoa fala em português"
              onClick={() => set("semFala", false)}
            />
            <Pilula
              ativo={!!config.semFala}
              titulo="Sem fala"
              desc="Vídeo mudo, só o movimento"
              onClick={() => set("semFala", true)}
            />
          </div>
        </div>
      )}

      {!comFala ? (
        <div className="flex gap-2.5 rounded-xl border border-border/60 bg-card/50 p-3 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
          <MicOff className="mt-0.5 size-4 shrink-0" />
          <p>
            {aceitaFala ? (
              <>
                Esse vídeo vai sair <strong>mudo</strong>, só com o movimento da cena.
                Dá pra colocar música e legenda depois no editor.
              </>
            ) : (
              <>
                O vídeo de 6 segundos sai <strong>sem fala</strong>, só com o movimento do
                produto. Fica limpo pra usar como capa ou anúncio, e você pode colocar
                música e legenda depois no editor.
              </>
            )}
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
                {config.fala.trim() && (
                  <button
                    type="button"
                    onClick={() => set("fala", "")}
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
              Limite de {limite} palavras pra caber nos {dur?.segundos}s.
            </p>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium">O que ela fala</p>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    passou ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {palavras}/{limite} palavras
                </span>
              </div>
              <textarea
                value={config.fala}
                onChange={(e) => set("fala", e.target.value.slice(0, 400))}
                rows={3}
                placeholder={`Ex: ${EXEMPLO_FALA}`}
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
                  Tire {palavras - limite} palavra{palavras - limite > 1 ? "s" : ""} pra caber
                  em {dur?.segundos} segundos sem atropelar.
                </p>
              )}
            </div>

            {/* a estrutura que vende, dentro do mesmo vídeo */}
            <div className="flex flex-wrap gap-2">
              {ESTRUTURA_FALA.map((e, i) => (
                <span
                  key={e.titulo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/50 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                >
                  <span className="grid size-4 place-items-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <strong className="font-semibold text-foreground">{e.titulo}</strong>
                  {e.resumo}
                </span>
              ))}
            </div>
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
