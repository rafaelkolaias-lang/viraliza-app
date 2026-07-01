"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Film, X, Music } from "lucide-react";
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
}: {
  kind: Kind;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { accept, Icon, cta } = CONFIG[kind];

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

  return (
    <div className="space-y-3">
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
                <audio src={p.url} controls className="mt-1 h-8 w-full" />
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
