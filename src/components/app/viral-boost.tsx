"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Bell,
  History,
  Flame,
  Users,
  BookOpen,
  MapPin,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Download,
  Copy,
  Clapperboard,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn, linkBaixar } from "@/lib/utils";
import {
  FORMATOS,
  formatoPorChave,
  cenariosDoFormato,
  historinhasPara,
  historinhaPorChave,
  historinhaDe,
  cenarioFrutaPorChave,
  hashtagsDa,
  frutaPorChave,
  ROTULOS_BATIDA,
  duracaoBoost,
  limitePalavras,
  contarPalavras,
  type FrutaPersonagem,
  type HistorinhaPropria,
} from "@/lib/viral-boost";
import { BoostPersonagens } from "@/components/app/boost-personagens";
import { BoostHistorinhaPropria } from "@/components/app/boost-historinha-propria";
import { CUSTO_IMAGEM_LAB, custoVideoLab } from "@/lib/lab-custos";

/**
 * Viral Boost: a trend das historinhas de fruta em estilo novela.
 *
 * Quatro passos: escolher as frutas, a historinha, o cenário e gerar. A cena
 * (imagem) é opcional. A duração sai da quantidade de personagens: um só vira
 * vídeo de 15s (uma imagem pro motor), dois ou três viram 10s.
 */

const PASSOS = [
  { chave: "formato", label: "Formato", Icone: Flame },
  { chave: "frutas", label: "Personagens", Icone: Users },
  { chave: "historia", label: "Historinha", Icone: BookOpen },
  { chave: "cenario", label: "Cenário", Icone: MapPin },
  { chave: "gerar", label: "Gerar", Icone: Sparkles },
] as const;

const FRASES = [
  "Montando o elenco da novela...",
  "Ajustando a luz do drama...",
  "Ensaiando a fala das frutas...",
  "Gravando a cena...",
  "Finalizando a sua historinha...",
];

/**
 * Rascunho guardado no navegador da pessoa.
 *
 * Montar a cena custa crédito. Fechar a aba sem querer no meio do caminho
 * significava perder as escolhas E a imagem paga, com a sensação de dinheiro
 * jogado fora. Aqui a gente guarda as escolhas e a URL da cena; ao voltar, ela
 * escolhe se retoma ou começa de novo (retomar sozinho seria pior: ressuscitaria
 * historinha que ela já tinha desistido).
 */
const CHAVE_RASCUNHO = "boost_rascunho";
const VALIDADE_RASCUNHO_MS = 24 * 60 * 60 * 1000;

type Rascunho = {
  v: 1;
  em: number;
  passo: number;
  formato: string;
  frutas: string[];
  historia: string | null;
  cenario: string | null;
  cena: string | null;
  propria: HistorinhaPropria;
};

function lerRascunho(cru: string | null): Rascunho | null {
  if (!cru) return null;
  try {
    const r = JSON.parse(cru) as Rascunho;
    if (r?.v !== 1 || !r.em || Date.now() - r.em > VALIDADE_RASCUNHO_MS) return null;
    return r;
  } catch {
    return null;
  }
}

function apagarRascunho() {
  try {
    localStorage.removeItem(CHAVE_RASCUNHO);
  } catch {
    /* navegador sem localStorage: nada a fazer */
  }
  window.dispatchEvent(new Event("boost-rascunho"));
}

/** Avisa o React quando o rascunho muda (esta aba ou outra). */
function assinarRascunho(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("boost-rascunho", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("boost-rascunho", callback);
  };
}

