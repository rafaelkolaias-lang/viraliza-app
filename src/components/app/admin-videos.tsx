"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Search, Film, Coins, X, Loader2 } from "lucide-react";
import { CorteThumb } from "@/components/hub/corte-thumb";
import { VideoDetalhesModal } from "@/components/app/video-detalhes-modal";
import { Paginacao } from "@/components/app/paginacao";
import { midiaUrl } from "@/lib/utils";
import type { VideoAdmin } from "@/lib/admin";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Feed admin: todos os vídeos gerados pelos usuários, com quem gerou. Clica e toca. */
export function AdminVideos({
  itens,
  total,
  pagina,
  porPagina,
  busca: buscaUrl,
}: {
  itens: VideoAdmin[];
  total: number;
  pagina: number;
  porPagina: number;
  busca: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(buscaUrl);
  const [aberto, setAberto] = useState<string | null>(null);
  const [buscando, startBusca] = useTransition();

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const visiveis = itens; // o filtro roda no banco, então o que chega já é o resultado

  // a busca vai pro servidor (base inteira), com uma pausa pra não consultar a
  // cada tecla; volta sempre pra página 1 porque o resultado é outro
  useEffect(() => {
    if (busca === buscaUrl) return;
    const t = setTimeout(() => {
      startBusca(() => {
        router.replace(busca.trim() ? `/admin/videos?q=${encodeURIComponent(busca.trim())}` : "/admin/videos");
      });
    }, 400);
    return () => clearTimeout(t);
  }, [busca, buscaUrl, router]);

  function irPara(p: number) {
    const q = buscaUrl ? `&q=${encodeURIComponent(buscaUrl)}` : "";
    router.push(`/admin/videos?page=${p}${q}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (total === 0 && !buscaUrl) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
        <Film className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nenhum vídeo gerado ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Assim que um usuário gerar um vídeo, ele aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* busca no banco inteiro (usuário, e-mail ou produto) */}
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 sm:max-w-sm">
        {buscando ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground" />
        )}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por usuário, e-mail ou produto..."
          className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            aria-label="Limpar filtro"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* grade */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visiveis.map(({ job, usuario }) => {
          const capa = (job.midias ?? []).find((m) => m.thumbDriveId || m.thumb);
          const dur = job.duracaoSeg
            ? `${Math.floor(job.duracaoSeg / 60)}:${(job.duracaoSeg % 60).toString().padStart(2, "0")}`
            : null;
          // vídeo do avatar (Grok) mora em media.../avatares/
          const ehAvatar = (job.midias ?? []).some((m) => (m.arquivo ?? "").includes("/avatares/"));
          return (
            <div key={job.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => setAberto(job.id)}
                className="group relative block aspect-[9/16] w-full overflow-hidden bg-gradient-to-b from-primary/15 to-muted"
              >
                {capa ? (
                  <CorteThumb
                    thumbId={capa.thumbDriveId}
                    fallback={capa.thumb ? midiaUrl(capa.thumb)! : "/capas/shopee.png"}
                    alt={job.produto}
                    w={220}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="grid size-full place-items-center">
                    <Play className="size-6 text-primary/70" />
                  </div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="grid size-10 place-items-center rounded-full bg-white/95 text-black shadow-lg">
                    <Play className="size-4 translate-x-px fill-current" />
                  </span>
                </span>
                {ehAvatar && (
                  <span className="absolute left-1 top-1 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    Avatar
                  </span>
                )}
                {dur && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                    {dur}
                  </span>
                )}
                {job.creditosGastos != null && (
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-primary">
                    <Coins className="size-2.5" />
                    {job.creditosGastos}
                  </span>
                )}
              </button>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium" title={job.produto}>
                  {job.produto}
                </p>
                <p className="truncate text-[11px] text-primary" title={usuario.email}>
                  {usuario.nome}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{usuario.email}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                  {fmtData.format(new Date(job.criadoEm))}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {visiveis.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum vídeo de toda a plataforma bate com &quot;{buscaUrl}&quot;.
        </p>
      )}

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={irPara} />

      {/* player: monta só o modal do vídeo aberto */}
      {itens.map(({ job }) =>
        aberto === job.id ? (
          <VideoDetalhesModal
            key={job.id}
            video={job}
            aberto
            onFechar={() => setAberto(null)}
          />
        ) : null,
      )}
    </div>
  );
}
