"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Plus,
  Film,
  Trash2,
  Scissors,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Lock,
  Volume2,
  VolumeX,
  Music,
  Type,
  Layers,
  Package,
  Info,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/app/segmented";
import { MediaPicker } from "@/components/app/media-picker";
import { cn } from "@/lib/utils";
import { estimarCreditos } from "@/lib/precos";
import { VOZES, VOZ_PADRAO, type VozOpcao } from "@/lib/vozes";
import { SeletorVoz } from "@/components/app/seletor-voz";

const FORMATOS = [
  { value: "legenda", label: "Legenda" },
  { value: "voz", label: "Voz narrada" },
] as const;
const TONS = [
  { value: "agressivo", label: "Agressivo" },
  { value: "equilibrado", label: "Equilibrado" },
  { value: "tranquilo", label: "Tranquilo" },
] as const;
const POSICOES = [
  { value: "cima", label: "Em cima" },
  { value: "meio", label: "No meio" },
  { value: "baixo", label: "Embaixo" },
] as const;

type Formato = (typeof FORMATOS)[number]["value"];
type Tom = (typeof TONS)[number]["value"];
type Posicao = (typeof POSICOES)[number]["value"];

type Clip = {
  id: string;
  file: File;
  url: string;
  kind: "video" | "image";
  dur: number;
  inSec: number;
  outSec: number;
};

type Texto = {
  id: string;
  conteudo: string;
  pos: Posicao;
  inSec: number; // na linha do tempo GERAL do vídeo
  outSec: number;
};

