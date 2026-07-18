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
  Check,
  ShoppingBag,
  Upload,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enviarJobEmPedacos } from "@/lib/upload-chunked";
import { CHAVE_FONTES_MARCA } from "@/lib/marca-lote-client";
import { AcervoPickerModal, type FonteAcervo } from "@/components/app/acervo-picker-modal";
import { maisVirais } from "@/app/actions/virais";

// item da lista de vídeos: enviado pelo usuário (upload) OU vindo da plataforma (servidor)
type ItemUpload = { id: string; kind: "upload"; file: File; url: string; nome: string };
type ItemServer = { id: string; kind: "server"; url: string; nome: string; thumb?: string };
type Item = ItemUpload | ItemServer;

// qual marca está escolhida no seletor
type MarcaSel = "moldura-ex" | "logo-ex" | "salva" | "upload" | null;

const MAX_LOTE = 12;

// exemplos prontos (servidos do public) - já mostram o que dá pra fazer
const EX_MOLDURA = "/marcas-exemplo/moldura.png";
const EX_LOGO = "/marcas-exemplo/logo.png";

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

/** Baixa uma imagem/vídeo do nosso próprio site e devolve como File (pra reusar no upload). */
async function comoFile(url: string, nomeBase: string): Promise<File | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const blob = await r.blob();
    const ext = EXT_MIME[blob.type] ?? "png";
    return new File([blob], `${nomeBase}.${ext}`, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

export function LoteEmMassa({ demo = false }: { demo?: boolean }) {
  const router = useRouter();

  const [template, setTemplate] = useState<File | null>(null);
  const [templateUrl, setTemplateUrl] = useState("");
  const [marcaSel, setMarcaSel] = useState<MarcaSel>(null);
  const [temSalva, setTemSalva] = useState(false); // já existe uma logo salva na conta
  const [carregandoMarca, setCarregandoMarca] = useState(false);

  const [itens, setItens] = useState<Item[]>([]);
  const [amostraUrl, setAmostraUrl] = useState(""); // vídeo real pra demonstrar a marca
  const [audioVideo, setAudioVideo] = useState<"manter" | "remover">("manter");
  // como a marca é aplicada: "moldura" = PNG preenche a tela (9:16 inteiro);
  // "logo" = logo menor, com tamanho e posição escolhidos.
  const [modoMarca, setModoMarca] = useState<"moldura" | "logo">("moldura");
  const [marcaTamanho, setMarcaTamanho] = useState(40); // % da largura (só no modo logo)
  const [marcaPos, setMarcaPos] = useState("baixo-dir");

  const [adicionarModo, setAdicionarModo] = useState<null | "escolha" | "plataforma">(null);
  const [previaId, setPreviaId] = useState<string | null>(null); // vídeo mostrado no preview
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(0);

  const fileVideoRef = useRef<HTMLInputElement>(null);
  const fileLogoRef = useRef<HTMLInputElement>(null);

  // ---- setup inicial (só produção): vídeos vindos dos cards + logo salva + amostra
  useEffect(() => {
    if (demo) return;
    let vivo = true;

    // 1) vídeos que vieram dos cards ("Colocar marca")
    try {
      const bruto = sessionStorage.getItem(CHAVE_FONTES_MARCA);
      if (bruto) {
        const lista = JSON.parse(bruto) as { url: string; nome?: string; thumb?: string }[];
        if (Array.isArray(lista) && lista.length) {
          setItens(
            lista.slice(0, MAX_LOTE).map((f) => ({
              id: novoId(),
              kind: "server" as const,
              url: f.url,
              nome: (f.nome ?? "Vídeo").slice(0, 80),
              thumb: f.thumb,
            })),
          );
        }
      }
    } catch {
      /* seleção inválida - ignora */
    }
    sessionStorage.removeItem(CHAVE_FONTES_MARCA);

    // 2) logo salva? seleciona ela; senão, começa mostrando a moldura de exemplo
    (async () => {
      const salva = await comoFile("/api/marca-lote", "logo");
      if (!vivo) return;
      if (salva) {
        setTemSalva(true);
        setTemplate(salva);
        setMarcaSel("salva");
      } else {
        const ex = await comoFile(EX_MOLDURA, "moldura-exemplo");
        if (!vivo || !ex) return;
        setTemplate(ex);
        setMarcaSel("moldura-ex");
        setModoMarca("moldura");
      }
    })();

    // 3) um vídeo real da plataforma pra demonstrar a marca por cima
    (async () => {
      try {
        const r = await maisVirais({ emAlta: true, pagina: 1, porPagina: 12 });
        const comArquivo = r.itens.find((v) => v.arquivo && /^https?:\/\//i.test(v.arquivo));
        if (vivo && comArquivo?.arquivo) setAmostraUrl(comArquivo.arquivo);
      } catch {
        /* sem amostra - o preview só mostra a marca */
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
    return () => itens.forEach((v) => v.kind === "upload" && URL.revokeObjectURL(v.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- seleção da marca (exemplos / salva) ----
  async function escolherMarca(qual: Exclude<MarcaSel, "upload" | null>) {
    setCarregandoMarca(true);
    try {
      if (qual === "moldura-ex") {
        const f = await comoFile(EX_MOLDURA, "moldura-exemplo");
        if (f) {
          setTemplate(f);
          setModoMarca("moldura");
          setMarcaSel("moldura-ex");
        }
      } else if (qual === "logo-ex") {
        const f = await comoFile(EX_LOGO, "logo-exemplo");
        if (f) {
          setTemplate(f);
          setModoMarca("logo");
          setMarcaSel("logo-ex");
        }
      } else if (qual === "salva") {
        const f = await comoFile("/api/marca-lote", "logo");
        if (f) {
          setTemplate(f);
          setMarcaSel("salva");
        }
      }
    } finally {
      setCarregandoMarca(false);
    }
  }

  // ao subir uma logo nova: usa, salva na conta e passa a ser a "minha marca"
  function subirLogo(file: File) {
    setTemplate(file);
    setMarcaSel("upload");
    setTemSalva(true);
    const fd = new FormData();
    fd.set("logo", file);
    fetch("/api/marca-lote", { method: "POST", body: fd })
      .then((r) => r.ok && toast.success("Logo salva na sua conta. 👍"))
      .catch(() => {});
  }

  // ---- vídeos ----
  const addUploads = useCallback((lista: FileList | null) => {
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
    setItens((prev) => [...prev, ...novos].slice(0, MAX_LOTE));
  }, []);

  function addPlataforma(fontes: FonteAcervo[]) {
    setItens((prev) => {
      const urls = new Set(prev.map((v) => (v.kind === "server" ? v.url : "")));
      const novos: ItemServer[] = fontes
        .filter((f) => !urls.has(f.url))
        .map((f) => ({ id: novoId(), kind: "server", url: f.url, nome: f.nome, thumb: f.thumb }));
      return [...prev, ...novos].slice(0, MAX_LOTE);
    });
    setAdicionarModo(null);
  }

  function removerVideo(id: string) {
    setItens((prev) => {
      const alvo = prev.find((v) => v.id === id);
      if (alvo?.kind === "upload") URL.revokeObjectURL(alvo.url);
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
    if (!template) return toast.error("Escolha a marca (sua logo/moldura).");
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

    // 2) vídeos da plataforma -> um POST só; o servidor baixa e enfileira
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

  // qual vídeo aparece no preview (clicável); cai no 1º se nenhum escolhido/removido
  const previa = itens.find((v) => v.id === previaId) ?? itens[0];
  const previewVideoUrl = previa?.url ?? amostraUrl;
  // tamanho efetivo: moldura sempre preenche (100%); logo usa o slider.
  const tamEfetivo = modoMarca === "moldura" ? 100 : marcaTamanho;

  // ===== MODO DEMO: amostra pronta (moldura + vídeo de exemplo) =====
  if (demo) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-black">
            <video src={DEMO_VIDEO} autoPlay loop muted playsInline className="size-full object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEMO_TEMPLATE}
              alt="Moldura @RANDOMLYY"
              className="pointer-events-none absolute inset-0 size-full object-contain"
            />
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Prévia: a moldura <b className="text-foreground">@RANDOMLYY</b> por cima do vídeo de exemplo.
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-primary">Modo demo:</span> já deixamos a moldura e
              um vídeo de exemplo prontos. É só clicar em gerar pra ver como sai. 🙂
            </p>
          </div>

          <Button type="button" size="lg" className="h-11 w-full" disabled={enviando} onClick={gerarDemo}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* ===== PRÉVIA ===== */}
      <div className="space-y-3">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-black">
          {previewVideoUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={previewVideoUrl}
              src={previewVideoUrl}
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
                Escolha a marca e adicione vídeos
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
          {!previa && templateUrl && (
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
              Exemplo
            </span>
          )}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          {previa
            ? itens.length > 1
              ? "Clique em qualquer vídeo abaixo pra ver ele aqui na moldura. O mesmo template vai em todos."
              : "Prévia da sua marca por cima do vídeo. O mesmo template vai em todos."
            : "Exemplo: é assim que a sua marca fica por cima do vídeo."}
        </p>
      </div>

      {/* ===== PAINEL ===== */}
      <div className="space-y-5">
        {/* 1. escolher a marca */}
        <Secao icon={ImagePlus} titulo="Sua marca">
          <div className="grid grid-cols-3 gap-2">
            <CardMarca
              ativo={marcaSel === "moldura-ex"}
              onClick={() => escolherMarca("moldura-ex")}
              img={EX_MOLDURA}
              label="Moldura"
              tag="exemplo"
            />
            <CardMarca
              ativo={marcaSel === "logo-ex"}
              onClick={() => escolherMarca("logo-ex")}
              img={EX_LOGO}
              label="Logo"
              tag="exemplo"
            />
            {temSalva ? (
              <CardMarca
                ativo={marcaSel === "salva" || marcaSel === "upload"}
                onClick={() => escolherMarca("salva")}
                img="/api/marca-lote"
                label="Minha marca"
                tag="salva"
              />
            ) : (
              <CardSubir onClick={() => fileLogoRef.current?.click()} />
            )}
          </div>
          {temSalva && (
            <button
              type="button"
              onClick={() => fileLogoRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Upload className="size-3.5 text-primary" />
              Trocar a minha logo
            </button>
          )}
          <input
            ref={fileLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subirLogo(f);
              e.target.value = "";
            }}
          />
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0 text-primary" />
            {carregandoMarca
              ? "Carregando a marca..."
              : modoMarca === "moldura"
                ? "Moldura: PNG 9:16 com fundo transparente, preenche a tela toda."
                : "Logo: PNG só com a logo/@ (fundo transparente). Você escolhe tamanho e posição."}
          </p>
        </Secao>

        {/* 2. como aplicar */}
        <Secao icon={Maximize} titulo="Como aplicar a marca">
          <div className="grid grid-cols-2 gap-2">
            <BotaoOpcao ativo={modoMarca === "moldura"} onClick={() => setModoMarca("moldura")} icon={Maximize} label="Moldura" />
            <BotaoOpcao ativo={modoMarca === "logo"} onClick={() => setModoMarca("logo")} icon={Move} label="Logo" />
          </div>

          {modoMarca === "logo" && (
            <div className="space-y-3 rounded-lg border border-border bg-card/50 p-3">
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
              <div>
                <p className="mb-1.5 text-xs font-medium">Posição</p>
                <GradePosicao valor={marcaPos} onPick={setMarcaPos} />
              </div>
            </div>
          )}
        </Secao>

        {/* 3. vídeos */}
        <Secao
          icon={Layers}
          titulo={`Vídeos (${itens.length})`}
          acao={
            <Button type="button" size="sm" variant="outline" onClick={() => setAdicionarModo("escolha")}>
              <Plus className="size-4" />
              Adicionar
            </Button>
          }
        >
          {itens.length === 0 ? (
            <button
              type="button"
              onClick={() => setAdicionarModo("escolha")}
              className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-border p-5 text-center text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Plus className="size-5 text-primary" />
              Adicionar vídeos (da plataforma ou do seu aparelho)
            </button>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {itens.map((v) => {
                const noPreview = previa?.id === v.id;
                return (
                  <li key={v.id} className="group relative aspect-[9/16]">
                    <button
                      type="button"
                      onClick={() => setPreviaId(v.id)}
                      aria-label={`Ver ${v.nome} no preview`}
                      aria-pressed={noPreview}
                      className={cn(
                        "block size-full overflow-hidden rounded-md border bg-black transition-all",
                        noPreview ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50",
                      )}
                    >
                      {v.kind === "server" && v.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.thumb} alt={v.nome} className="size-full object-cover" />
                      ) : (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={`${v.url}#t=0.3`} muted preload="metadata" className="size-full object-cover" />
                      )}
                    </button>
                    {v.kind === "server" && (
                      <span className="pointer-events-none absolute left-0.5 top-0.5 grid size-4 place-items-center rounded bg-primary/90 text-primary-foreground" title="Vídeo da plataforma">
                        <ShoppingBag className="size-2.5" />
                      </span>
                    )}
                    {noPreview && (
                      <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-primary/90 px-1 text-[8px] font-bold uppercase text-primary-foreground">
                        No preview
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removerVideo(v.id);
                      }}
                      className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded bg-black/70 text-white opacity-80 hover:bg-destructive"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Secao>

        {/* 4. áudio */}
        <Secao icon={Volume2} titulo="Som original dos vídeos">
          <div className="grid grid-cols-2 gap-2">
            <BotaoOpcao ativo={audioVideo === "manter"} onClick={() => setAudioVideo("manter")} icon={Volume2} label="Manter" />
            <BotaoOpcao ativo={audioVideo === "remover"} onClick={() => setAudioVideo("remover")} icon={VolumeX} label="Mudo" />
          </div>
        </Secao>

        <Button type="button" size="lg" className="h-11 w-full" disabled={enviando} onClick={gerar}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {enviando
            ? `Enviando ${feito}/${itens.length}...`
            : `Gerar ${itens.length || ""} vídeo${itens.length === 1 ? "" : "s"} com a marca`}
        </Button>
        {itens.length > 0 && (
          <p className="text-center text-[11px] text-muted-foreground">
            Custa 50 créditos por vídeo ({itens.length * 50} no total).
          </p>
        )}
      </div>

      {/* input escondido pros vídeos do dispositivo */}
      <input
        ref={fileVideoRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addUploads(e.target.files);
          e.target.value = "";
        }}
      />

      {/* modal: escolher de onde vem o vídeo */}
      {adicionarModo === "escolha" && (
        <div
          className="fixed inset-0 z-[65] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setAdicionarModo(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Adicionar vídeos</h3>
              <button
                type="button"
                onClick={() => setAdicionarModo(null)}
                aria-label="Fechar"
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">De onde você quer trazer os vídeos?</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdicionarModo("plataforma")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary/12 text-primary">
                  <ShoppingBag className="size-5" />
                </span>
                <span className="text-sm font-semibold">Da plataforma</span>
                <span className="text-[11px] text-muted-foreground">Vídeos de produto Shopee que já temos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdicionarModo(null);
                  fileVideoRef.current?.click();
                }}
                className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
              >
                <span className="grid size-11 place-items-center rounded-full bg-primary/12 text-primary">
                  <Smartphone className="size-5" />
                </span>
                <span className="text-sm font-semibold">Do meu aparelho</span>
                <span className="text-[11px] text-muted-foreground">Subir vídeos do seu celular ou PC</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal: grade de vídeos da plataforma */}
      <AcervoPickerModal
        aberto={adicionarModo === "plataforma"}
        onFechar={() => setAdicionarModo(null)}
        jaSelecionados={itens.filter((v) => v.kind === "server").map((v) => v.url)}
        limite={MAX_LOTE}
        onConfirmar={addPlataforma}
      />
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

function CardMarca({
  ativo,
  onClick,
  img,
  label,
  tag,
}: {
  ativo: boolean;
  onClick: () => void;
  img: string;
  label: string;
  tag: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border p-1.5 transition-all",
        ativo ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded bg-[repeating-conic-gradient(#2a2f3a_0_25%,#1b1f27_0_50%)] bg-[length:12px_12px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={label} className="size-full object-contain" />
        <span
          className={cn(
            "absolute right-1 top-1 grid size-4 place-items-center rounded-full border transition-colors",
            ativo ? "border-primary bg-primary text-primary-foreground" : "border-white/60 bg-black/40 text-transparent",
          )}
        >
          <Check className="size-3" />
        </span>
      </div>
      <span className="mt-1 truncate text-[11px] font-medium">{label}</span>
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{tag}</span>
    </button>
  );
}

function CardSubir({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-2 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <span className="grid size-8 place-items-center rounded-full bg-primary/12 text-primary">
        <Upload className="size-4" />
      </span>
      <span className="text-[11px] font-medium">Subir a minha</span>
    </button>
  );
}

function GradePosicao({ valor, onPick }: { valor: string; onPick: (p: string) => void }) {
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
            valor === p ? "border-primary bg-primary/15" : "border-border hover:border-primary/40",
          )}
        >
          <span className={cn("size-2.5 rounded-full", valor === p ? "bg-primary" : "bg-muted-foreground/40")} />
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
