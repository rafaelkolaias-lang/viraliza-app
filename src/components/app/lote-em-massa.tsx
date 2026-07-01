"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Film,
  Trash2,
  ImagePlus,
  Loader2,
  Sparkles,
  Volume2,
  VolumeX,
  Layers,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enviarJobEmPedacos } from "@/lib/upload-chunked";

type Video = { id: string; file: File; url: string };

// Amostra pronta do modo demo (assets servidos pela web).
const DEMO_TEMPLATE = "/templates/demo-randomlyy.png";
const DEMO_VIDEO = "/samples/demo-clip.mp4";

let _seq = 0;
const novoId = () => `l${(_seq += 1)}`;

export function LoteEmMassa({ demo = false }: { demo?: boolean }) {
  const router = useRouter();

  const [template, setTemplate] = useState<File | null>(null);
  const [templateUrl, setTemplateUrl] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [audioVideo, setAudioVideo] = useState<"manter" | "remover">("manter");

  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(0);

  // object URL do template
  useEffect(() => {
    if (!template) {
      setTemplateUrl("");
      return;
    }
    const u = URL.createObjectURL(template);
    setTemplateUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [template]);

  // limpa as URLs dos vídeos ao desmontar
  useEffect(() => {
    return () => videos.forEach((v) => URL.revokeObjectURL(v.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addVideos = useCallback((lista: FileList | null) => {
    if (!lista?.length) return;
    const novos: Video[] = [];
    for (const file of Array.from(lista)) {
      if (!file.type.startsWith("video")) continue;
      novos.push({ id: novoId(), file, url: URL.createObjectURL(file) });
    }
    setVideos((prev) => [...prev, ...novos]);
  }, []);

  function removerVideo(id: string) {
    setVideos((prev) => {
      const alvo = prev.find((v) => v.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return prev.filter((v) => v.id !== id);
    });
  }

  async function gerarDemo() {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("demoAmostra", "1");
      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { erro?: string };
      if (!res.ok) {
        toast.error(data.erro ?? "Não consegui gerar o exemplo.");
        return;
      }
      toast.success("Exemplo enviado! Vai aparecer em Meus vídeos. 🎬");
      router.push("/painel");
      router.refresh();
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  async function gerar() {
    if (!template) return toast.error("Escolha o template (sua logo/@).");
    if (videos.length === 0) return toast.error("Adicione pelo menos um vídeo.");

    setEnviando(true);
    setFeito(0);
    let ok = 0;
    let falhou = 0;
    for (const v of videos) {
      try {
        const base = v.file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Vídeo";
        // upload em pedaços: aguenta vídeo de qualquer tamanho (Cloudflare 100MB)
        await enviarJobEmPedacos({ produto: base, variantes: "1", audioVideo }, [
          { sub: "template", file: template },
          { sub: "videos", file: v.file },
        ]);
        ok += 1;
      } catch {
        falhou += 1;
      }
      setFeito((n) => n + 1);
    }
    setEnviando(false);

    if (ok > 0) {
      toast.success(
        `${ok} vídeo${ok > 1 ? "s" : ""} enviado${ok > 1 ? "s" : ""} pra fila! 🎬` +
          (falhou ? ` (${falhou} falhou)` : ""),
      );
      router.push("/painel");
      router.refresh();
    } else {
      toast.error("Não consegui enviar. Tente de novo.");
    }
  }

  const previa = videos[0];

  // ===== MODO DEMO: amostra pronta (moldura + vídeo de exemplo) =====
  if (demo) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-black">
            <video
              src={DEMO_VIDEO}
              autoPlay
              loop
              muted
              playsInline
              className="size-full object-contain"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEMO_TEMPLATE}
              alt="Moldura @RANDOMLYY"
              className="pointer-events-none absolute inset-0 size-full object-contain"
            />
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Prévia: a moldura <b className="text-foreground">@RANDOMLYY</b> por
            cima do vídeo de exemplo.
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">Modo demo:</span> já
              deixamos a moldura e um vídeo de exemplo prontos. É só clicar em
              gerar pra ver como sai. 🙂
            </p>
          </div>

          <Secao icon={ImagePlus} titulo="Moldura (já carregada)">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-[repeating-conic-gradient(#2a2f3a_0_25%,#1b1f27_0_50%)] bg-[length:14px_14px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={DEMO_TEMPLATE} alt="" className="size-full object-contain" />
              </div>
              <p className="min-w-0 flex-1 truncate text-xs font-medium">
                @RANDOMLYY_OFC
              </p>
            </div>
          </Secao>

          <Secao icon={Layers} titulo="Vídeo de exemplo (já escolhido)">
            <div className="overflow-hidden rounded-lg border border-border">
              <video
                src={DEMO_VIDEO}
                muted
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
              />
            </div>
          </Secao>

          <Button
            type="button"
            size="lg"
            className="h-11 w-full"
            disabled={enviando}
            onClick={gerarDemo}
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Gerar exemplo com a marca
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Na conta completa você sobe seus próprios vídeos e sua logo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ===== PRÉVIA ===== */}
      <div className="space-y-3">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-black">
          {previa ? (
            <video
              key={previa.id}
              src={previa.url}
              autoPlay
              loop
              muted
              playsInline
              className="size-full object-contain"
            />
          ) : (
            <div className="grid size-full place-items-center p-6 text-center text-sm text-muted-foreground">
              <span>
                <Film className="mx-auto mb-2 size-8 opacity-60" />
                Adicione vídeos pra ver
                <br />a marca aplicada
              </span>
            </div>
          )}
          {/* template sobreposto (logo/@) */}
          {templateUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={templateUrl}
              alt="Template"
              className="pointer-events-none absolute inset-0 size-full object-contain"
            />
          )}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Prévia de como a sua marca fica por cima do vídeo. O mesmo template vai
          em <b className="text-foreground">todos</b> os vídeos.
        </p>
      </div>

      {/* ===== PAINEL ===== */}
      <div className="space-y-5">
        {/* template */}
        <Secao icon={ImagePlus} titulo="Template (sua marca)">
          {template ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-[repeating-conic-gradient(#2a2f3a_0_25%,#1b1f27_0_50%)] bg-[length:14px_14px]">
                {templateUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={templateUrl} alt="" className="size-full object-contain" />
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-xs font-medium">
                {template.name}
              </p>
              <button
                type="button"
                onClick={() => setTemplate(null)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remover template"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ) : (
            <PickerArquivo
              accept="image/*"
              onPick={(l) => l?.[0] && setTemplate(l[0])}
              label="Escolher imagem (PNG com fundo transparente)"
              icon={ImagePlus}
            />
          )}
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0 text-primary" />
            Use um PNG 9:16 com fundo transparente, só com a logo/@ onde você quer
            que apareça.
          </p>
        </Secao>

        {/* vídeos */}
        <Secao
          icon={Layers}
          titulo={`Vídeos (${videos.length})`}
          acao={
            <PickerBotao accept="video/*" multiple onPick={addVideos} label="Adicionar" />
          }
        >
          {videos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhum vídeo ainda. Adicione vários de uma vez.
            </p>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {videos.map((v) => (
                <li key={v.id} className="group relative aspect-[9/16] overflow-hidden rounded-md border border-border bg-black">
                  <video src={`${v.url}#t=0.3`} muted preload="metadata" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removerVideo(v.id)}
                    className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded bg-black/70 text-white opacity-80 hover:bg-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* áudio */}
        <Secao icon={Volume2} titulo="Som original dos vídeos">
          <div className="grid grid-cols-2 gap-2">
            <BotaoOpcao ativo={audioVideo === "manter"} onClick={() => setAudioVideo("manter")} icon={Volume2} label="Manter" />
            <BotaoOpcao ativo={audioVideo === "remover"} onClick={() => setAudioVideo("remover")} icon={VolumeX} label="Mudo" />
          </div>
        </Secao>

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
            <Sparkles className="size-4" />
          )}
          {enviando
            ? `Enviando ${feito}/${videos.length}...`
            : `Gerar ${videos.length || ""} vídeo${videos.length === 1 ? "" : "s"} com a marca`}
        </Button>
      </div>
    </div>
  );
}

/* ---------- auxiliares ---------- */

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

function PickerBotao({
  accept,
  multiple = false,
  onPick,
  label,
}: {
  accept: string;
  multiple?: boolean;
  onPick: (l: FileList | null) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()}>
        <Plus className="size-4" />
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

function PickerArquivo({
  accept,
  onPick,
  label,
  icon: Icon,
}: {
  accept: string;
  onPick: (l: FileList | null) => void;
  label: string;
  icon: typeof Volume2;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Icon className="size-4 text-primary" />
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
