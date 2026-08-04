"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  Download,
  Check,
  TriangleAlert,
  UserRoundPlus,
  Upload,
  SkipForward,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, linkBaixar } from "@/lib/utils";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import { CUSTO_IMAGEM_LAB } from "@/lib/lab-custos";
import type { EstiloCamera } from "@/lib/estilos-camera";
import type { ProdutoLab } from "@/components/app/lab-produtos";
import type { AvatarLab } from "@/components/app/lab-avatares";

/**
 * Etapa "Gerar imagem" do Lab: dispara a geração (Grok primeiro, gpt-image de
 * reserva), mostra o progresso e o resultado. Enquanto gera, a moldura fica com
 * o brilho pulsando pra pessoa perceber que está acontecendo algo.
 */

const FRASES = [
  "Lendo as fotos do produto e do influenciador...",
  "Travando a identidade da pessoa...",
  "Montando a cena que você descreveu...",
  "Ajustando luz e profundidade do cenário...",
  "Caprichando nos detalhes finais...",
];

export function LabImagem({
  estilo,
  produto,
  avatar,
  cena,
  cenario,
  cenarioTexto,
  imagem,
  onGerou,
  minhasImagens = [],
  comecarPulando = false,
  variacao,
  jaPediu = false,
  pedidoEm,
  onComecou,
}: {
  estilo: EstiloCamera;
  produto: ProdutoLab;
  avatar: AvatarLab;
  cena: string;
  cenario: string;
  cenarioTexto: string;
  imagem: string | null;
  onGerou: (url: string) => void;
  /** imagens que a pessoa já tem salvas (pra pular a geração e usar uma delas) */
  minhasImagens?: { id: string; nome: string; imagemUrl: string }[];
  /** true = a pessoa escolheu "já tenho a imagem", então não gera sozinho */
  comecarPulando?: boolean;
  /** variação do estilo Mãos (POV): "maos" segurando ou "parado" na bancada */
  variacao?: string;
  /**
   * A imagem já foi pedida nessa sessão do Lab.
   *
   * Esta tela gera sozinha ao montar, e ela desmonta quando a pessoa troca de
   * aba no dock. Sem isso, voltar pro Lab no meio da geração pedia (e cobrava)
   * outra imagem. O pedido antigo não se perde: ele continua no servidor e a
   * imagem chega pelo onGerou, além de entrar em "Minhas imagens".
   */
  jaPediu?: boolean;
  /** quando o pedido foi feito (Date.now()): usado pra reencontrar a imagem na galeria */
  pedidoEm?: number | null;
  onComecou?: () => void;
}) {
  // voltando pro Lab no meio da geração, a tela já abre mostrando que está
  // rodando (senão parece que não fez nada e a pessoa manda gerar de novo)
  const [gerando, setGerando] = useState(jaPediu && !imagem);
  const [pulando, setPulando] = useState(comecarPulando);
  const [subindo, setSubindo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [frase, setFrase] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const jaDisparou = useRef(false);

  /** Guarda a imagem gerada como um influenciador reutilizável da pessoa. */
  async function salvarComoInfluencer() {
    if (!imagem) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/avatar/subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: `${produto.titulo.slice(0, 40)} - ${estilo.label}`,
          url: imagem,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      setSalvo(true);
      toast.success("Salvo nos seus influenciadores!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Sobe uma imagem pronta (a pessoa já tem o avatar com o produto). */
  async function subirPronta(file?: File | null) {
    if (!file) return;
    setSubindo(true);
    try {
      const dataUrl = await normalizarImagem(file);
      if (!dataUrl) throw new Error(ERRO_IMAGEM);
      const r = await fetch("/api/avatar/subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: `${produto.titulo.slice(0, 40)} - minha imagem`,
          foto: dataUrl,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao subir a imagem.");
      onGerou(d.avatar?.imagemUrl as string);
      setPulando(false);
      toast.success("Imagem pronta! Pode seguir pro vídeo.");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === ERRO_IMAGEM
          ? "Não consegui ler essa imagem. Tente outra foto (JPG ou PNG)."
          : e instanceof Error
            ? e.message
            : "Falha ao subir a imagem.",
      );
    } finally {
      setSubindo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function gerar() {
    setGerando(true);
    setErro(null);
    setSalvo(false);
    try {
      const r = await fetch("/api/lab/imagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estilo: estilo.chave,
          cena,
          cenario,
          cenarioTexto,
          produtoImagem: produto.imagem,
          produtoNome: produto.titulo,
          avatarUrl: avatar.imagemUrl || undefined,
          variacao,
          // vai junto só pra galeria conseguir remontar essa mesma cena depois
          produtoId: produto.id,
          produtoMeu: produto.meu,
          avatarId: avatar.id,
          avatarNome: avatar.nome,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui gerar a imagem.");
      onGerou(d.imagemUrl as string);
      toast.success("Imagem pronta!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não consegui gerar a imagem.";
      setErro(msg);
      toast.error(msg);
    } finally {
      setGerando(false);
    }
  }

  // dispara sozinho ao entrar na etapa (a pessoa já clicou em "Gerar imagem")
  useEffect(() => {
    if (!jaDisparou.current && !imagem && !pulando && !jaPediu) {
      jaDisparou.current = true;
      onComecou?.();
      gerar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a imagem chegou (inclusive de um pedido feito antes de trocar de aba)
  useEffect(() => {
    if (imagem) setGerando(false);
  }, [imagem]);

  // REENCONTRAR um pedido antigo: a geração é um POST longo que morre se esta
  // tela desmontar (trocar de aba, voltar um passo). O servidor termina e salva
  // em "Minhas imagens" do mesmo jeito — então, enquanto estivermos esperando um
  // pedido dessa sessão, vigiamos a galeria e puxamos a imagem quando ela chegar.
  // Sem isso, a pessoa via "Gerando..." pra sempre e clicava (e pagava) de novo.
  useEffect(() => {
    if (!jaPediu || imagem || !pedidoEm) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/imagens", { cache: "no-store" });
        const d = await r.json();
        const lista = (d?.imagens ?? []) as { imagem: string; origem: string; criadoEm: string }[];
        // 90s de folga pro relógio do servidor não desencontrar do navegador
        const nova = lista.find(
          (i) => i.origem === "lab" && new Date(i.criadoEm).getTime() >= pedidoEm - 90_000,
        );
        if (nova) {
          onGerou(nova.imagem);
          toast.success("Sua imagem ficou pronta!");
        }
      } catch {
        // rede piscou: tenta no próximo ciclo
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [jaPediu, imagem, pedidoEm, onGerou]);

  // frases girando enquanto gera (sensação de progresso)
  useEffect(() => {
    if (!gerando) return;
    const t = setInterval(() => setFrase((f) => (f + 1) % FRASES.length), 4000);
    return () => clearInterval(t);
  }, [gerando]);

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-sm">
        <div
          className={cn(
            "relative aspect-[3/4] overflow-hidden rounded-2xl border bg-black/40 transition-all duration-700",
            imagem
              ? "border-primary/70 shadow-[0_0_45px_-10px_var(--color-primary)]"
              : "border-border/60",
          )}
        >
          {imagem ? (
            <Image
              src={imagem}
              alt="Imagem gerada"
              fill
              unoptimized
              sizes="(max-width: 640px) 90vw, 384px"
              className="object-cover duration-700 animate-in fade-in"
            />
          ) : (
            <div className="grid size-full place-items-center">
              {gerando ? (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <span className="relative grid size-14 place-items-center">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                    <Loader2 className="size-7 animate-spin text-primary" />
                  </span>
                  <p className="text-sm text-muted-foreground">{FRASES[frase]}</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    Costuma levar de 1 a 3 minutos.
                  </p>
                </div>
              ) : pulando ? (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <Upload className="size-7 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Escolha abaixo a imagem que você já tem. Não gasta crédito.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <TriangleAlert className="size-7 text-amber-400" />
                  <p className="text-sm text-muted-foreground">
                    {erro ?? "A imagem ainda não foi gerada."}
                  </p>
                </div>
              )}
            </div>
          )}
          {gerando && (
            <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary/40 [animation:pulse_2s_ease-in-out_infinite]" />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {imagem && (
          <a
            href={linkBaixar(imagem, "imagem-viraliza.png")}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Download className="size-4" />
            Baixar
          </a>
        )}
        {imagem && (
          <button
            type="button"
            onClick={salvarComoInfluencer}
            disabled={salvando || salvo}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
          >
            {salvando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : salvo ? (
              <Check className="size-4 text-primary" />
            ) : (
              <UserRoundPlus className="size-4" />
            )}
            {salvo ? "Salvo nos influenciadores" : "Salvar como influencer"}
          </button>
        )}
        {/* enquanto o painel "usar imagem que já tenho" está aberto, o botão de
            gerar some: nesse modo a pessoa NÃO quer gerar (nem pagar) de novo */}
        {!(pulando && !imagem) && (
          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {gerando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : imagem ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {gerando ? "Gerando..." : imagem ? "Gerar novamente" : "Tentar de novo"}
          </button>
        )}
      </div>

      {imagem ? (
        <p className="text-center text-xs text-muted-foreground">
          Não ficou como queria? É só gerar novamente até acertar (cada geração
          custa {CUSTO_IMAGEM_LAB} créditos).
        </p>
      ) : pulando ? null : (
        <p className="text-center text-xs text-muted-foreground">
          Custa {CUSTO_IMAGEM_LAB} créditos, cobrados só quando a imagem fica pronta.
        </p>
      )}

      {/* PULAR: quem já tem a foto do avatar com o produto não precisa gerar de
          novo (nem pagar). Pode subir do celular ou reaproveitar uma salva. */}
      {!gerando && (
        <div className="border-t border-border/60 pt-4">
          {!pulando ? (
            <button
              type="button"
              onClick={() => setPulando(true)}
              className="mx-auto flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <SkipForward className="size-3.5" />
              Já tenho essa imagem pronta, quero pular
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Usar uma imagem que você já tem</p>
                <button
                  type="button"
                  onClick={() => setPulando(false)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Serve a foto do avatar já com o produto. Não gasta crédito nenhum.
              </p>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={subindo}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
              >
                {subindo ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Subir imagem do meu aparelho
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => subirPronta(e.target.files?.[0])}
              />

              {minhasImagens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ou escolha uma salva
                  </p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {minhasImagens.slice(0, 12).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          onGerou(a.imagemUrl);
                          setPulando(false);
                          toast.success("Imagem escolhida! Pode seguir pro vídeo.");
                        }}
                        className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border/60 transition-colors hover:border-primary/50"
                      >
                        <Image
                          src={a.imagemUrl}
                          alt={a.nome}
                          fill
                          unoptimized
                          sizes="120px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
