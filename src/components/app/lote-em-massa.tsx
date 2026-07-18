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
  Move,
  Maximize,
  BadgeCheck,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enviarJobEmPedacos } from "@/lib/upload-chunked";
import { CHAVE_FONTES_MARCA } from "@/lib/marca-lote-client";

// item da lista de vídeos: enviado pelo usuário (upload) OU vindo dos cards (servidor)
type ItemUpload = { id: string; kind: "upload"; file: File; url: string; nome: string };
type ItemServer = { id: string; kind: "server"; url: string; nome: string; thumb?: string };
type Item = ItemUpload | ItemServer;

const MAX_LOTE = 12;

// Amostra pronta do modo demo (assets servidos pela web).
const DEMO_TEMPLATE = "/templates/demo-randomlyy.png";
const DEMO_VIDEO = "/samples/demo-clip.mp4";

let _seq = 0;
const novoId = () => `l${(_seq += 1)}`;

const EXT_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function LoteEmMassa({ demo = false }: { demo?: boolean }) {
  const router = useRouter();

  const [template, setTemplate] = useState<File | null>(null);
  const [templateUrl, setTemplateUrl] = useState("");
  const [logoSalva, setLogoSalva] = useState(false); // veio da conta (não re-salvar)
  const [itens, setItens] = useState<Item[]>([]);
  const [audioVideo, setAudioVideo] = useState<"manter" | "remover">("manter");
  // como a marca é aplicada: "moldura" = PNG preenche a tela (9:16 inteiro);
  // "logo" = logo menor, com tamanho e posição escolhidos.
  const [modoMarca, setModoMarca] = useState<"moldura" | "logo">("moldura");
  const [marcaTamanho, setMarcaTamanho] = useState(40); // % da largura (só no modo logo)
  const [marcaPos, setMarcaPos] = useState("baixo-dir");

  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(0);

  // adota os vídeos que vieram dos cards (via "Colocar marca") + carrega a logo salva
  useEffect(() => {
    if (demo) return;
    try {
      const bruto = sessionStorage.getItem(CHAVE_FONTES_MARCA);
      if (bruto) {
        const lista = JSON.parse(bruto) as { url: string; nome?: string; thumb?: string }[];
        if (Array.isArray(lista) && lista.length) {
          const novos: ItemServer[] = lista.slice(0, MAX_LOTE).map((f) => ({
            id: novoId(),
            kind: "server",
            url: f.url,
            nome: (f.nome ?? "Vídeo").slice(0, 80),
            thumb: f.thumb,
          }));
          setItens(novos);
        }
      }
    } catch {
      /* seleção inválida - ignora */
    }
    sessionStorage.removeItem(CHAVE_FONTES_MARCA);

    // logo salva na conta: mostra a prévia e já deixa pronta pra reusar
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/marca-lote", { cache: "no-store" });
        if (!vivo || r.status !== 200) return;
        const blob = await r.blob();
        const ext = EXT_MIME[blob.type] ?? "png";
        const file = new File([blob], `logo.${ext}`, { type: blob.type || "image/png" });
        if (!vivo) return;
        setTemplate(file);
        setLogoSalva(true);
      } catch {
        /* sem logo salva - segue */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [demo]);

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

  // limpa as URLs (blob) dos uploads ao desmontar
  useEffect(() => {
    return () =>
      itens.forEach((v) => v.kind === "upload" && URL.revokeObjectURL(v.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addVideos = useCallback((lista: FileList | null) => {
    if (!lista?.length) return;
    const novos: ItemUpload[] = [];
    for (const file of Array.from(lista)) {
      if (!file.type.startsWith("video")) continue;
      novos.push({
        id: novoId(),
        kind: "upload",
        file,
        url: URL.createObjectURL(file),
        nome: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Vídeo",
      });
    }
    setItens((prev) => [...prev, ...novos]);
  }, []);

  function removerVideo(id: string) {
    setItens((prev) => {
      const alvo = prev.find((v) => v.id === id);
      if (alvo?.kind === "upload") URL.revokeObjectURL(alvo.url);
      return prev.filter((v) => v.id !== id);
    });
  }

  // ao escolher uma logo nova: usa e salva na conta (pra reusar da próxima vez)
  function escolherTemplate(file: File) {
    setTemplate(file);
    setLogoSalva(true);
    const fd = new FormData();
    fd.set("logo", file);
    fetch("/api/marca-lote", { method: "POST", body: fd })
      .then((r) => r.ok && toast.success("Logo salva na sua conta. 👍"))
      .catch(() => {});
  }

  function trocarLogo() {
    setTemplate(null);
    setLogoSalva(false);
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
    if (!template) return toast.error("Escolha a marca (sua logo/@).");
    if (itens.length === 0) return toast.error("Adicione pelo menos um vídeo.");

    const uploads = itens.filter((v): v is ItemUpload => v.kind === "upload");
    const servers = itens.filter((v): v is ItemServer => v.kind === "server");

    setEnviando(true);
    setFeito(0);
    let ok = 0;
    let falhou = 0;

    // 1) vídeos que a pessoa subiu -> upload em pedaços (aguenta arquivo grande)
    for (const v of uploads) {
      try {
        await enviarJobEmPedacos(
          {
            produto: v.nome,
            variantes: "1",
            audioVideo,
            tipo: "marca",
            marcaTamanho: String(tamEfetivo),
            marcaPosicao: marcaPos,
          },
          [
            { sub: "template", file: template },
            { sub: "videos", file: v.file },
          ],
        );
        ok += 1;
      } catch {
        falhou += 1;
      }
      setFeito((n) => n + 1);
    }

    // 2) vídeos vindos dos cards (servidor) -> um POST só; o servidor baixa e enfileira
    if (servers.length > 0) {
      try {
        const fd = new FormData();
        fd.set("template", template);
        fd.set("fontes", JSON.stringify(servers.map((s) => ({ url: s.url, nome: s.nome }))));
        fd.set("marcaTamanho", String(tamEfetivo));
        fd.set("marcaPosicao", marcaPos);
        fd.set("audioVideo", audioVideo);
        const res = await fetch("/api/lote-acervo", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          criados?: number;
          falhas?: number;
          erro?: string;
        };
        if (res.ok && data.ok) {
          ok += data.criados ?? 0;
          falhou += data.falhas ?? 0;
        } else {
          falhou += servers.length;
          if (data.erro) toast.error(data.erro);
        }
      } catch {
        falhou += servers.length;
      }
      setFeito((n) => n + servers.length);
    }

    setEnviando(false);

    if (ok > 0) {
      toast.success(
        `${ok} vídeo${ok > 1 ? "s" : ""} na fila com a sua marca! 🎬` +
          (falhou ? ` (${falhou} falhou)` : ""),
      );
      router.push("/painel");
      router.refresh();
    } else {
      toast.error("Não consegui enviar. Tente de novo.");
    }
  }

  const previa = itens[0];
  // tamanho efetivo: moldura sempre preenche (100%); logo usa o slider.
  const tamEfetivo = modoMarca === "moldura" ? 100 : marcaTamanho;

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
          {/* template sobreposto (moldura tela cheia OU logo posicionada) */}
          {templateUrl &&
            (tamEfetivo >= 100 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={templateUrl}
                alt="Template"
                className="pointer-events-none absolute inset-0 size-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={templateUrl}
                alt="Logo"
                className="pointer-events-none absolute object-contain"
                style={estiloMarca(tamEfetivo, marcaPos)}
              />
            ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Prévia de como a sua marca fica por cima do vídeo. O mesmo template vai
          em <b className="text-foreground">todos</b> os vídeos.
        </p>
      </div>

      {/* ===== PAINEL ===== */}
      <div className="space-y-5">
        {/* template */}
        <Secao icon={ImagePlus} titulo="Sua marca (logo ou moldura)">
          {template ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-[repeating-conic-gradient(#2a2f3a_0_25%,#1b1f27_0_50%)] bg-[length:14px_14px]">
                {templateUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={templateUrl} alt="" className="size-full object-contain" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {logoSalva ? "Sua logo salva" : template.name}
                </p>
                {logoSalva && (
                  <p className="flex items-center gap-1 text-[11px] text-primary">
                    <BadgeCheck className="size-3" />
                    Pronta pra reusar
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={trocarLogo}
                className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Trocar
              </button>
            </div>
          ) : (
            <PickerArquivo
              accept="image/*"
              onPick={(l) => l?.[0] && escolherTemplate(l[0])}
              label="Escolher imagem (PNG com fundo transparente)"
              icon={ImagePlus}
            />
          )}
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0 text-primary" />
            {modoMarca === "moldura"
              ? "Moldura: use um PNG 9:16 com fundo transparente. Ele preenche a tela toda."
              : "Logo: use um PNG só com a logo/@ (fundo transparente). Você escolhe o tamanho e a posição."}
          </p>
        </Secao>

        {/* como aplicar a marca: moldura (tela cheia) ou logo (posicionar) */}
        <Secao icon={Maximize} titulo="Como aplicar a marca">
          <div className="grid grid-cols-2 gap-2">
            <BotaoOpcao
              ativo={modoMarca === "moldura"}
              onClick={() => setModoMarca("moldura")}
              icon={Maximize}
              label="Moldura"
            />
            <BotaoOpcao
              ativo={modoMarca === "logo"}
              onClick={() => setModoMarca("logo")}
              icon={Move}
              label="Logo"
            />
          </div>

          {modoMarca === "moldura" ? (
            <p className="text-[11px] text-muted-foreground">
              O template preenche o vídeo inteiro (9:16), do jeito que você desenhou.
            </p>
          ) : (
            <div className="space-y-3 rounded-lg border border-border bg-card/50 p-3">
              {/* tamanho */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium">Tamanho</span>
                  <span className="text-muted-foreground">{marcaTamanho}% da largura</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={90}
                  step={5}
                  value={marcaTamanho}
                  onChange={(e) => setMarcaTamanho(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              {/* posição */}
              <div>
                <p className="mb-1.5 text-xs font-medium">Posição</p>
                <GradePosicao valor={marcaPos} onPick={setMarcaPos} />
              </div>
            </div>
          )}
        </Secao>

        {/* vídeos */}
        <Secao
          icon={Layers}
          titulo={`Vídeos (${itens.length})`}
          acao={
            <PickerBotao accept="video/*" multiple onPick={addVideos} label="Adicionar" />
          }
        >
          {itens.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhum vídeo ainda. Suba os seus ou use o botão &quot;Colocar marca&quot; nos
              vídeos Shopee.
            </p>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {itens.map((v) => (
                <li key={v.id} className="group relative aspect-[9/16] overflow-hidden rounded-md border border-border bg-black">
                  {v.kind === "server" && v.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumb} alt={v.nome} className="size-full object-cover" />
                  ) : (
                    <video src={`${v.url}#t=0.3`} muted preload="metadata" className="size-full object-cover" />
                  )}
                  {v.kind === "server" && (
                    <span className="absolute left-0.5 top-0.5 grid size-4 place-items-center rounded bg-primary/90 text-primary-foreground" title="Vídeo Shopee">
                      <ShoppingBag className="size-2.5" />
                    </span>
                  )}
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
            ? `Enviando ${feito}/${itens.length}...`
            : `Gerar ${itens.length || ""} vídeo${itens.length === 1 ? "" : "s"} com a marca`}
        </Button>
      </div>
    </div>
  );
}

/* ---------- auxiliares ---------- */

// as 9 posições (vertical-horizontal). Bate com o worker (carimbar_gpu).
const POSICOES = [
  "cima-esq", "cima-meio", "cima-dir",
  "meio-esq", "meio-meio", "meio-dir",
  "baixo-esq", "baixo-meio", "baixo-dir",
] as const;

// estilo inline da logo no preview (espelha o que o worker faz no vídeo).
function estiloMarca(tam: number, pos: string): React.CSSProperties {
  const [v, h] = pos.split("-");
  const s: React.CSSProperties = { width: `${tam}%`, height: "auto" };
  if (h === "esq") s.left = "5%";
  else if (h === "dir") s.right = "5%";
  else s.left = "50%";
  if (v === "cima") s.top = "5%";
  else if (v === "baixo") s.bottom = "5%";
  else s.top = "50%";
  const tx = h === "meio" ? "-50%" : "0px";
  const ty = v === "meio" ? "-50%" : "0px";
  if (tx !== "0px" || ty !== "0px") s.transform = `translate(${tx}, ${ty})`;
  return s;
}

function GradePosicao({
  valor,
  onPick,
}: {
  valor: string;
  onPick: (p: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {POSICOES.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          aria-label={p}
          className={cn(
            "grid aspect-square place-items-center rounded-md border transition-colors",
            valor === p
              ? "border-primary bg-primary/15"
              : "border-border hover:border-primary/40",
          )}
        >
          <span
            className={cn(
              "size-2.5 rounded-full",
              valor === p ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}

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
