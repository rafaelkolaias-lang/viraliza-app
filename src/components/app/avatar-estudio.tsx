"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ImagePlus,
  Check,
  X,
  Clapperboard,
  Users,
  UserRound,
  Plus,
  ZoomIn,
  Copy,
  ClipboardCheck,
  Loader2,
  Clock,
  Wand2,
  Home,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { APRESENTACOES, DURACOES, CENARIOS, custoVideoAvatar } from "@/lib/avatar-modelo";

/**
 * FRONT do "Vídeo com avatar" (criador estilo UGC). A pessoa escolhe um avatar,
 * manda as fotos do produto (o Gemini analisa e descreve o produto pra afinar o
 * prompt), escolhe como o produto aparece e a fala. A geração da imagem/vídeo
 * ("motor") chega depois; por ora o botão monta o prompt (admin vê e copia).
 */

const AVATARES = [
  { id: "ana", nome: "Ana", src: "/avatares/ana.png" },
  { id: "lucas", nome: "Lucas", src: "/avatares/lucas.png" },
  { id: "cleide", nome: "Cleide", src: "/avatares/cleide.png" },
  { id: "isabela", nome: "Isabela", src: "/avatares/isabela.png" },
  { id: "marina", nome: "Marina", src: "/avatares/marina.png" },
  { id: "taina", nome: "Tainá", src: "/avatares/taina.png" },
  { id: "jefferson", nome: "Jefferson", src: "/avatares/jefferson.png" },
  { id: "rodrigo", nome: "Rodrigo", src: "/avatares/rodrigo.png" },
];

type Analise = { nome: string; tipo: string; descricao: string; sugestao: string };
type MeuAvatar = { id: string; nome: string; imagemUrl: string };

function lerDataUrl(file: File): Promise<string> {
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(file);
  });
}

/** Cabeçalho de seção: bolinha numerada + título (+ conteúdo à direita). */
function Secao({
  n,
  titulo,
  children,
}: {
  n: number;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {n}
      </span>
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {children}
    </div>
  );
}

