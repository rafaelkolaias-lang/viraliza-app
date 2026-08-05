"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  ExternalLink,
  Film,
  ImageIcon,
  Loader2,
  Play,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { CorteThumb } from "@/components/hub/corte-thumb";
import { VideoDetalhesModal } from "@/components/app/video-detalhes-modal";
import { maisCriacoes } from "@/app/actions/criacoes";
import { cn, midiaUrl } from "@/lib/utils";
import {
  PERIODOS_CRIACOES,
  TIPOS_CRIACAO,
  type ItemCriacao,
  type TipoCriacao,
} from "@/lib/criacoes";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ICONE: Record<TipoCriacao, typeof Film> = {
  video: Clapperboard,
  imagem: ImageIcon,
  avatar: UserRound,
};

const COR_TIPO: Record<TipoCriacao, string> = {
  video: "bg-primary/90 text-primary-foreground",
  imagem: "bg-sky-500/90 text-white",
  avatar: "bg-amber-500/90 text-black",
};

const ROTULO_TIPO: Record<TipoCriacao, string> = {
  video: "Vídeo",
  imagem: "Imagem",
  avatar: "Avatar",
};

export type FiltroAtual = {
  userId: string;
  busca: string;
  dias: number;
  tipos: TipoCriacao[];
};

