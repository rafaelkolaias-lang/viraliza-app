"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Loader2,
  Scissors,
  Captions,
  Clapperboard,
  Camera,
  Music,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/app/segmented";
import { cn } from "@/lib/utils";

const CORES = [
  { value: "amarelo", label: "Amarelo", swatch: "#FFE000" },
  { value: "branco", label: "Branco", swatch: "#FFFFFF" },
  { value: "verde", label: "Verde", swatch: "#2FE88A" },
] as const;

const POSICOES = [
  { value: "cima", label: "Em cima" },
  { value: "meio", label: "No meio" },
  { value: "baixo", label: "Embaixo" },
] as const;

const DURACOES = [
  { value: "30", label: "30s" },
  { value: "60", label: "1 min" },
  { value: "90", label: "1:30" },
] as const;

const PLATAFORMAS = [
  { nome: "YouTube", icon: Clapperboard, ativo: true },
  { nome: "Instagram", icon: Camera, ativo: false },
  { nome: "TikTok", icon: Music, ativo: false },
];

export function CortesForm({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  // No demo a duração é travada em 30s (server também força).
  const [dur, setDur] = useState<string>(demo ? "30" : "60");
  const [legenda, setLegenda] = useState(true);
  const [cor, setCor] = useState<string>("amarelo");
  const [pos, setPos] = useState<string>("baixo");
  const [enviando, setEnviando] = useState(false);

  async function gerar() {
    const l = link.trim();
    if (!/^https?:\/\/.+/i.test(l)) return toast.error("Cole um link válido.");
    if (!/(youtube\.com|youtu\.be)/i.test(l))
      return toast.error("Por enquanto só YouTube. Instagram e TikTok em breve.");

    setEnviando(true);
    try {
      const res = await fetch("/api/cortes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ link: l, dur: Number(dur), legenda, cor, pos }),
      });
      const data = (await res.json().catch(() => ({}))) as { erro?: string };
      if (!res.ok) {
        toast.error(data.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      toast.success("Vídeo enviado! Os cortes vão aparecer em Meus vídeos. ✂️");
      router.push("/painel");
      router.refresh();
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {demo && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
          <Scissors className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">Modo demo:</span> cole
            qualquer link do YouTube e a gente gera{" "}
            <b className="text-foreground">2 cortes de 30s</b> pra você ver como
            funciona. 🙂
          </p>
        </div>
      )}

      {/* plataformas */}
      <div className="flex flex-wrap gap-2">
        {PLATAFORMAS.map((p) => (
          <span
            key={p.nome}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              p.ativo
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            <p.icon className="size-3.5" />
            {p.nome}
            {!p.ativo && <span className="opacity-70">· em breve</span>}
          </span>
        ))}
      </div>

      {/* link */}
      <div className="space-y-2">
        <Label htmlFor="link">Link do vídeo (YouTube)</Label>
        <div className="relative">
          <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="link"
            placeholder="https://youtube.com/watch?v=..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            inputMode="url"
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          A IA assiste o vídeo, escolhe os melhores momentos e devolve cortes 9:16
          prontos pro TikTok.
        </p>
      </div>

      {/* duração de cada corte (no demo é travado em 30s) */}
      {!demo && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Scissors className="size-4 text-primary" />
            <Label>Duração de cada corte</Label>
          </div>
          <Segmented options={DURACOES} value={dur} onChange={setDur} />
          <p className="text-[11px] text-muted-foreground">
            Cortes mais curtos ficam prontos bem mais rápido.
          </p>
        </div>
      )}

      {/* legenda */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Captions className="size-4 text-primary" />
            <span className="text-sm font-semibold">Gerar com legenda</span>
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setLegenda(false)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                !legenda ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => setLegenda(true)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                legenda ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              Sim
            </button>
          </div>
        </div>

        {legenda && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">Cor do destaque</Label>
              <div className="flex gap-2">
                {CORES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCor(c.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      cor === c.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span
                      className="size-4 rounded-full border border-white/20"
                      style={{ backgroundColor: c.swatch }}
                    />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Posição</Label>
              <Segmented options={POSICOES} value={pos} onChange={setPos} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              A legenda aparece palavra por palavra conforme a fala (estilo TikTok).
            </p>
          </div>
        )}
      </div>

      <Button
        type="button"
        size="lg"
        className="h-11 w-full"
        disabled={enviando}
        onClick={gerar}
      >
        {enviando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Scissors className="size-4" />
        )}
        {demo ? "Gerar meus 2 cortes (demo)" : "Gerar cortes"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Pode demorar alguns minutos (baixar + transcrever + cortar). Os cortes
        aparecem em <b className="text-foreground">Meus vídeos</b> quando ficarem prontos.
      </p>
    </div>
  );
}
