"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
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

// frases que giram durante o "garimpo"
const FASES = [
  "Descendo na mina dos virais...",
  "Passando a lupa nos campeões de venda...",
  "Cruzando os nichos que mais convertem...",
  "Separando os que estão em alta...",
  "Lapidando sua vitrine...",
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
  const [visiveis, setVisiveis] = useState(0);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!buscando) return;
    const t = setInterval(() => setFase((f) => (f + 1) % FASES.length), 1300);
    return () => clearInterval(t);
  }, [buscando]);

  // revela os cards DEVAGAR e bonito (um a cada 200ms)
  useEffect(() => {
    if (!res || res.videos.length === 0) return;
    setVisiveis(0);
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      setVisiveis(n);
      if (n >= res.videos.length) clearInterval(t);
    }, 200);
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
      // segura um tempo de "garimpo" pra curtir a animação (mín. 2.2s)
      const espera = Math.max(0, 2200 - (performance.now() - started));
      await new Promise((res) => setTimeout(res, espera));
      setRes(data);
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* ===== HERÓI / BUSCA ===== */}
      <div className="relative overflow-hidden rounded-[28px] border border-border">
        {/* fundo caverna */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/minerador/fundo.webp)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/35" />

        <div className="relative flex items-center gap-6 p-6 sm:p-10">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
              <Gem className="size-3.5" />
              Minerador de produtos
            </span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              O que você quer{" "}
              <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
                vender
              </span>{" "}
              hoje?
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Descreva o produto ou o público, e a gente garimpa os vídeos virais do
              acervo pra você usar de criativo e sair vendendo.
            </p>

            {/* input estilo chat */}
            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/40 p-2 shadow-xl backdrop-blur-md focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/25">
              <Search className="ml-2 size-5 shrink-0 text-white/50" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !buscando && garimpar()}
                placeholder="Ex: quero vender produtos pra quem tem cachorro..."
                disabled={buscando}
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button
                type="button"
                onClick={() => garimpar()}
                disabled={buscando}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
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
                  className="cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition-colors duration-200 hover:border-primary/50 hover:text-white disabled:opacity-60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* picareta herói (flutuando) */}
          <div className="hidden shrink-0 lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/minerador/heroi.webp?v=2"
              alt=""
              className="size-64 object-contain drop-shadow-[0_10px_40px_rgba(16,185,129,0.35)]"
              style={{ animation: "mineradorFloat 4s ease-in-out infinite" }}
            />
          </div>
        </div>
      </div>

      <div ref={fimRef} />

      {/* ===== GARIMPANDO ===== */}
      {buscando && (
        <div className="mt-10 grid place-items-center py-10 text-center">
          <div className="relative grid size-52 place-items-center">
            {/* brilho girando atrás */}
            <div
              className="absolute size-52 rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(16,185,129,0.35),transparent_60%)] blur-xl"
              style={{ animation: "mineradorSpin 3.5s linear infinite" }}
            />
            <div
              className="absolute size-40 rounded-full bg-primary/20 blur-2xl"
              style={{ animation: "mineradorPulse 2s ease-in-out infinite" }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/minerador/lupa.webp?v=2"
              alt="Garimpando"
              className="relative size-48 object-contain"
              style={{ animation: "mineradorFloat 3s ease-in-out infinite" }}
            />
          </div>
          <p className="mt-6 text-base font-bold">{FASES[fase]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Passando a lupa nos milhares de vídeos do acervo
          </p>
          {/* barrinha shimmer */}
          <div className="mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
              style={{
                backgroundSize: "200% 100%",
                animation: "mineradorShimmer 1.4s linear infinite",
              }}
            />
          </div>
        </div>
      )}

      {/* ===== RESULTADOS ===== */}
      {!buscando && res && (
        <div className="mt-10">
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
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black">
                    <Gem className="size-5 text-primary" />
                    {res.videos.length} produtos garimpados
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    pra{" "}
                    <span className="font-semibold text-foreground">{res.termo}</span>
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

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {res.videos.slice(0, visiveis).map((v, i) => (
                  <MineradorCard key={v.id} video={v} indice={i} />
                ))}
              </div>

              {visiveis < res.videos.length && (
                <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  garimpando mais achados...
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

  const baixar = linkBaixar(
    arquivo ?? (video.driveId ? driveDownload(video.driveId) : undefined),
    video.titulo,
  );
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
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
      style={{ animation: `mineradorIn .55s cubic-bezier(.22,1,.36,1) both` }}
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
              <span className="grid size-12 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
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
              <span className="grid size-12 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
                <Play className="size-5 translate-x-px fill-white text-white" />
              </span>
            </span>
          </a>
        )}

        {/* badge Em alta - com fogo, brilho e chama animada */}
        {video.emAlta && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-lg shadow-orange-500/40 ring-1 ring-white/20">
            <Flame
              className="size-3 fill-yellow-200 text-yellow-200"
              style={{ animation: "mineradorFlame 1.1s ease-in-out infinite" }}
            />
            Em alta
          </span>
        )}
        {/* nicho */}
        <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {nicho}
        </span>
      </div>

      {/* ações */}
      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          {editorHref ? (
            <Link
              href={editorHref}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
            >
              <Pencil className="size-3.5" />
              Editar
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              -
            </span>
          )}
          {baixar ? (
            <a
              href={baixar}
              download
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-semibold transition-colors duration-200 hover:border-primary/40 hover:text-primary"
            >
              <Download className="size-3.5" />
              Baixar
            </a>
          ) : (
            <span className="inline-flex h-9 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
              -
            </span>
          )}
        </div>
        {video.link && (
          <a
            href={video.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground transition-colors duration-200 hover:border-primary/40 hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            Ver produto na Shopee
          </a>
        )}
      </div>
    </div>
  );
}