let _seq = 0;
function novoId() {
  _seq += 1;
  return `i${_seq}_${_seq * 7}`;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const DUR_IMAGEM = 3;

export function EditorEstudio({
  bloqueado = false,
  videoInicial,
  configInicial,
}: {
  bloqueado?: boolean;
  /** Vídeo já pronto que veio do "Editar esse vídeo" - carregado como 1º clipe. */
  videoInicial?: { url: string; nome: string };
  /** Ajustes de um vídeo anterior ("Reutilizar") - pré-preenche o formulário. */
  configInicial?: {
    nome: string;
    descricao: string;
    preco: string;
    formato: "legenda" | "voz";
    tom: string;
    legendaPos: string;
    voz?: string;
  };
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imgTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [clips, setClips] = useState<Clip[]>([]);
  const [sel, setSel] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0); // tempo dentro do clipe atual

  const [textos, setTextos] = useState<Texto[]>([]);

  // produto / IA (opcional)
  const [ehProduto, setEhProduto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [formato, setFormato] = useState<Formato>("legenda");
  const [tom, setTom] = useState<Tom>("agressivo");
  const [voz, setVoz] = useState<string>(VOZ_PADRAO);
  const [vozes, setVozes] = useState<VozOpcao[]>(VOZES);

  // áudio
  const [musica, setMusica] = useState<File[]>([]);
  const [musicaUrl, setMusicaUrl] = useState("");
  const [volumeMusica, setVolumeMusica] = useState(70);
  const [audioVideo, setAudioVideo] = useState<"manter" | "remover">("manter");

  const [enviando, setEnviando] = useState(false);

  const atual = clips[sel];
  const mudo = audioVideo === "remover";
  const conflitoAudio = ehProduto && formato === "voz" && audioVideo === "manter";

  // duração total (soma dos clipes já cortados) e tempo na linha geral
  const totalDur = clips.reduce((s, c) => s + (c.outSec - c.inSec), 0);
  const elapsedAntes = clips
    .slice(0, sel)
    .reduce((s, c) => s + (c.outSec - c.inSec), 0);
  const tGlobal = elapsedAntes + Math.max(0, tempo - (atual?.inSec ?? 0));
  const textosAtivos = textos.filter(
    (t) => t.conteudo.trim() && tGlobal >= t.inSec && tGlobal <= t.outSec,
  );

  function pararTimer() {
    if (imgTimer.current) {
      clearInterval(imgTimer.current);
      imgTimer.current = null;
    }
  }

  // object URL da música
  useEffect(() => {
    if (!musica[0]) {
      setMusicaUrl("");
      return;
    }
    const u = URL.createObjectURL(musica[0]);
    setMusicaUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [musica]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volumeMusica / 100;
  }, [volumeMusica, musicaUrl]);

  useEffect(() => {
    return () => {
      clips.forEach((c) => URL.revokeObjectURL(c.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // vozes do seletor: do usuário (chave própria) ou a lista curada (fallback)
  useEffect(() => {
    let vivo = true;
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d: { vozes?: VozOpcao[] }) => {
        if (!vivo || !d.vozes?.length) return;
        setVozes(d.vozes);
        setVoz((v) => (d.vozes!.some((o) => o.id === v) ? v : d.vozes![0].id));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // ---- mídia ----
  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const novos: Clip[] = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const ehVideo = file.type.startsWith("video");
      let dur = DUR_IMAGEM;
      if (ehVideo) {
        dur = await new Promise<number>((res) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => res(v.duration || 5);
          v.onerror = () => res(5);
          v.src = url;
        });
      }
      novos.push({
        id: novoId(),
        file,
        url,
        kind: ehVideo ? "video" : "image",
        dur,
        inSec: 0,
        outSec: dur,
      });
    }
    setClips((prev) => [...prev, ...novos]);
  }, []);

  const addArquivos = useCallback(
    (lista: FileList | null) => {
      if (lista?.length) addFiles(Array.from(lista));
    },
    [addFiles],
  );

  // "Editar esse vídeo": baixa o vídeo pronto e injeta como 1º clipe.
  // Ao gerar, sai um job NOVO (cópia) - o vídeo original nunca é alterado.
  const carregouInicial = useRef(false);
  useEffect(() => {
    if (carregouInicial.current || !videoInicial?.url) return;
    carregouInicial.current = true;
    (async () => {
      try {
        const res = await fetch(videoInicial.url);
        if (!res.ok) throw new Error("falhou");
        const blob = await res.blob();
        const file = new File([blob], `${videoInicial.nome || "video"}.mp4`, {
          type: blob.type || "video/mp4",
        });
        await addFiles([file]);
        toast.success("Vídeo carregado. Suas alterações geram uma cópia nova. 🎬");
      } catch {
        toast.error("Não consegui carregar esse vídeo pra edição.");
      }
    })();
  }, [videoInicial, addFiles]);

  // "Reutilizar": pré-preenche os ajustes de um vídeo anterior (mídia o usuário re-sobe).
  const aplicouConfig = useRef(false);
  useEffect(() => {
    if (aplicouConfig.current || !configInicial) return;
    aplicouConfig.current = true;
    setEhProduto(true);
    setNome(configInicial.nome);
    setDescricao(configInicial.descricao);
    setPreco(configInicial.preco);
    setFormato(configInicial.formato);
    setTom(configInicial.tom as Tom);
    if (configInicial.voz) setVoz(configInicial.voz);
    // (posição da legenda no editor é por-texto, não tem estado global)
    toast.info("Ajustes reaproveitados. Adicione as mídias e gere de novo. 🔁");
  }, [configInicial]);

  function removerClip(id: string) {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      URL.revokeObjectURL(prev[idx].url);
      const next = prev.filter((c) => c.id !== id);
      setSel((s) => Math.max(0, Math.min(s, next.length - 1)));
      return next;
    });
  }

  function mover(idx: number, dir: -1 | 1) {
    setClips((prev) => {
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[alvo]] = [next[alvo], next[idx]];
      return next;
    });
    setSel(idx + dir);
  }

  function setTrim(qual: "in" | "out", valor: number) {
    setClips((prev) =>
      prev.map((c, i) => {
        if (i !== sel) return c;
        if (qual === "in") return { ...c, inSec: Math.min(valor, c.outSec - 0.3) };
        return { ...c, outSec: Math.max(valor, c.inSec + 0.3) };
      }),
    );
  }

  // ---- textos ----
  function addTexto() {
    setTextos((prev) => [
      ...prev,
      {
        id: novoId(),
        conteudo: "",
        pos: "baixo",
        inSec: 0,
        outSec: totalDur > 0 ? Math.round(totalDur * 10) / 10 : 5,
      },
    ]);
  }
  function updTexto(id: string, patch: Partial<Texto>) {
    setTextos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function setTextoTempo(id: string, qual: "in" | "out", valor: number) {
    setTextos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (qual === "in") return { ...t, inSec: Math.min(valor, t.outSec - 0.2) };
        return { ...t, outSec: Math.max(valor, t.inSec + 0.2) };
      }),
    );
  }
  function removerTexto(id: string) {
    setTextos((prev) => prev.filter((t) => t.id !== id));
  }

  // ---- player ----
  const irPara = useCallback(
    (idx: number, auto: boolean) => {
      pararTimer();
      if (idx >= clips.length) {
        setTocando(false);
        audioRef.current?.pause();
        return;
      }
      setSel(idx);
      const c = clips[idx];
      setTempo(c.inSec);
      const v = videoRef.current;
      if (c.kind === "video" && v) {
        v.currentTime = c.inSec;
        if (auto) v.play().catch(() => {});
      } else if (c.kind === "image" && auto) {
        // tique pra o playhead/textos andarem durante a imagem
        imgTimer.current = setInterval(() => {
          setTempo((t) => {
            const nt = t + 0.1;
            if (nt >= c.outSec) {
              pararTimer();
              irPara(idx + 1, true);
              return c.outSec;
            }
            return nt;
          });
        }, 100);
      }
    },
    [clips],
  );

  function togglePlay() {
    if (!clips.length) return;
    if (tocando) {
      setTocando(false);
      videoRef.current?.pause();
      audioRef.current?.pause();
      pararTimer();
    } else {
      setTocando(true);
      if (audioRef.current && musicaUrl) {
        audioRef.current.currentTime = 0;
        audioRef.current.volume = volumeMusica / 100;
        audioRef.current.play().catch(() => {});
      }
      irPara(sel, true);
    }
  }

  useEffect(() => {
    const v = videoRef.current;
    if (atual?.kind === "video" && v) {
      v.src = atual.url;
      v.currentTime = atual.inSec;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id]);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !atual) return;
    setTempo(v.currentTime);
    if (v.currentTime >= atual.outSec) {
      if (tocando) irPara(sel + 1, true);
      else v.pause();
    }
  }

  // ---- enviar ----
  async function gerar() {
    if (bloqueado) {
      toast.info("Conta de demonstração não gera vídeos. 🙂");
      return;
    }
    if (clips.length === 0)
      return toast.error("Adicione pelo menos um clipe ou imagem.");
    if (ehProduto && nome.trim().length < 2)
      return toast.error("Dê um nome ao produto (ou desative 'É um produto?').");

    const titulo = ehProduto
      ? nome.trim()
      : textos.find((t) => t.conteudo.trim())?.conteudo.trim().slice(0, 60) ||
        "Vídeo livre";

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("produto", titulo);
      fd.set("ehProduto", ehProduto ? "1" : "0");
      if (ehProduto) {
        fd.set("descricao", descricao.trim());
        fd.set("preco", preco.trim());
        fd.set("formato", formato);
        fd.set("tom", tom);
        if (formato === "voz") fd.set("vozId", voz);
      }
      fd.set("variantes", "1");
      fd.set("audioVideo", audioVideo);
      fd.set("volumeMusica", String(volumeMusica));

      // textos (camada de legendas com posição + tempo)
      const textosLimpos = textos
        .filter((t) => t.conteudo.trim())
        .map((t) => ({
          texto: t.conteudo.trim(),
          pos: t.pos,
          in: Number(t.inSec.toFixed(2)),
          out: Number(t.outSec.toFixed(2)),
        }));
      fd.set("textos", JSON.stringify(textosLimpos));
      // compat com o worker atual (uma legenda + posição)
      fd.set("legendaPos", textosLimpos[0]?.pos ?? "baixo");
      if (textosLimpos[0]) fd.set("legenda", textosLimpos[0].texto);

      // roteiro (ordem + cortes)
      fd.set(
        "roteiro",
        JSON.stringify(
          clips.map((c, ordem) => ({
            nome: c.file.name,
            tipo: c.kind,
            ordem,
            in: Number(c.inSec.toFixed(2)),
            out: Number(c.outSec.toFixed(2)),
          })),
        ),
      );

      clips.forEach((c) => {
        if (c.kind === "video") fd.append("videos", c.file);
        else fd.append("imagens", c.file);
      });
      musica.forEach((f) => fd.append("musica", f));

      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { erro?: string };
      if (!res.ok) {
        toast.error(data.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      toast.success("Vídeo enviado pra fila! 🎬");
      router.push("/painel");
      router.refresh();
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <audio ref={audioRef} src={musicaUrl || undefined} className="hidden" />

      {/* ===== PALCO ===== */}
      <div className="space-y-4">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-black">
          {atual ? (
            atual.kind === "video" ? (
              <video
                ref={videoRef}
                src={atual.url}
                playsInline
                muted={mudo}
                onTimeUpdate={onTimeUpdate}
                onClick={togglePlay}
                className="size-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={atual.url}
                alt=""
                onClick={togglePlay}
                className="size-full object-contain"
              />
            )
          ) : (
            <div className="grid size-full place-items-center p-6 text-center text-sm text-muted-foreground">
              <span>
                <Film className="mx-auto mb-2 size-8 opacity-60" />
                Adicione clipes e imagens
                <br />
                pra montar seu vídeo
              </span>
            </div>
          )}

          {/* textos ao vivo (por posição) */}
          {atual &&
            (["cima", "meio", "baixo"] as Posicao[]).map((pos) => {
              const ts = textosAtivos.filter((t) => t.pos === pos);
              if (!ts.length) return null;
              return (
                <div
                  key={pos}
                  className={cn(
                    "pointer-events-none absolute inset-x-3 flex flex-col items-center gap-1",
                    pos === "cima" && "top-6",
                    pos === "meio" && "top-1/2 -translate-y-1/2",
                    pos === "baixo" && "bottom-10",
                  )}
                >
                  {ts.map((t) => (
                    <span
                      key={t.id}
                      className="rounded bg-black/50 px-2 py-1 text-center text-base font-extrabold uppercase leading-tight text-white [text-shadow:_0_2px_8px_rgba(0,0,0,0.9)]"
                    >
                      {t.conteudo}
                    </span>
                  ))}
                </div>
              );
            })}

          {atual && !tocando && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 grid place-items-center"
              aria-label="Tocar"
            >
              <span className="grid size-14 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
                <Play className="size-7 fill-white text-white" />
              </span>
            </button>
          )}
        </div>

        {/* controles + trim do clipe */}
        {atual && (
          <div className="mx-auto w-full max-w-[340px] space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={togglePlay}
              >
                {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fmt(tGlobal)} / {fmt(totalDur)}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Scissors className="size-3.5" />
                clipe {fmt(atual.outSec - atual.inSec)}
              </span>
            </div>

            <TrilhaCorte
              dur={atual.dur}
              inSec={atual.inSec}
              outSec={atual.outSec}
              tempo={tempo}
              onChange={setTrim}
              onScrub={(t) => {
                setTempo(t);
                if (atual.kind === "video" && videoRef.current)
                  videoRef.current.currentTime = t;
              }}
            />
            <p className="text-center text-[11px] text-muted-foreground">
              Arraste as alças <span className="text-primary">verdes</span> pra
              cortar o clipe.
            </p>
          </div>
        )}
      </div>

      {/* ===== PAINEL ===== */}
      <div className="space-y-5">
        {bloqueado && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-amber-500">Demo:</span> você
              edita e pré-visualiza à vontade; gerar fica na conta completa.
            </p>
          </div>
        )}

        {/* clipes */}
        <Secao
          icon={Layers}
          titulo={`Clipes (${clips.length})`}
          acao={<AddMidia onPick={addArquivos} />}
        >
          {clips.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhum clipe ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {clips.map((c, i) => (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border bg-card p-1.5",
                    i === sel ? "border-primary" : "border-border",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTocando(false);
                      pararTimer();
                      irPara(i, false);
                    }}
                    className="relative size-12 shrink-0 overflow-hidden rounded-md bg-black"
                  >
                    {c.kind === "video" ? (
                      <video
                        src={`${c.url}#t=0.3`}
                        muted
                        preload="metadata"
                        className="size-full object-cover"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.url} alt="" className="size-full object-cover" />
                    )}
                    <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                      {i + 1}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{c.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.kind === "video" ? "Vídeo" : "Imagem"} ·{" "}
                      {fmt(c.outSec - c.inSec)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Subir"
                    >
                      <ChevronLeft className="size-4 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === clips.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Descer"
                    >
                      <ChevronRight className="size-4 rotate-90" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removerClip(c.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* textos */}
        <Secao
          icon={Type}
          titulo={`Textos (${textos.length})`}
          acao={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addTexto}
              disabled={clips.length === 0}
            >
              <Plus className="size-4" />
              Texto
            </Button>
          }
        >
          {textos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              {clips.length === 0
                ? "Adicione clipes primeiro."
                : "Nenhum texto. Adicione e escolha posição e tempo."}
            </p>
          ) : (
            textos.map((t) => (
              <TextoBloco
                key={t.id}
                texto={t}
                totalDur={totalDur}
                tGlobal={tGlobal}
                onUpd={(patch) => updTexto(t.id, patch)}
                onTempo={(qual, v) => setTextoTempo(t.id, qual, v)}
                onRemover={() => removerTexto(t.id)}
              />
            ))
          )}
        </Secao>

        {/* áudio */}
        <Secao icon={Volume2} titulo="Áudio">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Som original do vídeo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <BotaoOpcao
                ativo={!mudo}
                onClick={() => setAudioVideo("manter")}
                icon={Volume2}
                label="Manter"
              />
              <BotaoOpcao
                ativo={mudo}
                onClick={() => setAudioVideo("remover")}
                icon={VolumeX}
                label="Mudo"
              />
            </div>
            {conflitoAudio && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200/90">
                <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                <span>
                  Com <b>voz narrada</b>, manter o som do vídeo pode embolar o
                  áudio. Sugerimos <b>Mudo</b>.
                </span>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Música de fundo (opcional)
            </p>
            <MediaPicker
              kind="audio"
              files={musica}
              onChange={setMusica}
              multiple={false}
              hint="A IA acha o melhor trecho automaticamente"
            />
            {musicaUrl && (
              <div className="mt-3 flex items-center gap-3">
                <Music className="size-4 shrink-0 text-primary" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volumeMusica}
                  onChange={(e) => setVolumeMusica(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer accent-primary"
                  aria-label="Volume da música"
                />
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                  {volumeMusica}%
                </span>
              </div>
            )}
          </div>
        </Secao>

        {/* produto (opcional) */}
        <Secao
          icon={Package}
          titulo="É um produto?"
          acao={
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setEhProduto(false)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  !ehProduto ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => setEhProduto(true)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  ehProduto ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                Sim
              </button>
            </div>
          }
        >
          {ehProduto ? (
            <>
              <Input
                placeholder="Nome do produto"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <Textarea
                rows={3}
                placeholder="Descrição (a IA escreve a copy a partir disso)"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
              <Input
                inputMode="decimal"
                placeholder="Preço (ex: 69,90)"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                className="max-w-40"
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Formato</Label>
                <Segmented options={FORMATOS} value={formato} onChange={setFormato} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tom</Label>
                <Segmented options={TONS} value={tom} onChange={setTom} />
              </div>
              {formato === "voz" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Voz da narração</Label>
                  <SeletorVoz vozes={vozes} value={voz} onChange={setVoz} />
                  <p className="text-[11px] text-muted-foreground">
                    Toque no play pra ouvir uma prévia antes de gerar.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ative se for divulgar um produto - a IA escreve a copy e as
              hashtags pra você. Pra um corte/meme comum, deixe no{" "}
              <b className="text-foreground">Não</b>.
            </p>
          )}
        </Secao>

        {clips.length > 0 && !bloqueado && (
          <p className="text-center text-xs text-muted-foreground">
            Usará{" "}
            <span className="font-semibold text-primary">
              no máximo{" "}
              {estimarCreditos(
                ehProduto ? formato : "legenda",
                totalDur,
              ).toLocaleString("pt-BR")}{" "}
              créditos
            </span>
          </p>
        )}

        <Button
          type="button"
          size="lg"
          className="h-11 w-full"
          disabled={enviando || bloqueado}
          onClick={gerar}
        >
          {bloqueado ? (
            <Lock className="size-4" />
          ) : enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {bloqueado ? "Indisponível na demo" : "Gerar vídeo"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- componentes auxiliares ---------------- */

function Secao({
  icon: Icon,
  titulo,
  acao,
  children,
}: {
  icon: typeof Volume2;
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{titulo}</h3>
        </div>
        {acao}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function BotaoOpcao({
  ativo,
  onClick,
  icon: Icon,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: typeof Volume2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        ativo
          ? "border-primary bg-primary/12 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function AddMidia({ onPick }: { onPick: (l: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => ref.current?.click()}
      >
        <Plus className="size-4" />
        Adicionar
      </Button>
      <input
        ref={ref}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** Bloco de um texto: conteúdo + posição + tempo (in/out na linha geral). */
function TextoBloco({
  texto,
  totalDur,
  tGlobal,
  onUpd,
  onTempo,
  onRemover,
}: {
  texto: Texto;
  totalDur: number;
  tGlobal: number;
  onUpd: (patch: Partial<Texto>) => void;
  onTempo: (qual: "in" | "out", valor: number) => void;
  onRemover: () => void;
}) {
  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <Textarea
          rows={2}
          placeholder="Texto que aparece no vídeo..."
          value={texto.conteudo}
          onChange={(e) => onUpd({ conteudo: e.target.value })}
          className="flex-1"
        />
        <button
          type="button"
          onClick={onRemover}
          className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Remover texto"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <Segmented
        options={POSICOES}
        value={texto.pos}
        onChange={(v) => onUpd({ pos: v as Posicao })}
      />

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3.5 text-primary" />
        aparece de <b className="text-foreground">{texto.inSec.toFixed(1)}s</b> a{" "}
        <b className="text-foreground">{texto.outSec.toFixed(1)}s</b>
      </div>
      <TrilhaCorte
        dur={Math.max(totalDur, 0.1)}
        inSec={texto.inSec}
        outSec={Math.min(texto.outSec, Math.max(totalDur, 0.1))}
        tempo={tGlobal}
        onChange={onTempo}
      />
    </div>
  );
}

/** Trilha com 2 alças (in/out) + playhead. Reaproveitada pra corte e pra tempo de texto. */
function TrilhaCorte({
  dur,
  inSec,
  outSec,
  tempo,
  onChange,
  onScrub,
}: {
  dur: number;
  inSec: number;
  outSec: number;
  tempo?: number;
  onChange: (qual: "in" | "out", valor: number) => void;
  onScrub?: (t: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<null | "in" | "out">(null);

  const pct = (s: number) => `${Math.max(0, Math.min(100, (s / dur) * 100))}%`;

  function posDoEvento(clientX: number) {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return x * dur;
  }

  function onDown(qual: "in" | "out", e: React.PointerEvent) {
    e.preventDefault();
    arrasto.current = qual;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!arrasto.current) return;
    onChange(arrasto.current, posDoEvento(e.clientX));
  }
  function onUp() {
    arrasto.current = null;
  }

  return (
    <div
      ref={trackRef}
      className="relative h-9 select-none rounded-lg bg-muted"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onClick={(e) => {
        if (!arrasto.current && onScrub) onScrub(posDoEvento(e.clientX));
      }}
    >
      <div
        className="absolute inset-y-0 rounded-lg bg-primary/20"
        style={{ left: pct(inSec), right: `calc(100% - ${pct(outSec)})` }}
      />
      {tempo !== undefined && (
        <div
          className="absolute inset-y-1 w-0.5 bg-white/80"
          style={{ left: pct(tempo) }}
        />
      )}
      <button
        type="button"
        onPointerDown={(e) => onDown("in", e)}
        className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded bg-primary text-primary-foreground shadow"
        style={{ left: pct(inSec) }}
        aria-label="Início"
      >
        <ChevronRight className="size-3" />
      </button>
      <button
        type="button"
        onPointerDown={(e) => onDown("out", e)}
        className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded bg-primary text-primary-foreground shadow"
        style={{ left: pct(outSec) }}
        aria-label="Fim"
      >
        <ChevronLeft className="size-3" />
      </button>
    </div>
  );
}
