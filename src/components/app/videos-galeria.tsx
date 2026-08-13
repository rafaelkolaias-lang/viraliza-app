"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Download,
  Search,
  Coins,
  Pencil,
  RotateCcw,
  Stamp,
  Scissors,
  MoreHorizontal,
  Film,
} from "lucide-react";
import { CorteThumb } from "@/components/hub/corte-thumb";
import { VideoDetalhesModal } from "@/components/app/video-detalhes-modal";
import { ExcluirVideo } from "@/components/app/excluir-video";
import { ReportarProblema } from "@/components/app/reportar-problema";
import { cn, midiaUrl, linkBaixar } from "@/lib/utils";
import { driveDownload } from "@/lib/drive";
import {
  guardarFontesMarca,
  podeColocarMarca,
  ROTA_MARCA_LOTE,
} from "@/lib/marca-lote-client";
import { ROTULO_ORIGEM_VIDEO, type VideoJob } from "@/lib/types";

/**
 * "Meus vídeos" em grade de capas verticais.
 *
 * Todo vídeo daqui é 9:16, então a capa é 9:16: mostra muito mais por tela do
 * que a lista larga antiga e a pessoa reconhece o vídeo pela imagem, não pelo
 * nome. Passar o mouse roda o vídeo mudo, que é o jeito mais rápido de achar
 * aquele take específico no meio de dezenas.
 *
 * As ações que já existiam continuam todas aqui: assistir, baixar, editar,
 * refazer, colocar marca, reportar e excluir. As menos usadas foram pro menu
 * "..." pra não poluir o card.
 */

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function duracao(seg?: number) {
  if (!seg) return null;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Filtro = "todos" | "prontos" | "producao" | "erro";

const FILTROS: { chave: Filtro; label: string }[] = [
  { chave: "todos", label: "Todos" },
  { chave: "prontos", label: "Prontos" },
  { chave: "producao", label: "Em produção" },
  { chave: "erro", label: "Com erro" },
];

function situacao(v: VideoJob): Filtro {
  if (v.status === "pronto") return "prontos";
  if (v.status === "erro") return "erro";
  return "producao";
}

function Card({ video }: { video: VideoJob }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [menu, setMenu] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const midias = video.midias ?? [];
  const saidas = video.saidas ?? [];
  const pronto = video.status === "pronto";
  const emProducao = situacao(video) === "producao";
  const capaMidia = midias.find((m) => m.driveId || m.thumb);
  const temModal = pronto && midias.length > 0;
  const dur = duracao(video.duracaoSeg);
  const ehCortes = video.tipo === "cortes";

  const primeiraSrc = (() => {
    const m = midias[0];
    if (m) return midiaUrl(m.arquivo) ?? (m.driveId ? driveDownload(m.driveId) : undefined);
    if (saidas[0]) return midiaUrl(saidas[0]);
    return undefined;
  })();
  const baixar = primeiraSrc ? linkBaixar(primeiraSrc, video.produto) : null;

  // mesmas regras do card antigo: vídeo do editor já tem voz e legenda queimadas,
  // então ele refaz em vez de reeditar; o de avatar não faz nem um nem outro
  const ehAvatar = video.ehAvatar || (!!primeiraSrc && primeiraSrc.includes("/avatares/"));
  const podeEditar = !!primeiraSrc && video.tipo !== "produto";
  const podeRefazer = video.tipo === "produto" && !ehAvatar;
  // "Tentar Novamente" (tarefa 21): vídeo do EDITOR que falhou reabre o funil com
  // os ajustes e, dentro das 24h de retenção, com as mídias originais também.
  // Lab/Boost/avatar têm fluxo próprio e ficam de fora.
  const podeTentarDeNovo =
    video.status === "erro" &&
    video.tipo === "produto" &&
    video.origem === "editor" &&
    !video.ehAvatar;
  const podeMarca = pronto && podeColocarMarca(primeiraSrc);
  // "Cortar": leva o vídeo pronto direto pro cortador, sem baixar e subir de
  // novo. Vale pra qualquer vídeo finalizado com arquivo (o lote de cortes tem
  // tela própria e já é barrado antes, no menu).
  const podeCortar = pronto && !!primeiraSrc;

  function colocarMarca() {
    if (!primeiraSrc) return;
    guardarFontesMarca([
      {
        url: primeiraSrc,
        nome: video.produto,
        thumb: capaMidia?.thumb ? midiaUrl(capaMidia.thumb) : undefined,
      },
    ]);
    router.push(ROTA_MARCA_LOTE);
  }

  /** prévia muda no hover: só carrega o arquivo quando o mouse chega */
  function preverInicio() {
    const el = videoRef.current;
    if (!el || !primeiraSrc) return;
    if (!el.src) el.src = primeiraSrc;
    el.play().catch(() => {});
  }
  function preverFim() {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }

  const capa = (
    <>
      {capaMidia ? (
        <CorteThumb
          thumbId={capaMidia.thumbDriveId}
          fallback={capaMidia.thumb ? midiaUrl(capaMidia.thumb)! : "/capas/shopee.png"}
          alt={video.produto}
          w={400}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : emProducao ? (
        // em produção: brilho pulsando, dá a sensação de que algo está acontecendo
        <div className="relative size-full overflow-hidden">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary/40 via-emerald-500/15 to-background blur-xl" />
          <div className="absolute inset-0 grid place-items-center">
            <span className="relative grid size-12 place-items-center">
              <span
                className="absolute inset-0 animate-spin rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 15%, rgb(16 185 129), transparent 85%)",
                  animationDuration: "2.4s",
                }}
              />
              <span className="relative grid size-9 place-items-center rounded-full bg-black/60 backdrop-blur">
                <Play className="size-4 text-primary" />
              </span>
            </span>
          </div>
        </div>
      ) : (
        <div className="grid size-full place-items-center bg-gradient-to-b from-primary/10 to-muted">
          <Film className="size-7 text-primary/60" />
        </div>
      )}

      {/* prévia muda por cima da capa */}
      {pronto && primeiraSrc && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      )}

      {temModal && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid size-12 place-items-center rounded-full bg-white/95 text-black shadow-lg">
            <Play className="size-5 translate-x-px fill-current" />
          </span>
        </span>
      )}

      {/* etiqueta de origem */}
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur">
        {ROTULO_ORIGEM_VIDEO[video.origem ?? "editor"]}
      </span>

      {dur && (
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {dur}
        </span>
      )}
      {emProducao && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black">
          <span className="size-1.5 animate-pulse rounded-full bg-black/70" />
          gerando
        </span>
      )}
      {video.status === "erro" && (
        <span className="absolute bottom-2 left-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
          erro
        </span>
      )}
    </>
  );

  return (
    <>
      <article className="group overflow-hidden rounded-2xl border border-border/60 bg-card/50 transition-colors hover:border-primary/40">
        {ehCortes ? (
          <Link
            href={`/painel/videos/${video.id}`}
            className="relative block aspect-[9/16] overflow-hidden bg-black/40"
            onMouseEnter={preverInicio}
            onMouseLeave={preverFim}
          >
            {capa}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => temModal && setAberto(true)}
            disabled={!temModal}
            aria-label={temModal ? `Assistir ${video.produto}` : undefined}
            onMouseEnter={preverInicio}
            onMouseLeave={preverFim}
            className="relative block aspect-[9/16] w-full overflow-hidden bg-black/40 disabled:cursor-default"
          >
            {capa}
          </button>
        )}

        <div className="space-y-2 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug" title={video.produto}>
            {video.produto}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>{fmtData.format(new Date(video.criadoEm))}</span>
            {video.creditosGastos != null && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Coins className="size-3" />
                {video.creditosGastos.toLocaleString("pt-BR")}
              </span>
            )}
          </div>

          {emProducao && video.etapa && (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-400">
              <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
              {video.etapa}
            </p>
          )}
          {video.status === "erro" && video.erro && (
            <p
              className="line-clamp-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
              title={video.erro}
            >
              {video.erro}
            </p>
          )}

          <div className="flex items-center gap-1.5 pt-0.5">
            {podeTentarDeNovo && (
              <Link
                href={`/painel/novo?reutilizar=${video.id}`}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <RotateCcw className="size-3.5" />
                Tentar Novamente
              </Link>
            )}
            {baixar && (
              <a
                href={baixar}
                download
                title="Baixar"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Download className="size-4" />
              </a>
            )}
            {ehCortes && (
              <Link
                href={`/painel/videos/${video.id}`}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Ver os cortes
              </Link>
            )}
            <ExcluirVideo id={video.id} />
            {pronto && !ehCortes && (
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  aria-label="Mais ações"
                  aria-expanded={menu}
                  className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menu && (
                  <>
                    {/* clique fora fecha */}
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setMenu(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <div className="absolute bottom-full right-0 z-50 mb-1 w-48 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
                      {podeEditar && (
                        <Link
                          href={`/painel/novo?video=${encodeURIComponent(primeiraSrc!)}&nome=${encodeURIComponent(video.produto)}`}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-accent"
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </Link>
                      )}
                      {podeRefazer && (
                        <Link
                          href={`/painel/novo?reutilizar=${video.id}`}
                          title="Editar e re-gerar: reabre o funil com os ajustes deste vídeo (e as mídias, dentro de 24h)"
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-accent"
                        >
                          <Pencil className="size-3.5" />
                          Editar novamente
                        </Link>
                      )}
                      {podeCortar && (
                        <Link
                          href={`/painel/criar-corte?job=${video.id}`}
                          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-accent"
                        >
                          <Scissors className="size-3.5" />
                          Cortar
                        </Link>
                      )}
                      {podeMarca && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenu(false);
                            colocarMarca();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-accent"
                        >
                          <Stamp className="size-3.5" />
                          Colocar marca
                        </button>
                      )}
                      <div className="px-1 py-1">
                        <ReportarProblema jobId={video.id} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </article>

      {temModal && (
        <VideoDetalhesModal video={video} aberto={aberto} onFechar={() => setAberto(false)} />
      )}
    </>
  );
}

export function VideosGaleria({ videos }: { videos: VideoJob[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

  const contagem = useMemo(() => {
    const c: Record<Filtro, number> = { todos: videos.length, prontos: 0, producao: 0, erro: 0 };
    for (const v of videos) c[situacao(v)]++;
    return c;
  }, [videos]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return videos.filter(
      (v) =>
        (filtro === "todos" || situacao(v) === filtro) &&
        (!termo || v.produto.toLowerCase().includes(termo)),
    );
  }, [videos, filtro, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              type="button"
              onClick={() => setFiltro(f.chave)}
              aria-pressed={filtro === f.chave}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                filtro === f.chave
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{contagem[f.chave]}</span>
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/60"
          />
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-14 text-center text-sm text-muted-foreground">
          Nenhum vídeo {busca.trim() ? "com esse nome" : "nessa situação"}.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((v) => (
            <Card key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
