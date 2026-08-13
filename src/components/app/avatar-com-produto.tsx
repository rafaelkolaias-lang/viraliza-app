"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bed,
  ChefHat,
  Check,
  Coins,
  Dumbbell,
  Hand,
  Home,
  ImagePlus,
  Lamp,
  Loader2,
  Megaphone,
  Milestone,
  Package,
  Shirt,
  Smile,
  Sofa,
  Sparkles,
  Sun,
  UserRound,
  Warehouse,
  Wind,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTO_AVATAR, USOS_PRODUTO, CENARIOS } from "@/lib/avatar-modelo";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import { AVATARES_PRONTOS } from "@/lib/avatares-prontos";
import { midiaCenario } from "@/lib/lab-midia";
import type { AvatarCriado } from "@/lib/avatar-modelo";

/**
 * "Avatar com produto": junta uma PESSOA (avatar salvo OU foto enviada) com a foto
 * do PRODUTO e gera a imagem da pessoa usando o produto (segurando, passando no
 * rosto/cabelo...). POST /api/avatar/com-produto. A imagem entra na galeria.
 *
 * Virou um FUNIL de 4 etapas em 06/08/2026 (produto -> quem aparece -> ação ->
 * cenário), no padrão do "Criar criativo". Antes eram 7 blocos empilhados numa
 * página só, e a pessoa via o formulário inteiro de uma vez sem saber por onde
 * começar. O que vai pro servidor é EXATAMENTE o mesmo de antes.
 */

const PASSOS = [
  { n: 1, titulo: "Produto", Icone: Package },
  { n: 2, titulo: "Quem aparece", Icone: UserRound },
  { n: 3, titulo: "Ação", Icone: Hand },
  { n: 4, titulo: "Cenário", Icone: Home },
] as const;

/** Ícone de cada jeito de usar o produto (a lista de opções é só texto). */
const ICONE_USO: Record<string, LucideIcon> = {
  segurando: Hand,
  rosto: Smile,
  cabelo: Wind,
  vestindo: Shirt,
  mostrando: Megaphone,
};

/**
 * Foto de cada cenário DO MOTOR (as chaves de `CENARIOS`, que é o que o servidor
 * espera). O arquivo mora em `lab/cenarios/<nome>.jpg` no serverrk, e o nome nem
 * sempre bate com a chave: os mesmos lugares já tinham foto no Lab com outro nome
 * (ver o campo `motor` em CENARIOS_LAB). Cenário que ainda NÃO tem foto aponta
 * pro próprio nome: hoje dá 404 e o card cai no ícone, e no dia em que alguém
 * jogar `cozinha.jpg`, `penteadeira.jpg` e `rua.jpg` naquela pasta a foto aparece
 * sozinha, sem mexer em código (lembrando das 4h de cache da Cloudflare).
 */
const FOTO_CENARIO: Record<string, string> = {
  sala: "casa",
  sala_tijolo: "casa_simples",
  quintal: "ar_livre",
  quarto: "quarto",
  academia: "academia",
};

const ICONE_CENARIO: Record<string, LucideIcon> = {
  sala: Sofa,
  sala_tijolo: Warehouse,
  cozinha: ChefHat,
  quarto: Bed,
  quintal: Sun,
  penteadeira: Lamp,
  academia: Dumbbell,
  rua: Milestone,
};

type Genero = "female" | "male";

