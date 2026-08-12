"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Camera,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  ImagePlus,
  Loader2,
  Lock,
  PackageSearch,
  PenLine,
  RefreshCw,
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
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import {
  DURACOES,
  DURACAO_NOTA,
  ESTILOS_VIDEO,
  IDIOMAS_FALA,
  custoVideoAvatar,
} from "@/lib/avatar-modelo";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import { guardarPromptParaLivre } from "@/lib/lab-handoff";
import { CUSTO_PROMPT_LAB } from "@/lib/lab-custos";

/**
 * GERADOR DE PROMPT: a pessoa sobe o avatar (opcional) + as fotos do produto, diz
 * o que quer, e a IA escreve o prompt perfeito seguindo a metodologia da aula
 * (identidade bloqueada, realismo sem cara de IA, formato UGC). Sai em texto
 * normal (UGC) ou JSON (melhor pra Gemini/Grok). Dá pra copiar ou jogar direto
 * no Vídeo livre com as imagens juntas.
 *
 * A tela é um FUNIL de 5 etapas (fotos -> estilo -> instruções -> formato ->
 * gerar), no mesmo padrão do "Criar criativo". Antes era um formulário só,
 * comprido, em que a pessoa via tudo de uma vez e não sabia por onde começar.
 * O cabeçalho é montado AQUI (e não na página) porque a trilha das etapas mora
 * embaixo dele, e trilha precisa de estado.
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

const PASSOS = [
  { n: 1, titulo: "Fotos", Icone: ImagePlus },
  { n: 2, titulo: "Estilo", Icone: Clapperboard },
  { n: 3, titulo: "Instruções", Icone: PenLine },
  { n: 4, titulo: "Formato", Icone: Braces },
  { n: 5, titulo: "Gerar", Icone: Wand2 },
] as const;

export function GeradorPrompt() {
  const [passo, setPasso] = useState(1);
  const [avatarFoto, setAvatarFoto] = useState<string | null>(null);
  const [produtoFotos, setProdutoFotos] = useState<string[]>([]);
  const [descricao, setDescricao] = useState("");
  const [formato, setFormato] = useState<"normal" | "json">("normal");
  const [duracao, setDuracao] = useState<number>(10);
  const [comFala, setComFala] = useState(true);
  const [idioma, setIdioma] = useState("pt");
  const [estilo, setEstilo] = useState("ugc");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [verMetodo, setVerMetodo] = useState(false);
  // o que estava escolhido na hora que o prompt saiu: serve pra avisar que
  // mexer numa opção depois não muda o texto que já está na tela
  const [assinaturaGerada, setAssinaturaGerada] = useState("");

  const inputAvatar = useRef<HTMLInputElement>(null);
  const inputProduto = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
  const idiomaSel = IDIOMAS_FALA.find((i) => i.chave === idioma);
  const estiloSel = ESTILOS_VIDEO.find((e) => e.chave === estilo);

  /**
   * Retrato das escolhas. As fotos entram só pela QUANTIDADE: comparar base64 de
   * 3 imagens a cada tecla digitada travaria a tela sem necessidade.
   */
  const assinatura = JSON.stringify({
    avatar: !!avatarFoto,
    fotos: produtoFotos.length,
    descricao: descricao.trim(),
    formato,
    duracao,
    comFala,
    idioma,
    estilo,
  });
  const mudouDepois = !!resultado && assinatura !== assinaturaGerada;

  function irPara(n: number) {
    setPasso(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function avancar() {
    if (passo === 1 && !temFoto) {
      toast.info("Suba ao menos 1 foto (do produto ou do avatar). 🙂");
      return;
    }
    irPara(Math.min(PASSOS.length, passo + 1));
  }

  async function gerar() {
    if (!temFoto) {
      toast.info("Suba ao menos 1 foto (do produto ou do avatar). 🙂");
      irPara(1);
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
          estilo,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { erro?: string; prompt?: string };
      if (!r.ok || !data.prompt) {
        toast.error(data.erro ?? "Não consegui gerar agora. Tente de novo.");
        return;
      }
      setResultado(data.prompt);
      setAssinaturaGerada(assinatura);
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

  /** Deixa o prompt e as fotos de recado e abre a tela do Vídeo livre. */
  function usarNoLivre() {
    if (!resultado) return;
    const midias = [...(avatarFoto ? [avatarFoto] : []), ...produtoFotos].slice(0, 3);
    guardarPromptParaLivre({ texto: resultado, midias });
    router.push("/painel/lab/livre");
  }

  return (
    <div>
      <LabCabecalho
        Icone={PenLine}
        chamada="A IA escreve o prompt perfeito pra você"
        titulo="Gerador de prompt"
        descricao="Suba suas fotos e a IA escreve o prompt perfeito pra você, com a técnica dos profissionais."
      >
        <Trilha passo={passo} onIr={irPara} />
      </LabCabecalho>

      {/* ===== ETAPA 1: FOTOS ===== */}
      {passo === 1 && (
        <Tela chave="fotos">
          <Bloco
            n={1}
            titulo="Suas fotos"
            ajuda="Suba o produto (até 3 fotos) e, se quiser, a pessoa do vídeo. A IA analisa tudo pra escrever o prompt fiel."
          >
            <input ref={inputAvatar} type="file" accept="image/*" hidden onChange={subirAvatar} />
            <input
              ref={inputProduto}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={subirProdutos}
            />

            <div className="flex flex-wrap items-start gap-4">
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
                      className="size-24 rounded-xl border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setAvatarFoto(null)}
                      className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-black"
                      aria-label="Remover avatar"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputAvatar.current?.click()}
                    className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-all hover:scale-[1.03] hover:border-primary/60 hover:text-primary"
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
                        className="size-24 rounded-xl border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProdutoFotos((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-black"
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
                      className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-all hover:scale-[1.03] hover:border-primary/60 hover:text-primary"
                    >
                      <ImagePlus className="size-5" />
                      <span className="text-[10px] font-medium">Adicionar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Bloco>

          {/* O MÉTODO da aula: vira um card que ABRE, pra não empurrar o upload
              pra baixo da dobra logo na entrada. O conteúdo é o mesmo de antes. */}
          <section className="overflow-hidden rounded-3xl border border-border/60 bg-card/40">
            <button
              type="button"
              onClick={() => setVerMetodo((v) => !v)}
              aria-expanded={verMetodo}
              className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-card/70 sm:p-6"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  Como a IA escreve o seu prompt
                </span>
                <span className="block text-xs text-muted-foreground">
                  As 4 regras do método que a gente aplica em todo prompt gerado aqui.
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
                  verMetodo && "rotate-180",
                )}
              />
            </button>
            {verMetodo && (
              <div className="grid grid-cols-1 gap-2.5 px-5 pb-5 duration-300 animate-in fade-in slide-in-from-top-2 sm:grid-cols-2 sm:px-6 sm:pb-6">
                {METODO.map((m) => (
                  <div key={m.titulo} className="rounded-2xl border border-border bg-card p-4">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                      <m.Icon className="size-4.5" />
                    </span>
                    <p className="mt-2.5 text-sm font-bold">{m.titulo}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {m.texto}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Navegacao onAvancar={avancar} podeAvancar={temFoto} />
          {!temFoto && (
            <p className="text-center text-[11px] text-muted-foreground">
              Suba ao menos uma foto pra continuar.
            </p>
          )}
        </Tela>
      )}

      {/* ===== ETAPA 2: ESTILO E DURAÇÃO ===== */}
      {passo === 2 && (
        <Tela chave="estilo">
          <Bloco
            n={2}
            titulo="Duração do vídeo"
            ajuda="É o tempo que a cena vai ter. Quanto maior, mais fala cabe."
          >
            <div className="grid grid-cols-3 gap-2.5">
              {DURACOES.map((s) => {
                const ativo = duracao === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDuracao(s)}
                    aria-pressed={ativo}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5",
                      ativo
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50 hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-between gap-1 text-sm font-bold",
                        ativo && "text-primary",
                      )}
                    >
                      {s}s
                      {ativo && <Check className="size-3.5 shrink-0" strokeWidth={3} />}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                      {DURACAO_NOTA[s]}
                    </span>
                  </button>
                );
              })}
            </div>
          </Bloco>

          <Bloco
            n={3}
            titulo="A pessoa fala no vídeo?"
            ajuda="Sem fala, a cena vira só imagem e movimento."
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setComFala(true)}
                aria-pressed={comFala}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all",
                  comFala
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Volume2 className="size-3.5" />
                Com fala
              </button>
              <button
                type="button"
                onClick={() => setComFala(false)}
                aria-pressed={!comFala}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all",
                  !comFala
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <VolumeX className="size-3.5" />
                Sem fala
              </button>

              {comFala && (
                <div className="flex items-center gap-2 duration-300 animate-in fade-in slide-in-from-left-2">
                  <span className="text-xs text-muted-foreground">Idioma:</span>
                  <select
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold outline-none transition-colors focus:border-primary"
                    aria-label="Idioma da fala"
                  >
                    {IDIOMAS_FALA.map((i) => (
                      <option key={i.chave} value={i.chave}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Bloco>

          <Bloco
            n={4}
            titulo="Estilo do vídeo"
            ajuda="É o jeito da cena acontecer. Cada estilo conta a história de um jeito."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ESTILOS_VIDEO.map((es) => {
                const ativo = estilo === es.chave;
                return (
                  <button
                    key={es.chave}
                    type="button"
                    onClick={() => setEstilo(es.chave)}
                    aria-pressed={ativo}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5",
                      ativo
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50 hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-between gap-1 text-xs font-semibold",
                        ativo && "text-primary",
                      )}
                    >
                      {es.label}
                      {ativo && <Check className="size-3.5 shrink-0" strokeWidth={3} />}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                      {es.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </Bloco>

          <Navegacao onVoltar={() => irPara(1)} onAvancar={avancar} podeAvancar />
        </Tela>
      )}

      {/* ===== ETAPA 3: INSTRUÇÕES EXTRAS ===== */}
      {passo === 3 && (
        <Tela chave="instrucoes">
          <Bloco
            n={5}
            titulo="O que você quer no vídeo?"
            ajuda="Opcional. Se deixar em branco, a IA decide a melhor cena olhando as suas fotos."
          >
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: ela na cozinha de manhã, mostra o produto animada e fala do desconto..."
              maxLength={600}
              rows={5}
              className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Conte a história, o clima ou o que ela deve dizer.</span>
              <span className="tabular-nums">{descricao.length}/600</span>
            </div>
          </Bloco>

          <Navegacao onVoltar={() => irPara(2)} onAvancar={avancar} podeAvancar />
        </Tela>
      )}

      {/* ===== ETAPA 4: FORMATO DE SAÍDA ===== */}
      {passo === 4 && (
        <Tela chave="formato">
          <Bloco
            n={6}
            titulo="Como você quer receber o prompt?"
            ajuda="Dá pra trocar depois: é só voltar aqui e gerar de novo."
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              <CartaoFormato
                ativo={formato === "normal"}
                onClick={() => setFormato("normal")}
                Icone={Text}
                titulo="Normal (UGC)"
                descricao="Texto corrido, do jeito que o Vídeo livre daqui espera. É o mais fácil de ler e ajustar na mão."
              />
              <CartaoFormato
                ativo={formato === "json"}
                onClick={() => setFormato("json")}
                Icone={Braces}
                titulo="JSON estruturado"
                descricao="Campos separados (cena, câmera, fala). Funciona melhor colando direto no Gemini ou no Grok."
              />
            </div>
          </Bloco>

          <Navegacao
            onVoltar={() => irPara(3)}
            onAvancar={avancar}
            podeAvancar
            rotulo="Revisar e gerar"
          />
        </Tela>
      )}

      {/* ===== ETAPA 5: GERAÇÃO E AÇÃO ===== */}
      {passo === 5 && (
        <Tela chave="gerar">
          {/* resumo do que foi escolhido, pra conferir antes de gastar crédito */}
          <section className="rounded-3xl border border-border/60 bg-card/40 p-5 sm:p-7">
            <p className="text-sm font-semibold">Confira antes de gerar</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Etiqueta onClick={() => irPara(1)}>
                {produtoFotos.length} foto{produtoFotos.length === 1 ? "" : "s"} do produto
                {avatarFoto ? " + avatar" : ""}
              </Etiqueta>
              <Etiqueta onClick={() => irPara(2)}>{duracao} segundos</Etiqueta>
              <Etiqueta onClick={() => irPara(2)}>
                {comFala ? `Com fala em ${idiomaSel?.label ?? "Português (BR)"}` : "Sem fala"}
              </Etiqueta>
              <Etiqueta onClick={() => irPara(2)}>{estiloSel?.label ?? "UGC clássico"}</Etiqueta>
              <Etiqueta onClick={() => irPara(3)}>
                {descricao.trim() ? "Com instruções suas" : "A IA escolhe a cena"}
              </Etiqueta>
              <Etiqueta onClick={() => irPara(4)}>
                {formato === "json" ? "JSON estruturado" : "Normal (UGC)"}
              </Etiqueta>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Toque em qualquer etiqueta pra voltar e mudar aquilo.
            </p>
          </section>

          {/* chamada da geração: card destacado com brilho, o "botão da vez" */}
          <section className="rounded-3xl border border-primary/40 bg-primary/8 p-5 shadow-[0_0_40px_-18px_var(--color-primary)] sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Wand2 className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">
                  Gerar o prompt{" "}
                  <span className="text-primary">({CUSTO_PROMPT_LAB} créditos)</span>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A IA olha suas fotos e escreve o prompt inteiro. Se ela falhar, você não
                  paga nada.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_30px_-6px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {gerando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  A IA está escrevendo seu prompt...
                </>
              ) : (
                <>
                  {resultado ? <RefreshCw className="size-4" /> : <Wand2 className="size-4" />}
                  {resultado ? "Gerar de novo" : "Gerar prompt com IA"}
                </>
              )}
            </button>
            {mudouDepois && !gerando && (
              <p className="mt-2.5 text-center text-[11px] font-medium text-primary">
                Você mudou alguma opção depois de gerar. O texto abaixo ainda é o antigo:
                gere de novo pra valer a mudança.
              </p>
            )}
          </section>

          {/* ===== RESULTADO ===== */}
          {resultado && (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 duration-500 animate-in fade-in slide-in-from-bottom-3 sm:p-5">
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
                    {copiado ? (
                      <Check className="size-3.5 text-primary" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiado ? "Copiado!" : "Copiar"}
                  </button>
                  <button
                    type="button"
                    onClick={usarNoLivre}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_20px_-6px_var(--color-primary)]"
                  >
                    <Wand2 className="size-3.5" />
                    Usar no Vídeo livre
                  </button>
                </div>
              </div>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-3.5 text-xs leading-relaxed">
                {resultado}
              </pre>
              {formato === "normal" && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Toque em Usar no Vídeo livre pra gerar aqui mesmo ({custoVideoAvatar(duracao)}{" "}
                  créditos), ou copie e use onde quiser.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => irPara(4)}
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

/** Envelope com a animação de entrada de cada etapa (sobe suave e aparece). */
function Tela({ chave, children }: { chave: string; children: React.ReactNode }) {
  return (
    <div
      key={chave}
      className="mt-8 space-y-4 duration-500 animate-in fade-in slide-in-from-bottom-4"
    >
      {children}
    </div>
  );
}

/** Trilha das etapas + barra de progresso. Etapa já vista volta com um clique. */
function Trilha({ passo, onIr }: { passo: number; onIr: (n: number) => void }) {
  return (
    <div className="w-full max-w-xl space-y-2">
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

/** Caixa numerada de um bloco da etapa. */
function Bloco({
  n,
  titulo,
  ajuda,
  children,
}: {
  n: number;
  titulo: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/40 p-5 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {n}
        </span>
        <h2 className="font-semibold">{titulo}</h2>
      </div>
      {ajuda && <p className="ml-9.5 mt-1 text-xs text-muted-foreground">{ajuda}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Rodapé de navegação: Voltar à esquerda, avançar à direita. */
function Navegacao({
  onVoltar,
  onAvancar,
  podeAvancar,
  rotulo = "Prosseguir",
}: {
  onVoltar?: () => void;
  onAvancar: () => void;
  podeAvancar: boolean;
  rotulo?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", onVoltar ? "justify-between" : "justify-end")}>
      {onVoltar && (
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </button>
      )}
      <button
        type="button"
        disabled={!podeAvancar}
        onClick={onAvancar}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_30px_-6px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
      >
        {rotulo}
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

/** Um dos dois formatos de saída da etapa 4. */
function CartaoFormato({
  ativo,
  onClick,
  Icone,
  titulo,
  descricao,
}: {
  ativo: boolean;
  onClick: () => void;
  Icone: typeof Text;
  titulo: string;
  descricao: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5",
        ativo
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border hover:border-primary/50 hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            ativo ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icone className="size-4" />
        </span>
        <span className={cn("flex-1 text-sm font-bold", ativo && "text-primary")}>{titulo}</span>
        {ativo && <Check className="size-4 shrink-0 text-primary" strokeWidth={3} />}
      </span>
      <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
        {descricao}
      </span>
    </button>
  );
}

/** Item do resumo da etapa 5: clicar volta pra etapa onde ele foi escolhido. */
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
