"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Film, X, Music, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "image" | "video" | "audio";

const CONFIG: Record<
  Kind,
  { accept: string; Icon: typeof ImagePlus; cta: string }
> = {
  image: { accept: "image/*", Icon: ImagePlus, cta: "Adicionar imagens" },
  video: { accept: "video/*", Icon: Film, cta: "Adicionar vídeos" },
  audio: { accept: "audio/*", Icon: Music, cta: "Adicionar música" },
};

/**
 * Seletor de mídia: clique OU arraste pra soltar, vários de uma vez, SEMPRE com
 * pré-visualização do que foi adicionado (imagem = miniatura, vídeo = tocável,
 * música = player) e botão de remover cada um.
 */
export function MediaPicker({
  kind,
  files,
  onChange,
  multiple = true,
  hint,
  accept: aceitaCustom,
  volume,
  velocidade,
}: {
  kind: Kind;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  hint?: string;
  /** Substitui os tipos aceitos (ex.: música que também aceita vídeo, usando só o som). */
  accept?: string;
  /** Volume (0 a 1) aplicado no player da prévia, pra ouvir como vai ficar. */
  volume?: number;
  /** Velocidade aplicada no player da prévia (o tom é mantido). */
  velocidade?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { accept: aceitaPadrao, Icon, cta } = CONFIG[kind];
  const accept = aceitaCustom ?? aceitaPadrao;

  // URL de pré-visualização pra cada arquivo (vale pra imagem, vídeo e áudio).
  const previews = useMemo(
    () => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [files],
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  function add(list: FileList | null) {
    if (!list?.length) return;
    const arr = Array.from(list);
    onChange(multiple ? [...files, ...arr] : arr.slice(0, 1));
  }
  function removeAt(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  // com 1 arquivo só (música), a área grande vira um link discreto depois de
  // escolher: ela ficava ocupando meia tela sem servir pra mais nada
  const escolhido = !multiple && files.length > 0;

  return (
    <div className="space-y-3">
      {escolhido ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-medium text-primary hover:underline"
        >
          Trocar arquivo
        </button>
      ) : (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
          drag
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/40",
        )}
      >
        <Icon className="size-6 text-primary" />
        <span className="text-sm font-medium">{cta}</span>
        <span className="text-xs text-muted-foreground">
          {hint ?? "Clique ou arraste os arquivos aqui"}
        </span>
      </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Pré-visualização */}
      {previews.length > 0 && kind === "audio" && (
        <ul className="space-y-2">
          {previews.map((p, i) => (
            <li
              key={`${p.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/15">
                <Music className="size-4 text-primary" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <AudioPreview src={p.url} volume={volume} velocidade={velocidade} />
              </div>
              <RemoveButton onClick={() => removeAt(i)} />
            </li>
          ))}
        </ul>
      )}

      {previews.length > 0 && kind !== "audio" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {previews.map((p, i) => (
            <div
              key={`${p.name}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-black/40"
            >
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={p.name}
                  className="size-full object-cover"
                />
              ) : (
                <video
                  src={p.url}
                  controls
                  muted
                  playsInline
                  className="size-full object-cover"
                />
              )}
              <RemoveButton
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function mmss(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

/**
 * Player da prévia da música JÁ no volume e na velocidade escolhidos, pra dar
 * play aqui mesmo e ouvir como vai ficar. `preservesPitch` mantém o tom.
 *
 * É um player próprio, e não o `controls` do navegador, porque aquele traz um
 * controle de volume DELE: ficavam dois controles de som na mesma tela, e o do
 * navegador não vale nada no vídeo final.
 */
function AudioPreview({
  src,
  volume,
  velocidade,
}: {
  src: string;
  volume?: number;
  velocidade?: number;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = ref.current as
      | (HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean })
      | null;
    if (!a) return;
    if (volume !== undefined) a.volume = Math.max(0, Math.min(1, volume));
    if (velocidade !== undefined) {
      a.preservesPitch = true;
      a.webkitPreservesPitch = true;
      a.playbackRate = velocidade;
    }
  }, [volume, velocidade, src]);

  function alternar() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
      setTocando(true);
    } else {
      a.pause();
      setTocando(false);
    }
  }

  const pct = dur > 0 ? Math.min(100, (tempo / dur) * 100) : 0;

  return (
    <div className="mt-1 flex items-center gap-2">
      <audio
        ref={ref}
        src={src}
        onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onEnded={() => setTocando(false)}
        className="hidden"
      />
      <button
        type="button"
        onClick={alternar}
        aria-label={tocando ? "Pausar" : "Tocar"}
        className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25"
      >
        {tocando ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
      </button>
      <div
        role="presentation"
        onClick={(e) => {
          const a = ref.current;
          if (!a || !dur) return;
          const r = e.currentTarget.getBoundingClientRect();
          a.currentTime = ((e.clientX - r.left) / r.width) * dur;
        }}
        className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {mmss(tempo)} / {mmss(dur)}
      </span>
    </div>
  );
}

function RemoveButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remover"
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full bg-destructive text-white shadow-sm transition-colors hover:bg-destructive/90",
        className,
      )}
    >
      <X className="size-3.5" />
    </button>
  );
}
