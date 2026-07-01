"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { VozOpcao } from "@/lib/vozes";

const rotuloGenero = (g: string) =>
  g === "f" ? "feminina" : g === "m" ? "masculina" : "";

function TagPrincipal() {
  return (
    <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary">
      Principal
    </span>
  );
}

/** Seletor de voz com prévia: cada voz tem um play que toca a prévia salva
 *  (/api/midia/voice-previews/<id>.mp3). Substitui o <select> nativo (também
 *  resolve a cor da lista, que ficava branca no tema escuro). */
export function SeletorVoz({
  vozes,
  value,
  onChange,
}: {
  vozes: VozOpcao[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const sel = vozes.find((v) => v.id === value) ?? vozes[0];

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function onDown(e: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [aberto]);

  // para a prévia ao desmontar
  useEffect(() => () => audioRef.current?.pause(), []);

  function pararAudio() {
    audioRef.current?.pause();
    setTocandoId(null);
    setCarregandoId(null);
  }

  function tocar(id: string) {
    if (tocandoId === id) {
      pararAudio();
      return;
    }
    pararAudio();
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setTocandoId(null);
      audioRef.current.onerror = () => {
        setTocandoId(null);
        setCarregandoId(null);
        toast.error("A prévia dessa voz ainda não foi gerada.");
      };
    }
    const a = audioRef.current;
    a.src = `/api/midia/voice-previews/${encodeURIComponent(id)}.mp3`;
    setCarregandoId(id);
    a.play()
      .then(() => {
        setCarregandoId(null);
        setTocandoId(id);
      })
      .catch(() => {
        setCarregandoId(null);
        setTocandoId(null);
      });
  }

  const nomeCompleto = (v: VozOpcao) => {
    const g = rotuloGenero(v.genero);
    return g ? `${v.nome} (${g})` : v.nome;
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-base text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">
            {sel ? nomeCompleto(sel) : "Selecionar voz"}
          </span>
          {sel?.principal && <TagPrincipal />}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {vozes.map((v) => {
            const ativo = v.id === value;
            const tocando = tocandoId === v.id;
            const carregando = carregandoId === v.id;
            return (
              <div
                key={v.id}
                className={cn(
                  "flex items-center gap-1 rounded-md pr-1",
                  ativo && "bg-primary/10",
                )}
              >
                <button
                  type="button"
                  onClick={() => tocar(v.id)}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-primary hover:bg-primary/15"
                  aria-label={tocando ? "Pausar prévia" : "Ouvir prévia"}
                >
                  {carregando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : tocando ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(v.id);
                    setAberto(false);
                  }}
                  className="flex flex-1 items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">
                      {v.nome}
                      {rotuloGenero(v.genero) && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({rotuloGenero(v.genero)})
                        </span>
                      )}
                    </span>
                    {v.principal && <TagPrincipal />}
                  </span>
                  {ativo && <Check className="size-4 shrink-0 text-primary" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
