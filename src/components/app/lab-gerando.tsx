"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2,
  Download,
  RefreshCw,
  TriangleAlert,
  Check,
  Clapperboard,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn, linkBaixar } from "@/lib/utils";
import { duracaoPorChave } from "@/lib/lab-video";
import { custoVideoLab } from "@/lib/lab-custos";
import type { ConfigVideoLab } from "@/components/app/lab-video";

/**
 * Tela final do Lab: dispara a geração do vídeo, mostra o progresso enquanto a
 * IA grava (a espera é longa, de 3 a 5 minutos, então tem etapa, frase girando e
 * uma barra que anda sozinha) e entrega o vídeo pronto com download.
 *
 * A geração roda no servidor mesmo se a pessoa fechar a aba: o vídeo aparece em
 * Meus vídeos de qualquer jeito. Aqui a gente só acompanha pelo jobId.
 */

const FRASES = [
  "Mandando sua cena pro estúdio da IA...",
  "Travando o rosto e a roupa do influenciador...",
  "Ensaiando o movimento da câmera...",
  "Gravando a cena, take após take...",
  "Ajustando a voz e o ritmo da fala...",
  "Finalizando e salvando o seu vídeo...",
];

/** Tempo típico de uma geração, usado só pra barra andar de forma honesta. */
const ESTIMATIVA_SEG = 240;