export function ViralBoost() {
  const [passo, setPasso] = useState(0);
  const [formato, setFormato] = useState("frutas");
  const [frutas, setFrutas] = useState<string[]>([]);
  const [meusPersonagens, setMeusPersonagens] = useState<FrutaPersonagem[]>([]);
  const [propria, setPropria] = useState<HistorinhaPropria>({
    nome: "",
    sinopse: "",
    tom: "",
    batidas: ROTULOS_BATIDA.map((rotulo) => ({ rotulo, acao: "", fala: "" })),
  });
  const [historia, setHistoria] = useState<string | null>(null);
  const [cenario, setCenario] = useState<string | null>(null);

  const [cena, setCena] = useState<string | null>(null);
  const [gerandoCena, setGerandoCena] = useState(false);
  const [erroCena, setErroCena] = useState<string | null>(null);

  const [status, setStatus] = useState<"parado" | "gerando" | "pronto" | "erro">("parado");
  const [video, setVideo] = useState<string | null>(null);
  const [etapaVideo, setEtapaVideo] = useState("");
  const [erroVideo, setErroVideo] = useState<string | null>(null);
  const [frase, setFrase] = useState(0);
  const jaGerouCena = useRef(false);
  const [rascunhoDispensado, setRascunhoDispensado] = useState(false);

  const fmt = formatoPorChave(formato);
  const acharPersonagem = (c: string) =>
    c.startsWith("meu-") ? (meusPersonagens.find((m) => m.chave === c) ?? null) : frutaPorChave(c);
  const escolhidas = frutas.map(acharPersonagem).filter((f): f is FrutaPersonagem => !!f);
  const nomes = escolhidas.map((f) => f.nome);
  const h =
    historia === "propria"
      ? historinhaDe(propria, Math.max(1, frutas.length), formato)
      : historinhaPorChave(historia);
  const batidas = h ? h.batidas(nomes) : [];
  /**
   * Um personagem manda UMA foto pro motor e por isso rende 15s; dois ou três
   * mandam várias e o motor só entrega 10s. A cena montada também é uma imagem
   * só, então quem gera a cena antes ganha os 15s do mesmo jeito.
   */
  const duracao = duracaoBoost(cena ? 1 : Math.max(1, escolhidas.length));
  const CUSTO_VIDEO = custoVideoLab(duracao === 15 ? "15s" : "10s");
  const limite = limitePalavras(duracao);
  const palavrasPropria = propria.batidas.reduce((n, b) => n + contarPalavras(b.fala), 0);
  // as três falas precisam existir E caber no tempo do vídeo: passar do orçamento
  // significa fala atropelada ou cortada no meio, com o crédito já gasto
  const propriaOk =
    propria.batidas.every((b) => b.fala.trim().length > 2) &&
    palavrasPropria <= limite;

  /**
   * Qualquer mudança de escolha invalida a CENA já gerada. Sem isso dava pra
   * voltar na trilha, trocar a historinha e mandar gerar o vídeo com a imagem
   * velha e o roteiro novo: vídeo incoerente e 95 créditos cobrados do mesmo
   * jeito. Regenerar a cena custa, então a gente só descarta, nunca gera sozinho.
   */
  function invalidarCena() {
    if (!cena && status === "parado") return;
    setCena(null);
    setVideo(null);
    setStatus("parado");
    setErroCena(null);
    setErroVideo(null);
    jaGerouCena.current = false;
  }

  function trocarPersonagens(chaves: string[]) {
    setFrutas(chaves);
    invalidarCena();
    // trocar o elenco pode invalidar a história escolhida
    const hh = historinhaPorChave(historia);
    if (hh && hh.frutas !== chaves.length) setHistoria(null);
  }

  async function gerarCena() {
    if (!h || !cenario || gerandoCena) return;
    setGerandoCena(true);
    setErroCena(null);
    try {
      const r = await fetch("/api/boost/imagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formato,
          historinha: historia,
          frutas,
          cenario,
          ...(historia === "propria" ? { propria } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        throw new Error(
          d?.faltaCreditos
            ? `Você precisa de ${d.custo ?? CUSTO_IMAGEM_LAB} créditos pra montar a cena.`
            : (d?.erro ?? "Não consegui montar a cena."),
        );
      }
      setCena(d.imagemUrl as string);
      toast.success("Cena pronta! Agora é só gerar o vídeo.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não consegui montar a cena.";
      setErroCena(msg);
      toast.error(msg);
    } finally {
      setGerandoCena(false);
    }
  }

  // A cena NÃO é mais gerada sozinha: o vídeo de 10s aceita as fotos dos
  // personagens direto, então montar a cena antes virou opcional (e paga).

  // ===== RASCUNHO (não perder o que já foi pago se fechar a aba) =====

  const rascunhoCru = useSyncExternalStore(
    assinarRascunho,
    () => localStorage.getItem(CHAVE_RASCUNHO),
    () => null,
  );
  const rascunho = lerRascunho(rascunhoCru);
  // só oferece retomar enquanto a pessoa não começou nada nesta visita
  const mostrarRetomar =
    !!rascunho &&
    !rascunhoDispensado &&
    status === "parado" &&
    frutas.length === 0 &&
    !historia &&
    !cenario &&
    !cena;

  function retomarRascunho() {
    if (!rascunho) return;
    setFormato(rascunho.formato);
    setFrutas(rascunho.frutas);
    setHistoria(rascunho.historia);
    setCenario(rascunho.cenario);
    setCena(rascunho.cena);
    setPropria(rascunho.propria);
    setPasso(rascunho.passo);
    setRascunhoDispensado(true);
    toast.success("Pronto, voltamos de onde você parou.");
  }

  function descartarRascunho() {
    setRascunhoDispensado(true);
    apagarRascunho();
  }

  // Guarda o rascunho a cada mudança. Só grava quando existe progresso de
  // verdade, senão a tela recém-aberta (tudo vazio) apagaria o que estava salvo.
  useEffect(() => {
    if (status === "pronto") return;
    const temProgresso = frutas.length > 0 || !!historia || !!cenario || !!cena;
    if (!temProgresso) return;
    const r: Rascunho = {
      v: 1,
      em: Date.now(),
      passo,
      formato,
      frutas,
      historia,
      cenario,
      cena,
      propria,
    };
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
    } catch {
      /* cota cheia ou modo privado: seguir sem guardar */
    }
  }, [passo, formato, frutas, historia, cenario, cena, propria, status]);

  // Enquanto a CENA está sendo montada não dá pra recuperar: o crédito já foi
  // debitado e a imagem só existe no fim da chamada. Aí sim vale segurar a saída.
  // (O VÍDEO não precisa disso: ele termina no servidor e avisa no sininho.)
  useEffect(() => {
    if (!gerandoCena) return;
    const segurar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [gerandoCena]);

  // frases girando durante a espera do vídeo
  useEffect(() => {
    if (status !== "gerando") return;
    const t = setInterval(() => setFrase((f) => (f + 1) % FRASES.length), 5000);
    return () => clearInterval(t);
  }, [status]);

  async function acompanhar(jobId: string) {
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 6000));
      try {
        const r = await fetch(`/api/lab/video/${jobId}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) continue;
        if (d.etapa) setEtapaVideo(d.etapa as string);
        if (d.status === "pronto" && d.videoUrl) {
          setVideo(d.videoUrl as string);
          setStatus("pronto");
          apagarRascunho(); // entregou: o rascunho não serve mais pra nada
          toast.success("Sua historinha ficou pronta!");
          return;
        }
        if (d.status === "erro") {
          setErroVideo((d.erro as string) ?? "Não consegui gerar o vídeo.");
          setStatus("erro");
          return;
        }
      } catch {
        // hiccup de rede: tenta no próximo ciclo
      }
    }
    setErroVideo("Está demorando mais que o normal. Veja em Meus vídeos daqui a pouco.");
    setStatus("erro");
  }

  async function gerarVideo() {
    // a CENA é opcional desde que o vídeo passou a sair direto das fotos dos
    // personagens: exigir ela aqui deixava o botão principal sem fazer nada
    if (!h || status === "gerando") return;
    setStatus("gerando");
    setErroVideo(null);
    setEtapaVideo("Enviando pro estúdio...");
    try {
      const r = await fetch("/api/boost/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // sem cena montada, o motor recebe a foto de cada personagem
          ...(cena ? { imagem: cena } : {}),
          formato,
          historinha: historia,
          frutas,
          cenario,
          ...(historia === "propria" ? { propria } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.jobId) {
        throw new Error(
          d?.faltaCreditos
            ? `Você precisa de ${d.custo ?? CUSTO_VIDEO} créditos pra gerar o vídeo.`
            : (d?.erro ?? "Não consegui iniciar a geração."),
        );
      }
      acompanhar(d.jobId as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não consegui iniciar a geração.";
      setErroVideo(msg);
      setStatus("erro");
      toast.error(msg);
    }
  }

  function recomecar() {
    setPasso(0);
    setFormato("frutas");
    setFrutas([]);
    setHistoria(null);
    setCenario(null);
    setCena(null);
    setVideo(null);
    setStatus("parado");
    jaGerouCena.current = false;
    setRascunhoDispensado(true);
    apagarRascunho();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const podeAvancar =
    PASSOS[passo].chave === "formato"
      ? true
      : PASSOS[passo].chave === "frutas"
        ? frutas.length >= 1
        : PASSOS[passo].chave === "historia"
          ? historia === "propria"
            ? propriaOk
            : !!historia
          : PASSOS[passo].chave === "cenario"
            ? !!cenario
            : false;

  return (
    <div className="space-y-5">
      {/* ===== RETOMAR O QUE FICOU PELO CAMINHO ===== */}
      {mostrarRetomar && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <History className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">Você tinha uma historinha em andamento</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rascunho?.cena
                  ? "Guardamos suas escolhas e a cena que você já montou. Retomar não cobra crédito de novo."
                  : "Guardamos as escolhas que você já tinha feito."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={retomarRascunho}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <History className="size-4" />
              Retomar
            </button>
            <button
              type="button"
              onClick={descartarRascunho}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Começar do zero
            </button>
          </div>
        </div>
      )}

      {/* ===== TRILHA ===== */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PASSOS.map((p, i) => {
            const feito = i < passo;
            const ativo = i === passo;
            return (
              <div key={p.chave} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={i > passo}
                  onClick={() => setPasso(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:text-xs",
                    ativo
                      ? "border-primary/60 bg-primary/12 text-primary"
                      : feito
                        ? "border-primary/25 text-primary/70 hover:border-primary/50"
                        : "border-border/60 text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-full text-[9px] font-bold",
                      ativo || feito
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {feito ? <Check className="size-2.5" /> : i + 1}
                  </span>
                  {p.label}
                </button>
                {i < PASSOS.length - 1 && (
                  <span className={cn("h-px w-3 sm:w-6", feito ? "bg-primary/40" : "bg-border/60")} />
                )}
              </div>
            );
          })}
        </div>
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)] transition-[width] duration-500"
            style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }}
          />
        </div>
      </div>

      <div key={PASSOS[passo].chave} className="duration-300 animate-in fade-in slide-in-from-bottom-2">
        {/* ===== 0. FORMATO ===== */}
        {PASSOS[passo].chave === "formato" && (
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Flame className="size-4 text-primary" />
              Qual formato você quer?
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {FORMATOS.map((f) => {
                const ativo = formato === f.chave;
                return (
                  <button
                    key={f.chave}
                    type="button"
                    onClick={() => {
                      if (f.chave === formato) return;
                      setFormato(f.chave);
                      setFrutas([]);
                      setHistoria(null);
                      setCenario(null);
                      // a historinha escrita cita os personagens do formato antigo
                      setPropria({
                        nome: "",
                        sinopse: "",
                        tom: "",
                        batidas: ROTULOS_BATIDA.map((rotulo) => ({ rotulo, acao: "", fala: "" })),
                      });
                      invalidarCena();
                    }}
                    aria-pressed={ativo}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      ativo
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/40 hover:bg-card",
                    )}
                  >
                    <p className={cn("font-semibold", ativo && "text-primary")}>{f.nome}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{f.descricao}</p>
                  </button>
                );
              })}
            </div>
            {fmt.aviso && (
              <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                {fmt.aviso}
              </p>
            )}
          </section>
        )}

        {/* ===== 1. PERSONAGENS ===== */}
        {PASSOS[passo].chave === "frutas" && (
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users className="size-4 text-primary" />
              {fmt.maxPersonagens > 1 ? "Escolha de 1 a 3 personagens" : "Escolha quem aparece"}
            </h2>
            {fmt.maxPersonagens > 1 && (
              <p className="mt-1 text-sm text-muted-foreground">
                <strong>1</strong> vira monólogo, <strong>2</strong> viram casal ou dupla e{" "}
                <strong>3</strong> viram triângulo amoroso.
              </p>
            )}
            <div className="mt-4">
              <BoostPersonagens
                formato={formato}
                escolhidos={frutas}
                onEscolher={trocarPersonagens}
                onLista={setMeusPersonagens}
                max={fmt.maxPersonagens}
              />
            </div>
          </section>
        )}

        {/* ===== 2. HISTORINHA ===== */}
        {PASSOS[passo].chave === "historia" && (
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <BookOpen className="size-4 text-primary" />
              Escolha a historinha
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mostrando o que combina com {frutas.length} personagem
              {frutas.length > 1 ? "s" : ""}.
            </p>
            <div className="mt-4 space-y-2.5">
              {/* escrever a minha: mesmo caminho, texto dela */}
              <button
                type="button"
                onClick={() => {
                  setHistoria("propria");
                  invalidarCena();
                  if (!cenario) setCenario(cenariosDoFormato(formato)[0].chave);
                }}
                aria-pressed={historia === "propria"}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                  historia === "propria"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-dashed border-border/60 hover:border-primary/40 hover:bg-card",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block font-semibold", historia === "propria" && "text-primary")}>
                    Escrever a minha
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Você conta a ideia numa frase e a IA escreve as três batidas. Ou digita tudo do
                    seu jeito.
                  </span>
                </span>
              </button>

              {historia === "propria" && (
                <BoostHistorinhaPropria
                  formato={formato}
                  personagens={escolhidas}
                  duracao={duracao}
                  valor={propria}
                  onMudar={setPropria}
                />
              )}

              {historinhasPara(frutas.length, formato).map((item) => {
                const ativo = historia === item.chave;
                return (
                  <button
                    key={item.chave}
                    type="button"
                    onClick={() => {
                      setHistoria(item.chave);
                      invalidarCena();
                      if (!cenario) setCenario(item.cenarioPadrao);
                    }}
                    aria-pressed={ativo}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                      ativo
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/40 hover:bg-card",
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                      <Flame className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-semibold", ativo && "text-primary")}>
                        {item.nome}
                      </span>
                      <span className="block text-sm text-muted-foreground">{item.sinopse}</span>
                      <span className="mt-1 block text-xs italic text-muted-foreground/80">
                        Tom: {item.tom}
                      </span>
                    </span>
                  </button>
                );
              })}
              {historinhasPara(frutas.length, formato).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma historinha pronta pra essa combinação. Escreva a sua aí em cima.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ===== 3. CENÁRIO ===== */}
        {PASSOS[passo].chave === "cenario" && (
          <section className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4 text-primary" />
              Onde acontece
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {cenariosDoFormato(formato).map((c) => {
                const ativo = cenario === c.chave;
                return (
                  <button
                    key={c.chave}
                    type="button"
                    onClick={() => {
                      setCenario(c.chave);
                      invalidarCena();
                    }}
                    aria-pressed={ativo}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-sm font-medium transition-all",
                      ativo
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                        : "border-border/60 hover:border-primary/40 hover:bg-card",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {cenario && (
              <p className="mt-3 text-xs text-muted-foreground">
                {cenarioFrutaPorChave(cenario).descricao}
              </p>
            )}
          </section>
        )}

        {/* ===== 4. GERAR ===== */}
        {PASSOS[passo].chave === "gerar" && h && (
          <div className="space-y-4">
            {/* roteiro */}
            <section className="rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
              <h2 className="flex items-center gap-2 font-semibold">
                <BookOpen className="size-4 text-primary" />
                {h.nome} · {nomes.join(" e ")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {h.sinopse} Cenário: {cenarioFrutaPorChave(cenario).label.toLowerCase()}. Vídeo de 15
                segundos, num take só.
              </p>
              <div className="mt-3 space-y-2">
                {batidas.map((b, i) => (
                  <div key={i} className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {b.rotulo}
                    </p>
                    <p className="text-xs text-muted-foreground">{b.acao}</p>
                    <p className="mt-1 text-sm">“{b.fala}”</p>
                  </div>
                ))}
              </div>
            </section>

            {/* cena + vídeo */}
            <section className="rounded-2xl border border-primary/40 bg-primary/8 p-5 shadow-[0_0_40px_-18px_var(--color-primary)] sm:p-6">
              <div className="mx-auto w-full max-w-sm">
                <div
                  className={cn(
                    "relative aspect-[9/16] overflow-hidden rounded-2xl border bg-black/40",
                    video ? "border-primary" : "border-border/60",
                  )}
                >
                  {video ? (
                    <video
                      src={video}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="size-full object-contain"
                    />
                  ) : cena ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cena} alt="Cena da historinha" className="size-full object-cover" />
                      {status === "gerando" && (
                        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <span className="relative grid size-16 place-items-center">
                              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                              <Clapperboard className="size-7 text-primary" />
                            </span>
                            <p className="text-sm font-semibold text-white">{etapaVideo}</p>
                            <p className="text-xs text-white/70">{FRASES[frase]}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid size-full place-items-center p-6 text-center">
                      {gerandoCena ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="size-7 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            Montando a cena com {nomes.join(" e ")}...
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <Clapperboard className="size-7 text-primary/70" />
                          <p className="max-w-xs text-center text-sm text-muted-foreground">
                            {erroCena ??
                              `Tudo pronto com ${nomes.join(" e ")}. Gere o vídeo direto, ou veja a cena antes se quiser conferir o quadro.`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {!video && status !== "gerando" && (
                  <>
                    <button
                      type="button"
                      onClick={gerarVideo}
                      disabled={gerandoCena}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_30px_-6px_var(--color-primary)] disabled:opacity-50"
                    >
                      <Clapperboard className="size-4" />
                      Gerar vídeo de {duracao}s ({CUSTO_VIDEO} créditos)
                    </button>
                    {/* ver a cena antes é opcional: custa e não é necessário pro vídeo */}
                    <button
                      type="button"
                      onClick={gerarCena}
                      disabled={gerandoCena}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                    >
                      <RefreshCw className="size-4" />
                      {cena ? "Outra cena" : `Ver a cena antes (${CUSTO_IMAGEM_LAB} créditos)`}
                    </button>
                  </>
                )}

                {video && (
                  <>
                    <a
                      href={linkBaixar(video, "historinha-de-fruta.mp4")}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Download className="size-4" />
                      Baixar vídeo
                    </a>
                    <Link
                      href="/painel"
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <FolderOpen className="size-4" />
                      Meus vídeos
                    </Link>
                    <button
                      type="button"
                      onClick={recomecar}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <Sparkles className="size-4" />
                      Fazer outra
                    </button>
                  </>
                )}

                {status === "erro" && (
                  <button
                    type="button"
                    onClick={gerarVideo}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <RefreshCw className="size-4" />
                    Tentar de novo
                  </button>
                )}
              </div>

              {status === "erro" && erroVideo && (
                <p className="mt-3 text-center text-xs text-amber-400">{erroVideo}</p>
              )}
              {/* A geração roda no servidor: a pessoa não precisa ficar olhando a
                  tela. O aviso é grande de propósito, senão dá a impressão de que o
                  painel travou e ela fica esperando parada por 5 minutos. */}
              {status === "gerando" && (
                <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/8 p-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
                    <Bell className="size-4" />
                    Seu vídeo está sendo gerado!
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Esse processo leva de 3 a 5 minutos. Você pode sair desta página,
                    fechar a aba ou navegar pelo painel tranquilamente. Enviaremos uma
                    notificação no sininho do cabeçalho assim que estiver concluído e
                    você poderá assisti-lo em Meus vídeos.
                  </p>
                  <Link
                    href="/painel"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <FolderOpen className="size-4" />
                    Acompanhar em Meus vídeos
                  </Link>
                </div>
              )}
            </section>

            {/* hashtags */}
            <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Hashtags pra postar</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(hashtagsDa(h, nomes).join(" "));
                    toast.success("Hashtags copiadas!");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                  Copiar
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{hashtagsDa(h, nomes).join(" ")}</p>
            </section>
          </div>
        )}
      </div>

      {/* ===== NAVEGAÇÃO ===== */}
      {PASSOS[passo].chave !== "gerar" && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={passo === 0}
            onClick={() => setPasso(passo - 1)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </button>
          <button
            type="button"
            disabled={!podeAvancar}
            onClick={() => setPasso(passo + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_24px_-6px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próximo
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
