"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ImagePlus,
  Check,
  X,
  Clapperboard,
  Users,
  UserRound,
  ZoomIn,
  Loader2,
  Clock,
  Wand2,
  Home,
  Lightbulb,
  TriangleAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { APRESENTACOES, DURACOES, DURACAO_NOTA, CENARIOS, ESTILOS_VIDEO, custoVideoAvatar } from "@/lib/avatar-modelo";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import { VideoLivre } from "@/components/app/video-livre";
import { GeradorPrompt } from "@/components/app/gerador-prompt";

/**
 * FRONT do "Vídeo com avatar" (criador estilo UGC). A pessoa escolhe um avatar,
 * manda as fotos do produto (o Gemini analisa e descreve o produto pra afinar o
 * prompt), escolhe como o produto aparece e a fala. A geração da imagem/vídeo
 * ("motor") chega depois; por ora o botão monta o prompt (admin vê e copia).
 */

import { AVATARES_PRONTOS as AVATARES } from "@/lib/avatares-prontos";

type Analise = { nome: string; tipo: string; descricao: string; sugestao: string };
type MeuAvatar = { id: string; nome: string; imagemUrl: string; origem?: string };

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
}: {
  meusAvatares?: MeuAvatar[];
  admin?: boolean;
}) {
  // aba do estúdio: "guiado" (passo a passo), "livre" (chat) ou "prompt" (gerador)
  const [aba, setAba] = useState<"guiado" | "livre" | "prompt">("guiado");
  // prompt + imagens vindos do Gerador (pré-preenchem o Vídeo livre)
  const [livreInicial, setLivreInicial] = useState<{ texto: string; midias: string[] } | null>(null);
  const [modo, setModo] = useState<"prontos" | "meus">("prontos");
  // lista local: começa com os avatares salvos e cresce quando sobe um novo aqui
  const [avatares, setAvatares] = useState<MeuAvatar[]>(meusAvatares);
  const [subindoAvatar, setSubindoAvatar] = useState(false);
  const [avatarSel, setAvatarSel] = useState<string | null>(null);
  const [produtoFotos, setProdutoFotos] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [apresentacao, setApresentacao] = useState<string>("");
  const [estilo, setEstilo] = useState<string>("ugc");
  const [gerarClose, setGerarClose] = useState(true);
  const [cenario, setCenario] = useState<string>("sala");
  const [cenarioTexto, setCenarioTexto] = useState("");
  const [duracao, setDuracao] = useState<number>(6);
  const [comFala, setComFala] = useState(true);
  const [plataforma, setPlataforma] = useState<"carrinho" | "link">("carrinho");
  const [gerando, setGerando] = useState(false);

  const router = useRouter();
  const inputProduto = useRef<HTMLInputElement>(null);
  const inputAvatar = useRef<HTMLInputElement>(null);

  async function adicionarProdutos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    if (!arquivos.length) return;
    e.target.value = "";
    // converte TUDO pra JPEG de verdade (foto da Shopee/iPhone costuma ser
    // AVIF/HEIC com nome .jpg e o Grok recusa)
    const lidos = await Promise.all(arquivos.map(normalizarImagem));
    const ok = lidos.filter((x): x is string => !!x);
    if (ok.length < lidos.length) toast.error(ERRO_IMAGEM);
    if (!ok.length) return;
    setProdutoFotos((prev) => [...prev, ...ok].slice(0, 3));
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

  // 15s = 1 imagem só (manda a foto do avatar pro Grok animar). Mostra TODOS os
  // avatares do usuário; a dica avisa que fica melhor quando o avatar já tem o produto.
  const imagemUnica = duracao === 15;

  // troca de duração: ao ir pro 15s, força a fonte "meus" e limpa a seleção se ela
  // for um avatar pronto (o 15s usa os avatares do próprio usuário).
  function escolherDuracao(s: number) {
    setDuracao(s);
    if (s === 15) {
      setModo("meus");
      setAvatarSel((sel) => (avatares.some((a) => a.id === sel) ? sel : null));
    }
  }

  // sobe uma imagem de avatar pronta (grátis, sem IA) e já seleciona
  async function subirAvatarPronto(file?: File | null) {
    if (!file || subindoAvatar) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    setSubindoAvatar(true);
    try {
      const foto = await normalizarImagem(file);
      if (!foto) {
        toast.error(ERRO_IMAGEM);
        return;
      }
      const nome = (file.name.replace(/\.[^.]+$/, "").trim() || "Meu avatar").slice(0, 120);
      const res = await fetch("/api/avatar/subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, foto }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        erro?: string;
        avatar?: MeuAvatar;
      };
      if (!res.ok || !data.avatar) {
        toast.error(data.erro ?? "Não consegui subir o avatar.");
        return;
      }
      setAvatares((prev) => [data.avatar!, ...prev]);
      setModo("meus");
      setAvatarSel(data.avatar.id);
      toast.success("Avatar adicionado e selecionado! 🎉");
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setSubindoAvatar(false);
    }
  }

  // numeração dinâmica das seções (some produto/cenário no 15s)
  const ordem = imagemUnica
    ? ["avatar", "estilo", "titulo", "plataforma", "fala", "duracao"]
    : ["avatar", "produto", "aparece", "estilo", "cenario", "titulo", "plataforma", "fala", "duracao"];
  const nSecao = (k: string) => ordem.indexOf(k) + 1;

  const temAvatar = !!avatarSel;
  const pronto = imagemUnica
    ? temAvatar
    : temAvatar && produtoFotos.length > 0 && !!apresentacao;

  function trocarModo(m: "prontos" | "meus") {
    setModo(m);
    setAvatarSel(null); // limpa a seleção ao trocar a fonte de avatares
  }

  // URL da imagem do avatar escolhido (pronto = arquivo local; meu = serverrk)
  function avatarUrlSel(): string | null {
    if (!avatarSel) return null;
    if (modo === "prontos") return AVATARES.find((a) => a.id === avatarSel)?.src ?? null;
    return avatares.find((a) => a.id === avatarSel)?.imagemUrl ?? null;
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
    try {
      const produtoNome = analise
        ? [analise.nome, analise.tipo].filter(Boolean).join(" - ")
        : "";
      // 15s (imagemUnica): manda SÓ o avatar (que já tem produto+cenário) + título + fala.
      // 6s/10s: manda avatar + fotos do produto + como aparece + cenário (várias imagens).
      const payload = imagemUnica
        ? { avatarUrl, duracao, titulo, comFala, plataforma, estilo, qualidade: "720p", imagemUnica: true }
        : {
            avatarUrl,
            produtoFotos,
            apresentacao,
            estilo,
            cenario,
            cenarioTexto: cenario === "outros" ? cenarioTexto : undefined,
            gerarClose,
            duracao,
            produtoNome,
            titulo,
            comFala,
            plataforma,
            qualidade: "720p",
          };
      const r = await fetch("/api/avatar/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await r.json().catch(() => ({}))) as {
        erro?: string;
        prompt?: string;
        jobId?: string;
        faltaCreditos?: boolean;
        custo?: number;
      };
      if (!r.ok || !data.jobId) {
        toast.error(
          data.faltaCreditos
            ? `Você precisa de ${data.custo ?? custoVideoAvatar(duracao, comFala)} créditos pra gerar esse vídeo.`
            : data.erro ?? "Não consegui iniciar a geração. Tente de novo.",
        );
        return;
      }
      // disparou: a geração segue em background e o vídeo aparece em Meus vídeos
      toast.success("Vídeo em produção! 🎬 Ele aparece em Meus vídeos em 3 a 5 minutos.");
      router.push("/painel");
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
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
            {aba === "livre"
              ? "Anexe as imagens, escreva o vídeo do seu jeito e a IA gera. Você no controle total."
              : aba === "prompt"
                ? "Suba suas fotos e a IA escreve o prompt perfeito pra você, com a técnica dos profissionais."
                : "Escolha um avatar, mande as fotos do produto e gere o vídeo. A IA analisa o produto pra deixar tudo mais fiel."}
          </p>
        </div>
      </div>

      {/* ===== ABAS: modo guiado x vídeo livre x gerador de prompt ===== */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setAba("guiado")}
          className={cn(
            "rounded-xl py-2.5 text-sm font-bold transition-colors",
            aba === "guiado"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Modo guiado
        </button>
        <button
          type="button"
          onClick={() => setAba("livre")}
          className={cn(
            "rounded-xl py-2.5 text-sm font-bold transition-colors",
            aba === "livre"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Vídeo livre
        </button>
        <button
          type="button"
          onClick={() => setAba("prompt")}
          className={cn(
            "relative rounded-xl py-2.5 text-sm font-bold transition-colors",
            aba === "prompt"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Gerador de prompt
          <span className="absolute -top-1.5 right-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
            Novo
          </span>
        </button>
      </div>

      {aba === "prompt" ? (
        <GeradorPrompt
          onUsarNoLivre={(texto, midias) => {
            setLivreInicial({ texto, midias });
            setAba("livre");
          }}
        />
      ) : aba === "livre" ? (
        <VideoLivre
          key={livreInicial ? livreInicial.texto.slice(0, 40) : "vazio"}
          meusAvatares={avatares}
          prontos={AVATARES}
          textoInicial={livreInicial?.texto ?? ""}
          midiasIniciais={livreInicial?.midias ?? []}
        />
      ) : (
        <>

      {/* ===== 1. AVATAR ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("avatar")} titulo="Seu avatar" />
        {/* upload de avatar pronto (grátis): entra na lista e já fica selecionado */}
        <input
          ref={inputAvatar}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            subirAvatarPronto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {imagemUnica ? (
          // 15s: manda 1 imagem pro Grok. Mostra TODOS os avatares do usuário; a
          // dica avisa que fica melhor quando o avatar já está com o produto.
          <>
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3">
              <Sparkles className="size-5 shrink-0 text-primary" />
              <p className="text-sm text-foreground">
                No vídeo de <span className="font-bold">15s</span> a gente anima 1 imagem sua. Escolha
                um avatar abaixo. <span className="font-semibold">Fica melhor quando o avatar já está
                com o produto</span> (feito na opção Avatar com produto).
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* subir avatar pronto (grátis) */}
              <button
                type="button"
                onClick={() => inputAvatar.current?.click()}
                disabled={subindoAvatar}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-60"
              >
                {subindoAvatar ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
                    <ImagePlus className="size-5" />
                  </span>
                )}
                <span className="px-2 text-center text-xs font-semibold">
                  {subindoAvatar ? "Subindo..." : "Subir avatar (grátis)"}
                </span>
              </button>
              {avatares.map((a) => {
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
            {avatares.length === 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Suba a imagem do seu avatar acima, ou{" "}
                <Link href="/painel/meus-avatares" className="font-semibold text-primary hover:underline">
                  crie um em Meus avatares
                </Link>{" "}
                (melhor ainda com a opção Avatar com produto).
              </p>
            )}
          </>
        ) : (
          <>
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
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* subir avatar pronto (grátis) */}
                  <button
                    type="button"
                    onClick={() => inputAvatar.current?.click()}
                    disabled={subindoAvatar}
                    className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-60"
                  >
                    {subindoAvatar ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : (
                      <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
                        <ImagePlus className="size-5" />
                      </span>
                    )}
                    <span className="px-2 text-center text-xs font-semibold">
                      {subindoAvatar ? "Subindo..." : "Subir avatar (grátis)"}
                    </span>
                  </button>
                  {avatares.map((a) => {
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
                {avatares.length === 0 && (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Suba a imagem do seu avatar acima, ou{" "}
                    <Link href="/painel/meus-avatares" className="font-semibold text-primary hover:underline">
                      crie um em Meus avatares
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ===== PRODUTO (só 6s/10s; no 15s a imagem já tem o produto) ===== */}
      {!imagemUnica && (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("produto")} titulo="Fotos do produto" />
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

      </div>
      )}

      {/* ===== TÍTULO (sempre; a avatar cita na fala) ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("titulo")} titulo="Título do produto" />
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Fone Bluetooth à prova d'água"
          maxLength={160}
          className="mt-4 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          A avatar cita esse nome na fala. Deixe do jeito que você anuncia
          {imagemUnica ? " (opcional, mas ajuda muito no vídeo com fala)." : "."}
        </p>
      </div>

      {/* ===== COMO O PRODUTO APARECE (só 6s/10s) ===== */}
      {!imagemUnica && (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("aparece")} titulo="Como o produto aparece" />
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
      )}

      {/* ===== ESTILO DO VÍDEO (em todas as durações; no 15s vira fala/gestos) ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("estilo")} titulo="Estilo do vídeo" />
        {imagemUnica && (
          <p className="mt-2 text-xs text-muted-foreground">
            No 15s a cena vem da sua imagem: o estilo entra na fala e nos gestos do avatar.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ESTILOS_VIDEO.map((e) => {
            const ativo = estilo === e.chave;
            return (
              <button
                key={e.chave}
                type="button"
                onClick={() => setEstilo(e.chave)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-all",
                  ativo
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50 hover:bg-muted/40",
                )}
              >
                <span className={cn("flex items-center justify-between gap-1 text-sm font-medium", ativo && "text-primary")}>
                  {e.label}
                  {ativo && <Check className="size-4 shrink-0" strokeWidth={3} />}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {e.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== CENÁRIO (só 6s/10s; no 15s já está na imagem) ===== */}
      {!imagemUnica && (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("cenario")} titulo="Cenário do vídeo" />
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
          {/* Outros: a pessoa descreve o cenário que quiser */}
          <button
            type="button"
            onClick={() => setCenario("outros")}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
              cenario === "outros" ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50 hover:bg-muted/40",
            )}
          >
            Outros
            {cenario === "outros" && <Check className="size-4 shrink-0" strokeWidth={3} />}
          </button>
        </div>

        {cenario === "outros" ? (
          <div className="mt-3">
            <textarea
              value={cenarioTexto}
              onChange={(e) => setCenarioTexto(e.target.value)}
              placeholder="Descreva o cenário. Ex: numa academia treinando, andando na rua, na praia..."
              maxLength={300}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              A IA usa esse texto como o lugar da cena. Sem foto de referência aqui.
            </p>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Home className="size-3.5" />
            Onde a cena acontece. Escolha um pronto ou use Outros pra descrever.
          </p>
        )}
      </div>
      )}

      {/* ===== PLATAFORMA (muda o CTA final da fala) ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("plataforma")} titulo="Onde vai anunciar?" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            {
              v: "carrinho" as const,
              titulo: "Shopee / TikTok Shop",
              desc: 'Termina com "clique no carrinho laranja e aproveite a promoção".',
            },
            {
              v: "link" as const,
              titulo: "Link (bio, site, grupo)",
              desc: 'Termina com "corre lá no link, garante o seu".',
            },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setPlataforma(o.v)}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-all",
                plataforma === o.v
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              <span className={cn("block text-sm font-bold", plataforma === o.v && "text-primary")}>
                {o.titulo}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{o.desc}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Isso muda só o finzinho da fala (a chamada pra compra).
        </p>
      </div>

      {/* ===== FALA ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("fala")} titulo="O avatar vai falar?" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            {
              v: true,
              titulo: "Com fala",
              desc: "Ela anuncia o produto falando em português, com voz.",
              Icon: Volume2,
              selo: "Recomendado",
            },
            {
              v: false,
              titulo: "Sem fala",
              desc: "Vídeo MUDO: só mostra o produto (você põe voz/texto depois).",
              Icon: VolumeX,
              selo: null,
            },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setComFala(o.v)}
              className={cn(
                "relative rounded-xl border p-3.5 text-left transition-all",
                comFala === o.v
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              {o.selo && (
                <span className="absolute right-2.5 top-2.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {o.selo}
                </span>
              )}
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-lg",
                  comFala === o.v ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <o.Icon className="size-4.5" />
              </span>
              <span className={cn("mt-2 block text-sm font-bold", comFala === o.v && "text-primary")}>
                {o.titulo}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{o.desc}</span>
            </button>
          ))}
        </div>
        {!comFala && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
            <VolumeX className="size-5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <span className="font-bold">Atenção: o vídeo vai sair SEM som.</span> A avatar não
              fala nada. Escolha assim só se você for colocar sua própria voz ou música depois.
            </p>
          </div>
        )}
      </div>

      {/* ===== DURAÇÃO ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Secao n={nSecao("duracao")} titulo="Duração do vídeo" />
        <div className="mt-4 flex items-center gap-2">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {DURACOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => escolherDuracao(s)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                  duracao === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
        {/* obs da duração em destaque */}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3">
          <Lightbulb className="size-5 shrink-0 text-primary" />
          <p className="text-sm font-semibold text-foreground">{DURACAO_NOTA[duracao]}</p>
        </div>

        {/* aviso: com fala + 6s é curto demais pra uma fala boa */}
        {comFala && duracao === 6 && (
          <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-3">
            <TriangleAlert className="size-5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <span className="font-bold">6 segundos é curtinho pra fala.</span> A avatar
              mal vai conseguir anunciar o produto. Pra vídeo <span className="font-semibold">com fala</span>,
              use <span className="font-semibold">10s ou 15s</span>. Se quiser mesmo os 6s,
              o ideal é deixar <span className="font-semibold">sem fala</span>.
            </p>
          </div>
        )}

        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="font-bold text-primary">{custoVideoAvatar(duracao, comFala)} créditos</span>
          <span className="text-muted-foreground">
            {comFala ? "por vídeo com fala" : "por vídeo sem fala (mais barato)"}
          </span>
        </p>
      </div>

      {/* ===== GERAR ===== */}
      <div>
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
          {gerando ? "Enviando..." : "Gerar vídeo com avatar"}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {gerando
            ? "Colocando seu vídeo em produção..."
            : pronto
              ? `Tudo pronto! Toque pra gerar (${custoVideoAvatar(duracao, comFala)} créditos).`
              : imagemUnica
                ? "Escolha um Avatar com produto pra liberar."
                : "Escolha o avatar, as fotos do produto e como ele aparece pra liberar."}
        </p>

      </div>
        </>
      )}
    </div>
  );
}