export function LabGerando({
  config,
  imagem,
  produtoNome,
  onVoltar,
  onRefazer,
}: {
  config: ConfigVideoLab;
  imagem: string;
  produtoNome?: string;
  /** volta pro resumo (pra corrigir alguma coisa antes de tentar de novo) */
  onVoltar: () => void;
  /** recomeça o Lab do zero, com outro produto */
  onRefazer: () => void;
}) {
  const [status, setStatus] = useState<"enviando" | "gerando" | "pronto" | "erro">("enviando");
  const [etapa, setEtapa] = useState("Enviando pro estúdio...");
  const [erro, setErro] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [frase, setFrase] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const jaDisparou = useRef(false);
  const jobRef = useRef<string | null>(null);

  const dur = duracaoPorChave(config.duracao);
  const custo = custoVideoLab(config.duracao);

  /** Pergunta o andamento até o vídeo ficar pronto (ou dar erro). */
  const acompanhar = useCallback(async (jobId: string) => {
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 6000));
      try {
        const r = await fetch(`/api/lab/video/${jobId}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) continue;
        if (d.etapa) setEtapa(d.etapa as string);
        if (d.status === "pronto" && d.videoUrl) {
          setVideo(d.videoUrl as string);
          setThumb((d.thumbUrl as string) ?? null);
          setStatus("pronto");
          toast.success("Seu vídeo ficou pronto!");
          return;
        }
        if (d.status === "erro") {
          setErro((d.erro as string) ?? "Não consegui gerar o vídeo.");
          setStatus("erro");
          return;
        }
      } catch {
        // hiccup de rede: tenta no próximo ciclo
      }
    }
    setErro("A geração está demorando mais que o normal. Veja em Meus vídeos daqui a pouco.");
    setStatus("erro");
  }, []);

  const gerar = useCallback(async () => {
    setStatus("enviando");
    setErro(null);
    setVideo(null);
    setSegundos(0);
    setEtapa("Enviando pro estúdio...");
    try {
      const r = await fetch("/api/lab/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagem,
          duracao: config.duracao,
          tom: config.tom,
          voz: config.voz,
          tonalidade: config.tonalidade,
          fala: config.fala,
          instrucoes: config.instrucoes,
          movimento: config.movimento,
          produtoNome,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.jobId) {
        throw new Error(
          d?.faltaCreditos
            ? `Você precisa de ${d.custo ?? custo} créditos pra gerar esse vídeo.`
            : (d?.erro ?? "Não consegui iniciar a geração."),
        );
      }
      jobRef.current = d.jobId as string;
      setStatus("gerando");
      setEtapa("A IA está gravando seu vídeo");
      acompanhar(d.jobId as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não consegui iniciar a geração.";
      setErro(msg);
      setStatus("erro");
      toast.error(msg);
    }
  }, [acompanhar, config, custo, imagem, produtoNome]);

  // dispara sozinho ao entrar na tela (a pessoa já clicou em "Gerar vídeo")
  useEffect(() => {
    if (jaDisparou.current) return;
    jaDisparou.current = true;
    gerar();
  }, [gerar]);

  const rodando = status === "enviando" || status === "gerando";

  // relógio + frases girando (dá a sensação de progresso na espera longa)
  useEffect(() => {
    if (!rodando) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    const f = setInterval(() => setFrase((x) => (x + 1) % FRASES.length), 5000);
    return () => {
      clearInterval(t);
      clearInterval(f);
    };
  }, [rodando]);

  // a barra anda até 95% no tempo estimado e só fecha quando o vídeo chega
  const pct = status === "pronto" ? 100 : Math.min(95, (segundos / ESTIMATIVA_SEG) * 100);
  const relogio = `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="mx-auto w-full max-w-sm">
        <div
          className={cn(
            "relative aspect-[9/16] overflow-hidden rounded-3xl border bg-black/50 transition-all duration-700",
            status === "pronto"
              ? "border-primary shadow-[0_0_60px_-12px_var(--color-primary)]"
              : status === "erro"
                ? "border-destructive/50"
                : "border-primary/40 shadow-[0_0_40px_-16px_var(--color-primary)]",
          )}
        >
          {status === "pronto" && video ? (
            <video
              src={video}
              poster={thumb ?? undefined}
              controls
              autoPlay
              loop
              playsInline
              className="size-full object-contain duration-700 animate-in fade-in"
            />
          ) : (
            <>
              {/* a imagem base fica ao fundo, escurecida: é ela que está virando vídeo */}
              <Image
                src={imagem}
                alt="Cena que está virando vídeo"
                fill
                unoptimized
                sizes="(max-width: 640px) 90vw, 384px"
                className={cn(
                  "object-cover transition-all duration-1000",
                  rodando ? "scale-105 opacity-30 blur-[2px]" : "opacity-20",
                )}
              />
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                {rodando ? (
                  <div className="flex flex-col items-center gap-4">
                    <span className="relative grid size-20 place-items-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                      <span className="absolute inset-2 rounded-full border border-primary/40" />
                      <Clapperboard className="size-8 text-primary" />
                    </span>
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-white">{etapa}</p>
                      <p className="text-xs text-white/70">{FRASES[frase]}</p>
                    </div>
                    <p className="font-mono text-2xl font-bold tabular-nums text-primary">
                      {relogio}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <TriangleAlert className="size-8 text-amber-400" />
                    <p className="text-sm text-white/90">{erro}</p>
                  </div>
                )}
              </div>
              {rodando && (
                <span className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-primary/40 [animation:pulse_2s_ease-in-out_infinite]" />
              )}
            </>
          )}
        </div>

        {/* barra de progresso da geração */}
        {rodando && (
          <div className="mt-4 space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)] transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Costuma levar de 3 a 5 minutos. Pode fechar a aba: o vídeo aparece em Meus
              vídeos quando terminar.
            </p>
          </div>
        )}
      </div>

      {status === "pronto" && video && (
        <div className="space-y-3 duration-500 animate-in fade-in slide-in-from-bottom-2">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
            <Check className="size-4" />
            Vídeo de {dur?.segundos}s pronto{custo > 0 ? ` (${custo} créditos)` : ""}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href={linkBaixar(video, `viraliza-lab-${dur?.segundos ?? 15}s.mp4`)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="size-4" />
              Baixar vídeo
            </a>
            <button
              type="button"
              onClick={gerar}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <RefreshCw className="size-4" />
              Gerar de novo
            </button>
            <Link
              href="/painel"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <FolderOpen className="size-4" />
              Meus vídeos
            </Link>
          </div>
          <button
            type="button"
            onClick={onRefazer}
            className="mx-auto flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <Sparkles className="size-3.5" />
            Criar outro criativo do zero
          </button>
        </div>
      )}

      {status === "erro" && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={gerar}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RefreshCw className="size-4" />
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            Ajustar as configurações
          </button>
        </div>
      )}

      {status === "enviando" && (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Reservando a vez na fila do estúdio
        </p>
      )}
    </div>
  );
}