export function AvatarComProduto({
  avatares = [],
  onSair,
  onCriado,
}: {
  avatares?: AvatarCriado[];
  onSair: () => void;
  onCriado?: (a: AvatarCriado) => void;
}) {
  // pessoas selecionáveis: os avatares DA PESSOA + os PRONTOS da plataforma
  // (grátis, todo mundo pode usar em tudo, inclusive aqui). O `genero` vem junto:
  // é ele que evita a pergunta de gênero mais pra frente.
  const selecionaveis = [
    ...avatares.map((a) => ({
      id: a.id,
      nome: a.nome,
      url: a.imagemUrl,
      gratis: false,
      genero: (a.genero === "male" ? "male" : "female") as Genero,
    })),
    ...AVATARES_PRONTOS.map((a) => ({
      id: `pronto-${a.id}`,
      nome: a.nome,
      url: a.src,
      gratis: true,
      genero: a.genero,
    })),
  ];

  const [passo, setPasso] = useState(1);
  const [nome, setNome] = useState("");
  // fonte da pessoa: um avatar (salvo ou pronto) ou uma foto nova
  const [fonte, setFonte] = useState<"salvo" | "foto">("salvo");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(selecionaveis[0]?.url ?? null);
  const [pessoaFoto, setPessoaFoto] = useState<string | null>(null);
  const [produtoFoto, setProdutoFoto] = useState<string | null>(null);
  const [produtoNome, setProdutoNome] = useState("");
  const [uso, setUso] = useState(USOS_PRODUTO[0].chave);
  const [cenario, setCenario] = useState(CENARIOS[0].chave);
  const [genero, setGenero] = useState<Genero>(selecionaveis[0]?.genero ?? "female");
  // some por padrão quando o gênero foi herdado do avatar; abre no "trocar"
  const [mexerNoGenero, setMexerNoGenero] = useState(false);
  const [gerando, setGerando] = useState(false);
  const inPessoa = useRef<HTMLInputElement>(null);
  const inProduto = useRef<HTMLInputElement>(null);

  const temPessoa = fonte === "salvo" ? !!avatarUrl : !!pessoaFoto;
  const nomeOk = nome.trim().length >= 2;
  const pronto = nomeOk && temPessoa && !!produtoFoto;
  const avatarEscolhido = selecionaveis.find((a) => a.url === avatarUrl);
  const usoEscolhido = USOS_PRODUTO.find((u) => u.chave === uso);
  const cenarioEscolhido = CENARIOS.find((c) => c.chave === cenario);

  // o que trava o avanço de cada etapa (etapas 3 e 4 já nascem com uma escolha)
  const travado =
    passo === 1
      ? !nomeOk
        ? "Dê um nome à imagem (pelo menos 2 letras)."
        : !produtoFoto
          ? "Envie a foto do produto."
          : null
      : passo === 2 && !temPessoa
        ? fonte === "salvo"
          ? "Escolha uma pessoa da lista."
          : "Envie a foto da pessoa."
        : null;

  function irPara(n: number) {
    setPasso(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function avancar() {
    if (travado) {
      toast.info(travado);
      return;
    }
    irPara(Math.min(PASSOS.length, passo + 1));
  }

  /** Escolher uma pessoa da lista já traz o gênero dela junto. */
  function escolherAvatar(a: (typeof selecionaveis)[number]) {
    setAvatarUrl(a.url);
    setGenero(a.genero);
    setMexerNoGenero(false);
  }

  async function ler(file: File | undefined | null, set: (v: string) => void) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    // converte pra JPEG de verdade (HEIC/AVIF com nome .jpg quebram a IA)
    const dataUrl = await normalizarImagem(file);
    if (!dataUrl) {
      toast.error(ERRO_IMAGEM);
      return;
    }
    set(dataUrl);
  }

  async function gerar() {
    if (!pronto || gerando) return;
    setGerando(true);
    try {
      const res = await fetch("/api/avatar/com-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          genero,
          uso,
          cenario,
          produtoNome: produtoNome.trim() || undefined,
          produtoFoto,
          ...(fonte === "salvo" ? { pessoaUrl: avatarUrl } : { pessoaFoto }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.erro || "Não consegui gerar a imagem.");
        return;
      }
      toast.success("Imagem criada! 🎉");
      if (data.avatar) onCriado?.(data.avatar);
      onSair();
    } catch {
      toast.error("Erro de conexão. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight">Avatar com produto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha uma pessoa e a foto do produto. A IA gera a pessoa usando o produto,
            pronta pra virar post ou vídeo.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <Coins className="size-3.5" />
          {CUSTO_AVATAR} créditos
        </span>
      </div>

      <div className="mt-5">
        <Trilha passo={passo} onIr={irPara} />
      </div>

      {/* ===== ETAPA 1: NOME E PRODUTO ===== */}
      {passo === 1 && (
        <Tela chave="produto">
          <div>
            <label className="text-sm font-semibold">Nome da imagem</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Ana com o creme"
              maxLength={120}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              É só pra você achar essa imagem depois na galeria.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold">Foto do produto</label>
            <input
              ref={inProduto}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => ler(e.target.files?.[0], setProdutoFoto)}
            />
            <div className="mt-1.5 flex flex-wrap items-start gap-3">
              {produtoFoto ? (
                <div className="relative w-32 overflow-hidden rounded-2xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={produtoFoto}
                    alt="produto"
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setProdutoFoto(null)}
                    className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    aria-label="Remover foto do produto"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inProduto.current?.click()}
                  className="flex aspect-square w-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-all hover:scale-[1.02] hover:border-primary/60 hover:text-primary"
                >
                  <ImagePlus className="size-6" />
                  <span className="text-[11px] font-semibold">Foto do produto</span>
                </button>
              )}
              <div className="min-w-[200px] flex-1">
                <input
                  value={produtoNome}
                  onChange={(e) => setProdutoNome(e.target.value)}
                  placeholder="Nome do produto (opcional)"
                  maxLength={120}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Ajuda a IA a entender o objeto. Ex: creme facial, tênis, garrafa.
                  Foto limpa e bem iluminada sai melhor.
                </p>
              </div>
            </div>
          </div>

          {/* na 1ª etapa o "voltar" sai da ferramenta: é o mesmo destino do link
              "Escolher outro jeito de criar" que a tela de cima já mostra */}
          <Navegacao
            onVoltar={onSair}
            rotuloVoltar="Escolher outro jeito"
            onAvancar={avancar}
            travado={travado}
          />
        </Tela>
      )}

      {/* ===== ETAPA 2: QUEM APARECE ===== */}
      {passo === 2 && (
        <Tela chave="pessoa">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFonte("salvo");
                // volta a valer o gênero do avatar selecionado: sem isso, quem
                // marcou "Homem" na foto nova e voltasse pra cá veria o aviso
                // dizendo "igual ao avatar escolhido" com o gênero errado
                if (avatarEscolhido) {
                  setGenero(avatarEscolhido.genero);
                  setMexerNoGenero(false);
                }
              }}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                fonte === "salvo"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              Meus avatares e prontos
            </button>
            <button
              type="button"
              onClick={() => setFonte("foto")}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all",
                fonte === "foto"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              Subir foto
            </button>
          </div>

          {fonte === "salvo" ? (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {selecionaveis.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => escolherAvatar(a)}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border-2 transition-all hover:-translate-y-0.5",
                      avatarUrl === a.url
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-primary/40",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.nome}
                      className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-center text-[11px] font-semibold text-white">
                      {a.nome}
                    </span>
                    {a.gratis && (
                      <span className="absolute left-1 top-1 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                        Grátis
                      </span>
                    )}
                    {avatarUrl === a.url && (
                      <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* GÊNERO HERDADO: a pessoa escolhida já diz o que é, então aqui vira
                  só um aviso do que vai ser gravado, com o "trocar" pra quem
                  quiser mudar. Antes era uma pergunta obrigatória lá no fim. */}
              {avatarEscolhido && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5">
                  <span className="text-xs text-muted-foreground">
                    Vai pra galeria como{" "}
                    <b className="text-foreground">{genero === "male" ? "Homem" : "Mulher"}</b>,
                    igual ao avatar escolhido.
                  </span>
                  {mexerNoGenero ? (
                    <SeletorGenero valor={genero} onEscolher={setGenero} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMexerNoGenero(true)}
                      className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      trocar
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <input
                ref={inPessoa}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => ler(e.target.files?.[0], setPessoaFoto)}
              />
              {pessoaFoto ? (
                <div className="relative w-32 overflow-hidden rounded-2xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pessoaFoto} alt="pessoa" className="aspect-[3/4] w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPessoaFoto(null)}
                    className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                    aria-label="Remover foto da pessoa"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inPessoa.current?.click()}
                  className="flex aspect-[3/4] w-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-all hover:scale-[1.02] hover:border-primary/60 hover:text-primary"
                >
                  <ImagePlus className="size-6" />
                  <span className="text-[11px] font-semibold">Foto da pessoa</span>
                </button>
              )}

              {/* Foto nova não tem ficha nenhuma, então aqui a pergunta continua
                  fazendo sentido: ela entra no fluxo, junto de quem aparece. */}
              <div className="space-y-1.5">
                <p className="text-sm font-semibold">Quem é a pessoa da foto?</p>
                <SeletorGenero valor={genero} onEscolher={setGenero} />
                <p className="text-[11px] text-muted-foreground">
                  Serve só pra etiquetar a imagem na sua galeria depois.
                </p>
              </div>
            </div>
          )}

          <Navegacao onVoltar={() => irPara(1)} onAvancar={avancar} travado={travado} />
        </Tela>
      )}

      {/* ===== ETAPA 3: AÇÃO ===== */}
      {passo === 3 && (
        <Tela chave="uso">
          <div>
            <p className="text-sm font-semibold">O que a pessoa está fazendo com o produto</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              É a pose da imagem. Escolha a que mostra melhor o seu tipo de produto.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {USOS_PRODUTO.map((u) => {
                const Icone = ICONE_USO[u.chave] ?? Hand;
                const ativo = uso === u.chave;
                return (
                  <button
                    key={u.chave}
                    type="button"
                    onClick={() => setUso(u.chave)}
                    aria-pressed={ativo}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-all hover:-translate-y-0.5",
                      ativo
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50 hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-xl transition-colors",
                        ativo ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icone className="size-4.5" />
                    </span>
                    <span
                      className={cn(
                        "flex w-full items-center justify-between gap-1 text-sm font-semibold",
                        ativo && "text-primary",
                      )}
                    >
                      {u.label}
                      {ativo && <Check className="size-3.5 shrink-0" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Navegacao onVoltar={() => irPara(2)} onAvancar={avancar} travado={travado} />
        </Tela>
      )}

      {/* ===== ETAPA 4: CENÁRIO E GERAÇÃO ===== */}
      {passo === 4 && (
        <Tela chave="cenario">
          <div>
            <p className="text-sm font-semibold">Onde a foto acontece</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A pessoa já sai com esse fundo. Bom pra depois virar vídeo de 15s.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {CENARIOS.map((c) => (
                <CardCenario
                  key={c.chave}
                  label={c.label}
                  src={midiaCenario(FOTO_CENARIO[c.chave] ?? c.chave)}
                  Fallback={ICONE_CENARIO[c.chave] ?? Home}
                  ativo={cenario === c.chave}
                  onEscolher={() => setCenario(c.chave)}
                />
              ))}
            </div>
          </div>

          {/* resumo do que foi escolhido: clicar volta pra etapa daquilo */}
          <div className="flex flex-wrap gap-2">
            <Etiqueta onClick={() => irPara(1)}>{nome.trim() || "Sem nome"}</Etiqueta>
            <Etiqueta onClick={() => irPara(2)}>
              {fonte === "salvo" ? (avatarEscolhido?.nome ?? "Avatar") : "Foto que você enviou"}
            </Etiqueta>
            <Etiqueta onClick={() => irPara(3)}>{usoEscolhido?.label ?? "Segurando"}</Etiqueta>
            <Etiqueta onClick={() => irPara(4)}>{cenarioEscolhido?.label ?? "Sala"}</Etiqueta>
          </div>

          <section className="rounded-2xl border border-primary/40 bg-primary/8 p-4 shadow-[0_0_40px_-18px_var(--color-primary)] sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">
                  Gerar a imagem <span className="text-primary">({CUSTO_AVATAR} créditos)</span>
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  A IA junta a pessoa e o produto numa foto só. Leva alguns segundos, e a
                  imagem entra na sua galeria.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={gerar}
              disabled={!pronto || gerando}
              className={cn(
                "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all",
                pronto && !gerando
                  ? "bg-primary text-primary-foreground hover:opacity-90 hover:shadow-[0_0_30px_-6px_var(--color-primary)]"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              {gerando ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5" />
              )}
              {gerando ? "Gerando a imagem..." : "Gerar imagem"}
            </button>
            {gerando && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                A IA está montando a imagem. Leva alguns segundos. ✨
              </p>
            )}
            {!pronto && !gerando && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {!nomeOk
                  ? "Falta o nome da imagem, lá na primeira etapa."
                  : !produtoFoto
                    ? "Falta a foto do produto, lá na primeira etapa."
                    : "Falta escolher quem aparece, na segunda etapa."}
              </p>
            )}
          </section>

          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => irPara(3)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Voltar
            </button>
          </div>
        </Tela>
      )}
    </div>
  );
}

/* ---------------- componentes auxiliares ---------------- */

/** Envelope com a animação de entrada de cada etapa. */
function Tela({ chave, children }: { chave: string; children: React.ReactNode }) {
  return (
    <div
      key={chave}
      className="mt-6 space-y-5 duration-500 animate-in fade-in slide-in-from-bottom-4"
    >
      {children}
    </div>
  );
}

/** Trilha das etapas + barra de progresso. Etapa já vista volta com um clique. */
function Trilha({ passo, onIr }: { passo: number; onIr: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {PASSOS.map(({ n, titulo, Icone }) => {
          const feito = n < passo;
          const agora = n === passo;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onIr(n)}
              disabled={n > passo}
              title={titulo}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors",
                n <= passo ? "cursor-pointer hover:bg-accent" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors",
                  agora
                    ? "border-primary bg-primary text-primary-foreground"
                    : feito
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                {feito ? <Check className="size-3.5" /> : <Icone className="size-3.5" />}
              </span>
              <span
                className={cn(
                  "hidden truncate text-[10px] sm:block",
                  agora ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {titulo}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)] transition-[width] duration-500 ease-out"
          style={{ width: `${(passo / PASSOS.length) * 100}%` }}
        />
      </div>
      <p className="text-center text-[11px] text-muted-foreground sm:hidden">
        Etapa {passo} de {PASSOS.length}: {PASSOS[passo - 1].titulo}
      </p>
    </div>
  );
}

/** Rodapé de navegação: Voltar à esquerda, avançar à direita. */
function Navegacao({
  onVoltar,
  rotuloVoltar = "Voltar",
  onAvancar,
  travado,
}: {
  onVoltar: () => void;
  rotuloVoltar?: string;
  onAvancar: () => void;
  /** motivo pra não deixar avançar (null = pode) */
  travado: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {rotuloVoltar}
        </button>
        <button
          type="button"
          onClick={onAvancar}
          disabled={!!travado}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_30px_-6px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
        >
          Prosseguir
          <ArrowRight className="size-4" />
        </button>
      </div>
      {travado && <p className="text-right text-[11px] text-muted-foreground">{travado}</p>}
    </div>
  );
}

/** Os dois botões de gênero (usado herdado e na foto nova). */
function SeletorGenero({
  valor,
  onEscolher,
}: {
  valor: Genero;
  onEscolher: (g: Genero) => void;
}) {
  return (
    <div className="flex gap-2">
      {(
        [
          ["female", "Mulher"],
          ["male", "Homem"],
        ] as const
      ).map(([v, txt]) => (
        <button
          key={v}
          type="button"
          onClick={() => onEscolher(v)}
          aria-pressed={valor === v}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-semibold transition-all",
            valor === v
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          {txt}
        </button>
      ))}
    </div>
  );
}

/**
 * Card de cenário com foto (mesmo desenho do passo "Cenário" do Criar criativo).
 * O ícone fica POR BAIXO: se a foto não existir ainda, ela some no `onError` e
 * sobra o ícone, em vez de um retângulo quebrado.
 */
function CardCenario({
  src,
  label,
  ativo,
  onEscolher,
  Fallback,
}: {
  src: string;
  label: string;
  ativo: boolean;
  onEscolher: () => void;
  Fallback: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativo}
      className={cn(
        "group relative aspect-[3/4] overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5",
        ativo
          ? "border-primary ring-2 ring-primary/40"
          : "border-border/60 hover:border-primary/40",
      )}
    >
      <span className="absolute inset-0 grid place-items-center bg-card/60 text-muted-foreground">
        <Fallback className="size-6" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pb-1.5 pt-8" />
      <span className="absolute inset-x-0 bottom-0 px-2.5 pb-2 text-xs font-semibold leading-tight text-white drop-shadow sm:text-sm">
        {label}
      </span>
      {ativo && (
        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <Check className="size-3.5" />
        </span>
      )}
    </button>
  );
}

/** Item do resumo: clicar volta pra etapa onde ele foi escolhido. */
function Etiqueta({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {children}
    </button>
  );
}
