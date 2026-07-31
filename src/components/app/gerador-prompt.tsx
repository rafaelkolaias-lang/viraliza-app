"use client";

import { useRef, useState } from "react";
import {
  Braces,
  Camera,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Lock,
  PackageSearch,
  Smartphone,
  Sparkles,
  Text,
  UserRound,
  Volume2,
  VolumeX,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DURACOES, IDIOMAS_FALA, custoVideoAvatar } from "@/lib/avatar-modelo";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";

/**
 * GERADOR DE PROMPT: a pessoa sobe o avatar (opcional) + as fotos do produto, diz
 * o que quer, e a IA escreve o prompt perfeito seguindo a metodologia da aula
 * (identidade bloqueada, realismo sem cara de IA, formato UGC). Sai em texto
 * normal (UGC) ou JSON (melhor pra Gemini/Grok). Dá pra copiar ou jogar direto
 * no Vídeo livre com as imagens juntas.
 */

// a metodologia da aula, resumida em cards (o "conhecimento" visível pra pessoa)
const METODO = [
  {
    Icon: Lock,
    titulo: "Identidade bloqueada",
    texto:
      "Suas fotos viram referência rígida: o prompt PROÍBE a IA de inventar, recriar ou estilizar. Pessoa e produto idênticos, até no logo e na costura.",
  },
  {
    Icon: PackageSearch,
    titulo: "A IA descobre o produto",
    texto:
      "Ela olha suas fotos e entende sozinha o que é (creme, tênis, vestido...) e a melhor forma de mostrar: na mão, vestindo, passando no cabelo.",
  },
  {
    Icon: Camera,
    titulo: "Realismo sem cara de IA",
    texto:
      "Pele com poros de verdade, luz natural, celular na mão com leve tremida. Nada de CGI, cartoon nem retoque de beleza.",
  },
  {
    Icon: Smartphone,
    titulo: "Formato UGC 9:16",
    texto:
      "Vertical, estilo creator brasileiro, cenário real do dia a dia. O formato que converte na Shopee e no TikTok.",
  },
];

