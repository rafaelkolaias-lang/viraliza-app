"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Pickaxe,
  Sparkles,
  Flame,
  Download,
  Pencil,
  ExternalLink,
  Play,
  ArrowUp,
  Gem,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { CorteThumb } from "@/components/hub/corte-thumb";
import { cn, midiaUrl, linkBaixar } from "@/lib/utils";
import { driveDownload, drivePreview } from "@/lib/drive";
import type { ViralVideo } from "@/lib/types";

const SUGESTOES = [
  "produtos pra quem tem pet",
  "roupa de academia / fitness",
  "utilidades pra cozinha",
  "maquiagem e beleza",
  "achados de casa e decoração",
  "coisas pra criança",
];

// frases que giram durante o "garimpo" (dão sensação de trabalho pesado)
const FASES = [
  "Garimpando o acervo de virais...",
  "Separando os campeões de venda...",
  "Cruzando os nichos que mais convertem...",
  "Filtrando os que estão em alta...",
  "Montando sua vitrine...",
];

type Resposta = {
  termo: string;
  nichos: string[];
  viaIA: boolean;
  videos: ViralVideo[];
};

export function MineradorChat() {
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [fase, setFase] = useState(0);
  const [res, setRes] = useState<Resposta | null>(null);
  const [visiveis, setVisiveis] = useState(0); // reveal progressivo
  const fimRef = useRef<HTMLDivElement>(null);

  // gira as frases do loading
  useEffect(() => {
    if (!buscando) return;
    const t = setInterval(() => setFase((f) => (f + 1) % FASES.length), 1100);
    return () => clearInterval(t);
  }, [buscando]);

  // revela os cards aos poucos (sensação de "tem muita coisa chegando")
  useEffect(() => {
    if (!res || res.videos.length === 0) return;
    setVisiveis(0);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setVisiveis(n);
      if (n >= res.videos.length) clearInterval(t);
    }, 90);
    return () => clearInterval(t);
  }, [res]);

  async function garimpar(q?: string) {
    const pergunta = (q ?? texto).trim();
    if (pergunta.length < 2) {
      toast.info("Escreva o que você quer garimpar.");
      return;
    }
    if (q) setTexto(q);
    setBuscando(true);
    setFase(0);
    setRes(null);
    // garante um tempinho de "garimpo" pra dar a sensação (mín. 1.6s)
    const started = performance.now();
    try {
      const r = await fetch("/api/minerador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: pergunta }),
      });
      const data = (await r.json().catch(() => ({}))) as Resposta & { erro?: string };
      if (!r.ok) {
        toast.error(data.erro ?? "Não consegui garimpar agora.");
        return;
      }
      const espera = Math.max(0, 1600 - (performance.now() - started));
      await new Promise((res) => setTimeout(res, espera));
      setRes(data);
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* ===== Cabeçalho / campo de busca ===== */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/12 via-card to-card p-6 sm:p-8">
        {/* brilho decorativo */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Pickaxe className="size-3.5" />
            Minerador de produtos
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            O que você quer vender hoje?
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Descreva o produto ou o público, e a gente garimpa os vídeos virais do
            acervo pra você usar de criativo e sair vendendo.
          </p>

          {/* input estilo chat */}
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-background/70 p-2 shadow-sm backdrop-blur focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="ml-2 size-5 shrink-0 text-muted-foreground" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !buscando && garimpar()}
              placeholder="Ex: quero vender produtos pra quem tem cachorro..."
              disabled={buscando}
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <button
              type="button"
              onClick={() => garimpar()}
              disabled={buscando}
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
              aria-label="Garimpar"
            >
              {buscando ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </button>
          </div>

          {/* sugestões */}
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => garimpar(s)}
                disabled={buscando}
                className="cursor-pointer rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={fimRef} />

      {/* ===== Estado: garimpando ===== */}
      {buscando && (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="relative grid size-16 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <span className="grid size-16 place-items-center rounded-full bg-primary/15">
              <Pickaxe className="size-7 animate-bounce text-primary" />
            </span>
          </div>
          <p className="mt-5 text-sm font-semibold">{FASES[fase]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Buscando nos milhares de vídeos do acervo
          </p>
        </div>
      )}

      {/* ===== Resultados ===== */}
      {!buscando && res && (
        <div className="mt-8">
          {res.videos.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
              <Search className="size-8 text-muted-foreground" />
              <p className="mt-3 font-semibold">Não achei nada pra isso ainda</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Tenta de outro jeito, tipo &quot;utilidades de cozinha&quot; ou
                &quot;produtos de pet&quot;.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    <Gem className="size-5 text-primary" />
                    {res.videos.length} produtos garimpados
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    pra{" "}
                    <span className="font-medium text-foreground">{res.termo}</span>
                    {res.nichos.length > 0 && (
                      <>
                        {" "}
                        · nichos:{" "}
                        <span className="text-primary">{res.nichos.join(", ")}</span>
                      </>
                    )}
                  </p>
                </div>
                {res.viaIA && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    IA entendeu seu pedido
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {res.videos.slice(0, visiveis).map((v, i) => (
                  <MineradorCard key={v.id} video={v} indice={i} />
                ))}
              </div>

              {visiveis < res.videos.length && (
                <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  carregando mais achados...
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- card de produto ---------------- */

function MineradorCard({ video, indice }: { video: ViralVideo; indice: number }) {
  const vidRef = useRef<HTMLVideoElement>(null);
  const arquivo = video.arquivo ? midiaUrl(video.arquivo) : undefined;

  // link p/ baixar (força download real, funciona no celular)
  const baixar = linkBaixar(
    arquivo ?? (video.driveId ? driveDownload(video.driveId) : undefined),
    video.titulo,
  );
  // "editar esse": abre o editor com uma cópia (mesma-origem quando dá)
  const editSrc = arquivo ?? (video.driveId ? `/api/drive-video/${video.driveId}` : null);
  const editorHref = editSrc
    ? `/painel/novo?video=${encodeURIComponent(editSrc)}&nome=${encodeURIComponent(video.titulo)}`
    : null;
  const assistirDrive = !arquivo && video.driveId ? drivePreview(video.driveId) : null;

  const nicho = video.categoria || video.titulo.replace(/nicho:\s*/i, "").trim();

  function hoverPlay(on: boolean) {
    const el = vidRef.current;
    if (!el) return;
    if (on) el.play().catch(() => {});
    else {
      el.pause();
      el.currentTime = 0;
    }
  }

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
      style={{ animation: `mineradorIn .4s ease ${Math.min(indice, 8) * 40}ms both` }}
    >
      {/* mídia 9:16 */}
      <div
        className="relative aspect-[9/16] overflow-hidden bg-black"
        onMouseEnter={() => hoverPlay(true)}
        onMouseLeave={() => hoverPlay(false)}
      >
        {arquivo ? (
          <>
            <video
              ref={vidRef}
              src={arquivo}
              poster={video.thumb}
              muted
              loop
              playsInline
              preload="none"
              className="size-full object-cover"
            />
            <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20 opacity-100 transition-opacity duration-200 group-hover:opacity-0">
              <span className="grid size-11 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
                <Play className="size-5 translate-x-px fill-white text-white" />
              </span>
            </span>
          </>
        ) : (
          <a
            href={assistirDrive ?? "#"}
            target={assistirDrive ? "_blank" : undefined}
            rel="noreferrer"
            className="block size-full cursor-pointer"
          >
            <CorteThumb
              thumbId={video.thumbDriveId}
              fallback={video.thumb ?? "/capas/shopee.png"}
              alt={video.titulo}
              className="size-full object-cover"
            />
            <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20">
              <span className="grid size-11 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
                <Play className="size-5 translate-x-px fill-white text-white" />
              </span>
            </span>
          </a>
        )}

        {/* badge Em alta */}
        {video.emAlta && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <Flame className="size-3 fill-white" />
            Em alta
          </span>
        )}
        {/* nicho */}
        <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {nicho}
        </span>
      </div>

      {/* ações */}
      <div className="flex flex-col gap-1.5 p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {editorHref ? (
            <Link
              href={editorHref}
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              <Pencil className="size-3.5" />
              Editar
            </Link>
          ) : (
            <span className="inline-flex h-8 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              -
            </span>
          )}
          {baixar ? (
            <a
              href={baixar}
              download
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-semibold transition-colors duration-200 hover:border-primary/40 hover:text-primary"
            >
              <Download className="size-3.5" />
              Baixar
            </a>
          ) : (
            <span className="inline-flex h-8 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              -
            </span>
          )}
        </div>
        {video.link && (
          <a
            href={video.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            Ver produto na Shopee
          </a>
        )}
      </div>
    </div>
  );
}