export function AdminCriacoes({
  itens: iniciais,
  temMais: temMaisInicial,
  filtro,
  pessoa,
}: {
  itens: ItemCriacao[];
  temMais: boolean;
  filtro: FiltroAtual;
  pessoa: { nome: string; email: string } | null;
}) {
  const router = useRouter();
  const [itens, setItens] = useState(iniciais);
  const [temMais, setTemMais] = useState(temMaisInicial);
  const [busca, setBusca] = useState(filtro.busca);
  const [aberto, setAberto] = useState<string | null>(null);
  const [navegando, startNavegar] = useTransition();
  const [carregando, setCarregando] = useState(false);

  /** monta a URL preservando o resto dos filtros */
  function url(mudanca: Partial<FiltroAtual>) {
    const f = { ...filtro, ...mudanca };
    const p = new URLSearchParams();
    if (f.userId) p.set("u", f.userId);
    if (f.busca.trim()) p.set("q", f.busca.trim());
    if (f.dias > 0) p.set("dias", String(f.dias));
    if (f.tipos.length && f.tipos.length < TIPOS_CRIACAO.length) p.set("t", f.tipos.join(","));
    const s = p.toString();
    return s ? `/admin/criacoes?${s}` : "/admin/criacoes";
  }

  function ir(mudanca: Partial<FiltroAtual>) {
    startNavegar(() => router.replace(url(mudanca)));
  }

  // busca por texto vai pro servidor depois de uma pausa (não a cada tecla)
  useEffect(() => {
    if (busca === filtro.busca) return;
    const t = setTimeout(() => {
      startNavegar(() => router.replace(url({ busca, userId: "" })));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function alternarTipo(t: TipoCriacao) {
    const tem = filtro.tipos.includes(t);
    // desmarcar o último deixaria a tela vazia: nesse caso volta pra todos
    const novos = tem ? filtro.tipos.filter((x) => x !== t) : [...filtro.tipos, t];
    ir({ tipos: novos.length ? novos : TIPOS_CRIACAO.map((x) => x.chave) });
  }

  async function carregarMais() {
    const ultimo = itens[itens.length - 1];
    if (!ultimo || carregando) return;
    setCarregando(true);
    try {
      const r = await maisCriacoes({
        userId: filtro.userId || undefined,
        busca: filtro.busca || undefined,
        dias: filtro.dias,
        tipos: filtro.tipos,
        antes: ultimo.quando,
      });
      // o corte do lote é "menor ou igual" (pra não perder quem foi criado no
      // mesmo instante), então o último item volta: descarta pela chave
      const tenho = new Set(itens.map((i) => i.chave));
      const novos = r.itens.filter((i) => !tenho.has(i.chave));
      if (novos.length) setItens((a) => [...a, ...novos]);
      // lote sem nada inédito = acabou, não adianta oferecer o botão de novo
      setTemMais(r.temMais && novos.length > 0);
    } finally {
      setCarregando(false);
    }
  }

  const videoAberto = itens.find((i) => i.chave === aberto)?.job;

  return (
    <div className="space-y-4">
      {/* ---- filtros ---- */}
      <div className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
        {pessoa && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Mostrando só:</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {pessoa.nome || pessoa.email}
              <button
                type="button"
                onClick={() => ir({ userId: "" })}
                aria-label="Tirar o filtro de pessoa"
                className="hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            {navegando ? (
              <Loader2 className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" />
            ) : (
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            )}
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Procurar por nome ou e-mail"
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-8 text-sm outline-none focus:border-primary/60"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {TIPOS_CRIACAO.map((t) => {
              const ativo = filtro.tipos.includes(t.chave);
              const Icone = ICONE[t.chave];
              return (
                <button
                  key={t.chave}
                  type="button"
                  onClick={() => alternarTipo(t.chave)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    ativo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icone className="size-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground">Período:</span>
            {PERIODOS_CRIACOES.map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => ir({ dias: p.v })}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                  p.v === filtro.dias
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- galeria ---- */}
      {itens.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
          <Film className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nada por aqui</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ninguém criou nada com esses filtros. Tente um período maior ou limpe a busca.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {itens.map((i) => (
            <Card key={i.chave} item={i} onAbrirVideo={() => setAberto(i.chave)} />
          ))}
        </div>
      )}

      {temMais && (
        <div className="grid place-items-center pt-2">
          <button
            type="button"
            onClick={carregarMais}
            disabled={carregando}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {carregando && <Loader2 className="size-4 animate-spin" />}
            {carregando ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      )}

      {videoAberto && (
        <VideoDetalhesModal video={videoAberto} aberto onFechar={() => setAberto(null)} />
      )}
    </div>
  );
}

function Card({ item, onAbrirVideo }: { item: ItemCriacao; onAbrirVideo: () => void }) {
  const Icone = ICONE[item.tipo];
  const emProducao =
    item.tipo === "video" && item.job && !["pronto", "erro"].includes(item.job.status);
  const comErro = item.tipo === "video" && item.job?.status === "erro";

  const capaVideo = (item.job?.midias ?? []).find((m) => m.thumbDriveId || m.thumb);
  const dur = item.job?.duracaoSeg
    ? `${Math.floor(item.job.duracaoSeg / 60)}:${(item.job.duracaoSeg % 60).toString().padStart(2, "0")}`
    : null;

  const miolo = (
    <>
      {item.tipo === "video" ? (
        capaVideo ? (
          <CorteThumb
            thumbId={capaVideo.thumbDriveId}
            fallback={capaVideo.thumb ? midiaUrl(capaVideo.thumb)! : "/capas/shopee.png"}
            alt={item.titulo}
            w={220}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center">
            <Icone className="size-6 text-primary/70" />
          </div>
        )
      ) : (
        // sem next/image: é arquivo do serverrk e o que importa é ver o original
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imagemUrl}
          alt={item.titulo}
          loading="lazy"
          className="size-full object-cover transition-transform group-hover:scale-105"
        />
      )}

      <span
        className={cn(
          "absolute left-1 top-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
          COR_TIPO[item.tipo],
        )}
      >
        <Icone className="size-2.5" />
        {ROTULO_TIPO[item.tipo]}
      </span>

      {comErro && (
        <span className="absolute right-1 top-1 rounded bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
          erro
        </span>
      )}
      {emProducao && (
        <span className="absolute right-1 top-1 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-black">
          gerando
        </span>
      )}
      {dur && (
        <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
          {dur}
        </span>
      )}
      {item.creditos != null && (
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-medium text-primary">
          {item.creditos} cr
        </span>
      )}
    </>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {item.tipo === "video" ? (
        <button
          type="button"
          onClick={onAbrirVideo}
          className="group relative block aspect-[9/16] w-full overflow-hidden bg-gradient-to-b from-primary/15 to-muted"
        >
          {miolo}
          <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="grid size-10 place-items-center rounded-full bg-white/95 text-black shadow-lg">
              <Play className="size-4 translate-x-px fill-current" />
            </span>
          </span>
        </button>
      ) : (
        <a
          href={item.imagemUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block aspect-[9/16] w-full overflow-hidden bg-muted"
        >
          {miolo}
          <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="grid size-9 place-items-center rounded-full bg-white/95 text-black shadow-lg">
              <ExternalLink className="size-4" />
            </span>
          </span>
        </a>
      )}

      <div className="p-2.5">
        <p className="truncate text-xs font-medium" title={item.titulo}>
          {item.titulo}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">{item.ferramenta}</p>
        <p className="truncate text-[11px] text-primary" title={item.usuarioEmail}>
          {item.usuarioNome || item.usuarioEmail}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground/70">
          {fmtData.format(new Date(item.quando))}
          {item.extra ? ` · ${item.extra}` : ""}
        </p>
      </div>
    </div>
  );
}