export function GeradorPrompt({
  onUsarNoLivre,
}: {
  // manda o prompt (e as imagens) direto pra aba Vídeo livre
  onUsarNoLivre?: (texto: string, midias: string[]) => void;
}) {
  const [avatarFoto, setAvatarFoto] = useState<string | null>(null);
  const [produtoFotos, setProdutoFotos] = useState<string[]>([]);
  const [descricao, setDescricao] = useState("");
  const [formato, setFormato] = useState<"normal" | "json">("normal");
  const [duracao, setDuracao] = useState<number>(10);
  const [comFala, setComFala] = useState(true);
  const [idioma, setIdioma] = useState("pt");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [copiado, setCopiado] = useState(false);

  const inputAvatar = useRef<HTMLInputElement>(null);
  const inputProduto = useRef<HTMLInputElement>(null);

  async function subirAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const foto = await normalizarImagem(f);
    if (!foto) {
      toast.error(ERRO_IMAGEM);
      return;
    }
    setAvatarFoto(foto);
  }

  async function subirProdutos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!arquivos.length) return;
    const lidos = await Promise.all(arquivos.map(normalizarImagem));
    const ok = lidos.filter((x): x is string => !!x);
    if (ok.length < lidos.length) toast.error(ERRO_IMAGEM);
    setProdutoFotos((prev) => [...prev, ...ok].slice(0, 3));
  }

  const temFoto = !!avatarFoto || produtoFotos.length > 0;

  async function gerar() {
    if (!temFoto) {
      toast.info("Suba ao menos 1 foto (do produto ou do avatar). 🙂");
      return;
    }
    setGerando(true);
    setResultado("");
    try {
      const r = await fetch("/api/avatar/gerar-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarFoto: avatarFoto ?? undefined,
          produtoFotos,
          descricao: descricao.trim() || undefined,
          formato,
          duracao,
          comFala,
          idioma,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { erro?: string; prompt?: string };
      if (!r.ok || !data.prompt) {
        toast.error(data.erro ?? "Não consegui gerar agora. Tente de novo.");
        return;
      }
      setResultado(data.prompt);
      toast.success("Prompt pronto! ✨");
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Prompt copiado!");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto manualmente.");
    }
  }

  function usarNoLivre() {
    if (!onUsarNoLivre || !resultado) return;
    const midias = [...(avatarFoto ? [avatarFoto] : []), ...produtoFotos].slice(0, 3);
    onUsarNoLivre(resultado, midias);
  }

  return (
    <div className="space-y-4">
      {/* ===== O MÉTODO (conhecimento da aula, bonito) ===== */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {METODO.map((m) => (
          <div key={m.titulo} className="rounded-2xl border border-border bg-card p-4">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <m.Icon className="size-4.5" />
            </span>
            <p className="mt-2.5 text-sm font-bold">{m.titulo}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.texto}</p>
          </div>
        ))}
      </div>

      {/* ===== FOTOS ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-sm font-semibold">Suas fotos</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Suba o produto (até 3 fotos) e, se quiser, a pessoa/avatar do vídeo. A IA analisa
          tudo pra escrever o prompt fiel.
        </p>
        <input ref={inputAvatar} type="file" accept="image/*" hidden onChange={subirAvatar} />
        <input
          ref={inputProduto}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={subirProdutos}
        />

        <div className="mt-3 flex flex-wrap items-start gap-4">
          {/* avatar (1, opcional) */}
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <UserRound className="size-3" />
              Avatar (opcional)
            </p>
            {avatarFoto ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatarFoto}
                  alt="Avatar"
                  className="size-20 rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setAvatarFoto(null)}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black"
                  aria-label="Remover avatar"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputAvatar.current?.click()}
                className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                <ImagePlus className="size-5" />
                <span className="text-[10px] font-medium">Subir</span>
              </button>
            )}
          </div>

          {/* produto (até 3) */}
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <PackageSearch className="size-3" />
              Produto (até 3)
            </p>
            <div className="flex flex-wrap gap-2">
              {produtoFotos.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Produto ${i + 1}`}
                    className="size-20 rounded-xl border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setProdutoFotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black"
                    aria-label="Remover foto"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {produtoFotos.length < 3 && (
                <button
                  type="button"
                  onClick={() => inputProduto.current?.click()}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                >
                  <ImagePlus className="size-5" />
                  <span className="text-[10px] font-medium">Adicionar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== O QUE VOCÊ QUER + OPÇÕES ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <p className="text-sm font-semibold">O que você quer no vídeo? (opcional)</p>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: ela na cozinha de manhã, mostra o produto animada e fala do desconto... (se deixar vazio, a IA decide a melhor cena)"
          maxLength={600}
          rows={2}
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* formato de saída */}
          <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
            <button
              type="button"
              onClick={() => setFormato("normal")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                formato === "normal"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Text className="size-3.5" />
              Normal (UGC)
            </button>
            <button
              type="button"
              onClick={() => setFormato("json")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                formato === "json"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Braces className="size-3.5" />
              JSON
            </button>
          </div>

          {/* duração */}
          <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
            {DURACOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDuracao(s)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  duracao === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}s
              </button>
            ))}
          </div>

          {/* fala */}
          <button
            type="button"
            onClick={() => setComFala((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              comFala
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {comFala ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            {comFala ? "Com fala" : "Sem fala"}
          </button>

          {comFala && (
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="rounded-full border border-border bg-transparent px-2.5 py-1.5 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus:border-primary"
              aria-label="Idioma da fala"
            >
              {IDIOMAS_FALA.map((i) => (
                <option key={i.chave} value={i.chave}>
                  {i.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          JSON funciona melhor no Gemini e no Grok direto. O Normal é o formato UGC pronto pro
          Vídeo livre. Gerar o prompt é grátis.
        </p>
      </div>

      {/* ===== GERAR ===== */}
      <button
        type="button"
        onClick={gerar}
        disabled={gerando}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
          temFoto && !gerando
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
            : "cursor-not-allowed bg-muted text-muted-foreground",
        )}
      >
        {gerando ? <Loader2 className="size-5 animate-spin" /> : <Wand2 className="size-5" />}
        {gerando ? "A IA está escrevendo seu prompt..." : "Gerar prompt com IA"}
      </button>

      {/* ===== RESULTADO ===== */}
      {resultado && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              Seu prompt está pronto
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copiar}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary/50"
              >
                {copiado ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                {copiado ? "Copiado!" : "Copiar"}
              </button>
              {onUsarNoLivre && (
                <button
                  type="button"
                  onClick={usarNoLivre}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Wand2 className="size-3.5" />
                  Usar no Vídeo livre
                </button>
              )}
            </div>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-3.5 text-xs leading-relaxed">
            {resultado}
          </pre>
          {formato === "normal" && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Toque em Usar no Vídeo livre pra gerar aqui mesmo ({custoVideoAvatar(duracao, comFala)}{" "}
              créditos), ou copie e use onde quiser.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