export function AvatarEstudio({
  meusAvatares = [],
  admin = false,
}: {
  meusAvatares?: MeuAvatar[];
  admin?: boolean;
}) {
  const [modo, setModo] = useState<"prontos" | "meus">("prontos");
  const [avatarSel, setAvatarSel] = useState<string | null>(null);
  const [produtoFotos, setProdutoFotos] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [apresentacao, setApresentacao] = useState<string>("");
  const [gerarClose, setGerarClose] = useState(true);
  const [cenario, setCenario] = useState<string>("sala");
  const [duracao, setDuracao] = useState<number>(6);
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [promptFinal, setPromptFinal] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const inputProduto = useRef<HTMLInputElement>(null);
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // limpa o timer de progresso se sair da tela no meio da geração
  useEffect(() => {
    return () => {
      if (progRef.current) clearInterval(progRef.current);
    };
  }, []);

  async function adicionarProdutos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (!arquivos.length) return;
    e.target.value = "";
    const lidos = await Promise.all(arquivos.map(lerDataUrl));
    setProdutoFotos((prev) => [...prev, ...lidos].slice(0, 3));
    // trocou as fotos: zera a análise antiga
    setAnalise(null);
  }
  function removerProduto(i: number) {
    setProdutoFotos((prev) => prev.filter((_, idx) => idx !== i));
    setAnalise(null);
  }

  async function analisar() {
    if (!produtoFotos.length) return;
    setAnalisando(true);
    try {
      const r = await fetch("/api/avatar/analisar-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagens: produtoFotos }),
      });
      const data = (await r.json().catch(() => ({}))) as { erro?: string; analise?: Analise };
      if (!r.ok || !data.analise) {
        toast.error(data.erro ?? "Não consegui analisar agora.");
        return;
      }
      setAnalise(data.analise);
      // se ainda não escolheu como aparece, já sugere pela análise
      if (!apresentacao && APRESENTACOES.some((x) => x.chave === data.analise!.sugestao)) {
        setApresentacao(data.analise.sugestao);
      }
      // se o título ainda tá vazio, já sugere o nome que a IA detectou
      if (!titulo.trim() && data.analise.nome) setTitulo(data.analise.nome);
      toast.success("Produto analisado! ✨");
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setAnalisando(false);
    }
  }

  const temAvatar = !!avatarSel;
  const pronto = temAvatar && produtoFotos.length > 0 && !!apresentacao;

  function trocarModo(m: "prontos" | "meus") {
    setModo(m);
    setAvatarSel(null); // limpa a seleção ao trocar a fonte de avatares
  }

  // URL da imagem do avatar escolhido (pronto = arquivo local; meu = serverrk)
  function avatarUrlSel(): string | null {
    if (!avatarSel) return null;
    if (modo === "prontos") return AVATARES.find((a) => a.id === avatarSel)?.src ?? null;
    return meusAvatares.find((a) => a.id === avatarSel)?.imagemUrl ?? null;
  }

  async function gerar() {
    if (!pronto) {
      toast.info("Escolha o avatar, as fotos do produto e como ele aparece. 🙂");
      return;
    }
    const avatarUrl = avatarUrlSel();
    if (!avatarUrl) {
      toast.info("Escolha um avatar. 🙂");
      return;
    }
    setGerando(true);
    setVideoUrl(null);
    // progresso estimado pelo tempo (não dá pra ler o % real do Grok neste request):
    // sobe rápido e desacelera, travando em ~94% até o vídeo chegar de verdade.
    setProgresso(2);
    const t0 = Date.now();
    if (progRef.current) clearInterval(progRef.current);
    progRef.current = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setProgresso(Math.min(94, Math.max(2, Math.round(100 * (1 - Math.exp(-s / 75))))));
    }, 700);
    try {
      const produtoNome = analise
        ? [analise.nome, analise.tipo].filter(Boolean).join(" - ")
        : "";
      const r = await fetch("/api/avatar/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarUrl,
          produtoFotos,
          apresentacao,
          cenario,
          gerarClose,
          duracao,
          produtoNome,
          titulo,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        erro?: string;
        prompt?: string;
        videoUrl?: string;
        faltaCreditos?: boolean;
        custo?: number;
      };
      if (!r.ok || !data.videoUrl) {
        toast.error(
          data.faltaCreditos
            ? `Você precisa de ${data.custo ?? custoVideoAvatar(duracao)} créditos pra gerar esse vídeo.`
            : data.erro ?? "Não consegui gerar o vídeo. Tente de novo.",
        );
        if (data.prompt) setPromptFinal(data.prompt);
        return;
      }
      if (data.prompt) setPromptFinal(data.prompt);
      setProgresso(100);
      setVideoUrl(data.videoUrl);
      toast.success("Vídeo pronto! 🎬");
    } catch {
      toast.error("Sem conexão ou o robô demorou demais. Tente de novo.");
    } finally {
      if (progRef.current) clearInterval(progRef.current);
      progRef.current = null;
      setGerando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* ===== HERÓI ===== */}
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-primary/12 via-card to-background p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Vídeo com avatar
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Um avatar apresentando o{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
              seu produto
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Escolha um avatar, mande as fotos do produto e gere o vídeo. A IA
            analisa o produto pra deixar tudo mais fiel.
          </p>
        </div>
      </div>

      {/* ===== 1. AVATAR ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={1} titulo="Seu avatar" />

        <div className="mt-3 grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => trocarModo("prontos")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors",
              modo === "prontos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="size-3.5" />
            Avatares prontos
          </button>
          <button
            type="button"
            onClick={() => trocarModo("meus")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors",
              modo === "meus" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <UserRound className="size-3.5" />
            Meus avatares
          </button>
        </div>

        {modo === "prontos" ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {AVATARES.map((a) => {
              const sel = avatarSel === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarSel(a.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border transition-all",
                    sel ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.src} alt={a.nome} className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6 text-center text-sm font-semibold text-white">
                    {a.nome}
                  </span>
                  {sel && (
                    <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : meusAvatares.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {meusAvatares.map((a) => {
              const sel = avatarSel === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarSel(a.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border transition-all",
                    sel ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imagemUrl} alt={a.nome} className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6 text-center text-sm font-semibold text-white">
                    {a.nome}
                  </span>
                  {sel && (
                    <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <UserRound className="size-6" />
            </span>
            <p className="font-medium">Você ainda não criou avatares</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crie o seu na aba Meus avatares pra ele aparecer aqui.
            </p>
            <Link
              href="/painel/meus-avatares"
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Criar avatar
            </Link>
          </div>
        )}
      </div>

      {/* ===== 2. PRODUTO ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={2} titulo="Fotos do produto" />
        <input
          ref={inputProduto}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={adicionarProdutos}
        />
        <div className="mt-4 grid max-w-sm grid-cols-3 gap-3">
          {produtoFotos.map((src, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Produto ${i + 1}`} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => removerProduto(i)}
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-lg bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
                aria-label="Remover"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {produtoFotos.length < 3 && (
            <button
              type="button"
              onClick={() => inputProduto.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              <ImagePlus className="size-6" />
              <span className="text-[11px] font-medium">Adicionar</span>
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Até 3 fotos. Mais ângulos = produto mais fiel. Fundo limpo funciona melhor.
        </p>

        {/* análise com Gemini */}
        {produtoFotos.length > 0 && (
          <div className="mt-3">
            {!analise ? (
              <button
                type="button"
                onClick={analisar}
                disabled={analisando}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-60"
              >
                {analisando ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {analisando ? "Analisando o produto..." : "Analisar produto com IA"}
              </button>
            ) : (
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3.5" />
                    Analisado com IA
                  </span>
                  <button
                    type="button"
                    onClick={analisar}
                    disabled={analisando}
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    {analisando ? "..." : "Analisar de novo"}
                  </button>
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {analise.nome || "Produto"}
                  {analise.tipo && (
                    <span className="ml-1.5 font-normal text-muted-foreground">· {analise.tipo}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A IA já sabe o que é. Isso entra no prompt pra ela anunciar certo.
                </p>
              </div>
            )}
          </div>
        )}

        {/* título do produto (entra na fala da avatar) */}
        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">
            Título do produto <span className="font-normal">(opcional)</span>
          </label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Fone Bluetooth à prova d'água"
            maxLength={160}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            A avatar cita esse nome na fala. Deixe do jeito que você anuncia.
          </p>
        </div>
      </div>

      {/* ===== 3. COMO O PRODUTO APARECE ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={3} titulo="Como o produto aparece" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {APRESENTACOES.map((a) => {
            const ativo = apresentacao === a.chave;
            return (
              <button
                key={a.chave}
                type="button"
                onClick={() => setApresentacao(a.chave)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                  ativo ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                {a.label}
                {ativo && <Check className="size-4 shrink-0" strokeWidth={3} />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setGerarClose((v) => !v)}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/50"
        >
          <span
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
              gerarClose ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            {gerarClose && <Check className="size-3.5" strokeWidth={3} />}
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <ZoomIn className="size-4 text-muted-foreground" />
            Gerar também um close no produto
          </span>
        </button>
      </div>

      {/* ===== 4. CENÁRIO ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={4} titulo="Cenário do vídeo" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CENARIOS.map((c) => {
            const ativo = cenario === c.chave;
            return (
              <button
                key={c.chave}
                type="button"
                onClick={() => setCenario(c.chave)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                  ativo ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                {c.label}
                {ativo && <Check className="size-4 shrink-0" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Home className="size-3.5" />
          Onde a cena acontece: casa de gente de verdade, do dia a dia.
        </p>
      </div>

      {/* ===== 5. DURAÇÃO ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={5} titulo="Duração do vídeo" />
        <div className="mt-4 flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {DURACOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDuracao(s)}
                className={cn(
                  "rounded-lg px-5 py-1.5 text-sm font-semibold transition-colors",
                  duracao === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          A IA vai <span className="font-medium text-foreground">anunciar seu produto sozinha</span>,
          no tempo escolhido. Você não precisa escrever nada.
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="font-bold text-primary">{custoVideoAvatar(duracao)} créditos</span>
          <span className="text-muted-foreground">por vídeo (6s = 250, 10s = 300)</span>
        </p>
      </div>

      {/* ===== GERAR ===== */}
      <div>
        {admin ? (
          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
              pronto && !gerando
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            {gerando ? <Loader2 className="size-5 animate-spin" /> : <Clapperboard className="size-5" />}
            {gerando ? "Gerando o vídeo..." : "Gerar vídeo com avatar"}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-muted px-4 py-3.5 text-sm font-bold text-muted-foreground"
          >
            <Clapperboard className="size-5" />
            Em breve
          </button>
        )}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {!admin
            ? "A geração de vídeo com avatar chega em breve pra você. Monte tudo e já deixe pronto. 🚧"
            : gerando
              ? "A IA está gravando seu vídeo. Isso leva alguns minutos, pode deixar aberto. 🎬"
              : pronto
                ? `Tudo pronto! Toque pra gerar (${custoVideoAvatar(duracao)} créditos).`
                : "Escolha o avatar, as fotos do produto e como ele aparece pra liberar."}
        </p>

        {/* moldura de vídeo em blur enquanto gera, com o % subindo */}
        {gerando && !videoUrl && (
          <div className="mt-4">
            <div className="relative mx-auto aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-black">
              {/* fundo borrado tipo frame de vídeo */}
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary/40 via-emerald-500/15 to-background blur-2xl" />
              <div
                className="absolute inset-0 animate-pulse opacity-40 blur-2xl"
                style={{
                  background:
                    "radial-gradient(120% 80% at 50% 20%, rgba(16,185,129,0.35), transparent 60%)",
                  animationDuration: "2.6s",
                }}
              />

              {/* conteúdo central */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="relative grid size-14 place-items-center">
                  <span
                    className="absolute inset-0 animate-spin rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 15%, rgb(16 185 129), transparent 85%)",
                      animationDuration: "2.4s",
                    }}
                  />
                  <span className="relative grid size-11 place-items-center rounded-full bg-black/60 backdrop-blur">
                    <Clapperboard className="size-5 text-primary" />
                  </span>
                </span>
                <p className="text-4xl font-black tabular-nums text-white drop-shadow">
                  {progresso}%
                </p>
                <p className="text-xs font-medium text-white/85">
                  {progresso < 90 ? "Gravando seu vídeo..." : "Baixando..."}
                </p>
              </div>

              {/* barra de progresso embaixo */}
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/15">
                <div
                  className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Pode deixar essa tela aberta. Leva alguns minutinhos. 🎬
            </p>
          </div>
        )}

        {/* vídeo pronto */}
        {videoUrl && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Sparkles className="size-3.5" />
                Vídeo pronto
              </p>
              <a
                href={videoUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Download className="size-3.5" />
                Baixar
              </a>
            </div>
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="mx-auto max-h-[70vh] w-full bg-black"
            />
          </div>
        )}

        {/* prompt final (só admin) */}
        {promptFinal && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Prompt do vídeo · admin
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(promptFinal).then(() => {
                    setCopiado(true);
                    toast.success("Prompt copiado!");
                    setTimeout(() => setCopiado(false), 2000);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-primary/50 hover:text-primary"
              >
                {copiado ? <ClipboardCheck className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <pre className="max-h-80 overflow-auto p-4 text-left text-[11px] leading-relaxed text-muted-foreground">
              {promptFinal}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
