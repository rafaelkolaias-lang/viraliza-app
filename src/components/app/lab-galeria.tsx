"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Download, Trash2, Video, Loader2, Images } from "lucide-react";
import { toast } from "sonner";
import { cn, linkBaixar } from "@/lib/utils";
import { ROTULO_ORIGEM, type ImagemDaGaleria } from "@/lib/galeria-imagens";
import { guardarImagemParaVideo } from "@/lib/lab-handoff";

/**
 * "Minhas imagens": tudo que a pessoa gerou na plataforma, num lugar só.
 *
 * A graça não é guardar foto, é o que vem junto: a imagem que nasceu no Lab
 * carrega as escolhas que a criaram (produto, influenciador, estilo e cenário).
 * Por isso o card dela tem "Novo vídeo", que leva pro funil já no passo do
 * vídeo com tudo preenchido, sem gerar (nem cobrar) a imagem de novo.
 *
 * As de outras origens (Viral Boost, Personalize com IA) ficam aqui pra baixar e
 * organizar, mas sem esse atalho, porque o vídeo delas sai de outro fluxo.
 */

function dataCurta(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Card({
  img,
  onNovoVideo,
  onFavoritar,
  onExcluir,
}: {
  img: ImagemDaGaleria;
  onNovoVideo: () => void;
  onFavoritar: () => void;
  onExcluir: () => void;
}) {
  const podeVideo = img.origem === "lab" && !!img.contexto;

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/60 bg-card/50 transition-colors hover:border-primary/40">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.imagem}
          alt={img.titulo}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover"
        />
        <button
          type="button"
          onClick={onFavoritar}
          title={img.favorita ? "Tirar dos favoritos" : "Marcar como favorita"}
          aria-pressed={img.favorita}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <Heart className={cn("size-4.5", img.favorita && "fill-primary text-primary")} />
        </button>
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur">
          {ROTULO_ORIGEM[img.origem]}
        </span>
      </div>

      <div className="space-y-2.5 p-3">
        <p className="line-clamp-1 text-sm font-medium" title={img.titulo}>
          {img.titulo}
        </p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{dataCurta(img.criadoEm)}</span>
          <span className="flex items-center gap-1">
            <Video className="size-3.5 text-primary" />
            {img.videos} vídeo{img.videos === 1 ? "" : "s"} gerado{img.videos === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {podeVideo ? (
            <button
              type="button"
              onClick={onNovoVideo}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Video className="size-4" />
              Novo vídeo
            </button>
          ) : (
            <span className="flex-1 text-[11px] leading-snug text-muted-foreground">
              {img.origem === "boost"
                ? "O vídeo dessa cena sai lá no Viral Boost."
                : "Use ela como influenciador no funil do Lab."}
            </span>
          )}
          <a
            href={linkBaixar(img.imagem, img.titulo.slice(0, 40) || "imagem")}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            title="Baixar"
          >
            <Download className="size-4" />
          </a>
          <button
            type="button"
            onClick={onExcluir}
            title="Excluir"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function LabGaleria({
  comCabecalho = true,
}: {
  /** false quando quem abre já mostra o título (a página de Minhas imagens) */
  comCabecalho?: boolean;
}) {
  const [imagens, setImagens] = useState<ImagemDaGaleria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [soFavoritas, setSoFavoritas] = useState(false);
  const router = useRouter();

  /** Deixa a imagem (com o contexto dela) pro funil e abre o Labs no vídeo. */
  function novoVideo(img: ImagemDaGaleria) {
    guardarImagemParaVideo(img);
    router.push("/painel/lab");
  }

  useEffect(() => {
    fetch("/api/imagens", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setImagens(d?.imagens ?? []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function favoritar(img: ImagemDaGaleria) {
    const favorita = !img.favorita;
    setImagens((l) => l.map((i) => (i.id === img.id ? { ...i, favorita } : i)));
    try {
      const r = await fetch("/api/imagens", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: img.id, favorita }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setImagens((l) => l.map((i) => (i.id === img.id ? { ...i, favorita: !favorita } : i)));
      toast.error("Não consegui salvar o favorito.");
    }
  }

  async function excluir(img: ImagemDaGaleria) {
    if (!confirm(`Excluir essa imagem da sua galeria?\n\n${img.titulo}`)) return;
    const antes = imagens;
    setImagens((l) => l.filter((i) => i.id !== img.id));
    try {
      const r = await fetch(`/api/imagens?id=${encodeURIComponent(img.id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
    } catch {
      setImagens(antes);
      toast.error("Não consegui excluir.");
    }
  }

  const lista = soFavoritas ? imagens.filter((i) => i.favorita) : imagens;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {comCabecalho ? (
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <Images className="size-5" />
              </span>
              Minhas imagens
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tudo que você gerou fica salvo aqui. Baixe, favorite ou transforme em vídeo de novo.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {lista.length} {lista.length === 1 ? "imagem" : "imagens"} na sua galeria
          </p>
        )}
        <button
          type="button"
          onClick={() => setSoFavoritas((v) => !v)}
          aria-pressed={soFavoritas}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
            soFavoritas
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          <Heart className={cn("size-4", soFavoritas && "fill-primary")} />
          {soFavoritas ? "Vendo as favoritas" : "Filtrar favoritas"}
        </button>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando suas imagens...
        </div>
      ) : lista.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Images className="size-7" />
          </span>
          <p className="mt-4 font-medium">
            {soFavoritas ? "Nenhuma favorita ainda" : "Você ainda não gerou nenhuma imagem"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {soFavoritas
              ? "Toque no coração de uma imagem pra ela aparecer aqui."
              : "Crie um criativo no funil do Lab: a imagem cai aqui sozinha, com o produto e o influenciador que você escolheu."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((img) => (
            <Card
              key={img.id}
              img={img}
              onNovoVideo={() => novoVideo(img)}
              onFavoritar={() => favoritar(img)}
              onExcluir={() => excluir(img)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
