"use client";

import { useState } from "react";
import {
  Video,
  Image as ImageIcon,
  Compass,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTILOS_CAMERA, estiloPorChave, type EstiloCamera } from "@/lib/estilos-camera";
import { LabProdutos, type ProdutoLab } from "@/components/app/lab-produtos";
import { LabCena } from "@/components/app/lab-cena";
import { LabCenario } from "@/components/app/lab-cenario";
import { LabAvatares, SEM_AVATAR, type AvatarLab } from "@/components/app/lab-avatares";
import { LabResumo } from "@/components/app/lab-resumo";
import { LabImagem } from "@/components/app/lab-imagem";
import { LabVideo, type ConfigVideoLab } from "@/components/app/lab-video";
import { LabMovimentos } from "@/components/app/lab-movimentos";
import { LabResumoVideo } from "@/components/app/lab-resumo-video";

/**
 * Viraliza Lab V2: o caminho guiado que transforma um produto em criativo.
 * Três etapas grandes (criar a cena, gerar a IMAGEM, animar em VÍDEO). O "Criar
 * cena" tem quatro telas internas (estilo, produto + descrição, influenciador,
 * cenário) e quem mostra o avanço delas é a barra neon embaixo da trilha.
 */

const ETAPAS = [
  { chave: "cena", label: "Criar cena", Icone: Compass },
  { chave: "imagem", label: "Gerar imagem", Icone: ImageIcon },
  { chave: "video", label: "Gerar vídeo", Icone: Video },
] as const;

type Etapa = (typeof ETAPAS)[number]["chave"];

/** Telas internas do "Criar cena" (a trilha do topo não muda entre elas). */
const SUBS = ["estilo", "produto", "avatar", "cenario", "resumo"] as const;
type SubCena = (typeof SUBS)[number];

/** Envelope com a animação de entrada de cada tela (sobe suave e aparece). */
function Tela({ chave, children }: { chave: string; children: React.ReactNode }) {
  return (
    <div
      key={chave}
      className="mt-8 space-y-5 duration-500 animate-in fade-in slide-in-from-bottom-4"
    >
      {children}
    </div>
  );
}

/** Barra de progresso neon: quanto já foi preenchido da etapa atual. */
function BarraProgresso({ pct }: { pct: number }) {
  return (
    <div className="mx-auto h-1 w-full max-w-xl overflow-hidden rounded-full bg-border/60">
      <div
        className="h-full rounded-full bg-primary shadow-[0_0_12px_var(--color-primary),0_0_28px_var(--color-primary)] transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/** Trilha das etapas: mostra onde a pessoa está e o que vem depois. */
function Trilha({ atual }: { atual: Etapa }) {
  const indice = ETAPAS.findIndex((e) => e.chave === atual);
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {ETAPAS.map(({ chave, label, Icone }, i) => (
        <div key={chave} className="flex items-center gap-1 sm:gap-2">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:gap-2 sm:px-4 sm:py-2 sm:text-sm",
              i === indice
                ? "border-primary/60 bg-primary/12 text-primary"
                : i < indice
                  ? "border-primary/25 text-primary/70"
                  : "border-border/60 text-muted-foreground",
            )}
          >
            {i < indice ? (
              <Check className="size-3.5 sm:size-4" />
            ) : (
              <Icone className="size-3.5 sm:size-4" />
            )}
            {label}
          </div>
          {i < ETAPAS.length - 1 && (
            <span
              className={cn(
                "h-px w-2 sm:w-12",
                i < indice ? "bg-primary/40" : "bg-border/60",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Card de um estilo: vídeo de exemplo em loop + nome + pra que serve. */
function CardEstilo({
  estilo,
  ativo,
  onEscolher,
}: {
  estilo: EstiloCamera;
  ativo: boolean;
  onEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativo}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border bg-card/60 text-left transition-all",
        ativo
          ? "border-primary ring-2 ring-primary/40"
          : "border-border/60 hover:border-primary/40 hover:bg-card",
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
        <video
          src={estilo.video}
          poster={estilo.poster}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {ativo && (
          <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg sm:size-7">
            <Check className="size-3.5 sm:size-4" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:gap-1.5 sm:p-4">
        <h3 className="text-sm font-semibold sm:text-base">{estilo.label}</h3>
        {/* no celular o texto fica curto (3 linhas) pra não virar um bloco enorme */}
        <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground sm:line-clamp-none sm:text-[13px]">
          {estilo.descricao}
        </p>
        <span className="mt-auto pt-1.5 text-[10px] font-medium uppercase tracking-wide text-primary/80 sm:pt-2 sm:text-[11px]">
          {estilo.paraQuem}
        </span>
      </div>
    </button>
  );
}

/** Caixa numerada de um bloco da tela. */
function Bloco({
  n,
  titulo,
  obrigatorio = false,
  children,
}: {
  n: number;
  titulo: string;
  obrigatorio?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/40 p-5 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {n}
        </span>
        <h2 className="font-semibold">
          {titulo} {obrigatorio && <span className="text-primary">*</span>}
        </h2>
      </div>
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
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {rotulo}
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

export function ViralizaLab({
  meusAvatares: avataresIniciais = [],
}: {
  meusAvatares?: AvatarLab[];
}) {
  const [etapa, setEtapa] = useState<Etapa>("cena");
  const [sub, setSub] = useState<SubCena>("estilo");
  // tela interna do "Gerar vídeo": configuração e depois os movimentos
  const [subVideo, setSubVideo] = useState<"config" | "movimento" | "resumo">("config");
  const [estilo, setEstilo] = useState<string | null>(null);
  const [produto, setProduto] = useState<ProdutoLab | null>(null);
  const [cena, setCena] = useState("");
  const [avatar, setAvatar] = useState<AvatarLab | null>(null);
  const [meusAvatares, setMeusAvatares] = useState<AvatarLab[]>(avataresIniciais);
  const [cenario, setCenario] = useState<string | null>(null);
  const [cenarioTexto, setCenarioTexto] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  // true quando a pessoa clicou em "já tenho a imagem": a etapa da imagem abre no
  // modo de subir/escolher, sem disparar (e sem cobrar) a geração sozinha
  const [imagemPropria, setImagemPropria] = useState(false);
  const [video, setVideo] = useState<ConfigVideoLab>({
    duracao: "15s",
    tom: "animado",
    voz: "feminina",
    tonalidade: "media",
    falas: [""],
    instrucoes: "",
    movimento: null,
  });

  const estiloSel = estiloPorChave(estilo);
  const cenarioOk = !!cenario && (cenario !== "outros" || cenarioTexto.trim().length >= 4);
  const prontoPraImagem = !!produto && cena.trim().length >= 15 && !!avatar && cenarioOk;

  // barra neon: cada tela interna preenchida soma um pedaço do "Criar cena"
  const feitos = [
    !!estilo,
    !!produto && cena.trim().length >= 15,
    !!avatar,
    cenarioOk,
  ].filter(Boolean).length;
  // a barra mede a JORNADA toda: Criar cena vai de 0 a 33%, Gerar imagem até 66%,
  // Gerar vídeo fecha em 100%. Assim terminar o cenário não parece "acabou".
  const PASSOS_CENA = 4; // estilo, produto + descrição, influenciador, cenário
  const pct =
    etapa === "cena"
      ? Math.max(4, (feitos / PASSOS_CENA) * 33)
      : etapa === "imagem"
        ? 66
        : 100;

  function irPara(prox: Etapa) {
    setEtapa(prox);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function irSub(prox: SubCena) {
    setSub(prox);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function irSubVideo(prox: "config" | "movimento" | "resumo") {
    setSubVideo(prox);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {/* Fundo do laboratório: a grade cobre a tela inteira (fixed, acompanha o
          scroll), com brilho verde no topo e escurecendo nas bordas pra não
          competir com o conteúdo. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[44px_44px] opacity-50 sm:bg-size-[56px_56px]" />
        <div className="absolute left-1/2 top-0 size-[680px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-primary/6 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_10%,transparent_20%,var(--background)_95%)]" />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 pt-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary sm:px-4 sm:text-xs">
          <Video className="size-3.5 shrink-0" />O laboratório onde produtos viram
          criativos
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Viraliza <span className="text-primary">Lab V2</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
            Ambiente de criação onde você transforma produtos validados em criativos
            prontos.
          </p>
        </div>
        <Trilha atual={etapa} />
        <BarraProgresso pct={pct} />
      </div>

      {etapa === "cena" && sub === "estilo" && (
        <Tela chave="estilo">
          <Bloco n={1} titulo="Estilo da câmera" obrigatorio>
            <p className="text-sm text-muted-foreground">
              Escolha o estilo de câmera ideal para o tipo do seu produto: cada opção é
              pensada para uma categoria diferente.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
              {ESTILOS_CAMERA.map((e) => (
                <CardEstilo
                  key={e.chave}
                  estilo={e}
                  ativo={estilo === e.chave}
                  onEscolher={() => setEstilo(e.chave)}
                />
              ))}
            </div>
          </Bloco>

          <Navegacao podeAvancar={!!estilo} onAvancar={() => irSub("produto")} />
        </Tela>
      )}

      {etapa === "cena" && estiloSel && sub === "produto" && (
        <Tela chave="produto">
          <Bloco n={1} titulo="Selecione um produto" obrigatorio>
            <LabProdutos
              estilo={estiloSel}
              produto={produto}
              onEscolher={setProduto}
              onTrocarEstilo={(chave) => setEstilo(chave)}
            />
          </Bloco>

          <Bloco
            n={2}
            titulo="Como o produto e o avatar devem aparecer na imagem?"
            obrigatorio
          >
            <LabCena
              estilo={estiloSel}
              produtoTitulo={produto?.titulo}
              valor={cena}
              onMudar={setCena}
            />
          </Bloco>

          <Navegacao
            onVoltar={() => irSub("estilo")}
            podeAvancar={!!produto && cena.trim().length >= 15}
            onAvancar={() => {
              // POV não tem pessoa na cena: já deixa "Nenhum" escolhido
              if (estiloSel.chave === "maos" && !avatar) setAvatar(SEM_AVATAR);
              irSub("avatar");
            }}
          />
        </Tela>
      )}

      {etapa === "cena" && estiloSel && sub === "avatar" && (
        <Tela chave="avatar">
          <Bloco n={1} titulo="Escolha o influenciador" obrigatorio>
            <LabAvatares
              estilo={estiloSel}
              meus={meusAvatares}
              escolhido={avatar}
              onEscolher={setAvatar}
              onNovoAvatar={(a) => setMeusAvatares((atual) => [a, ...atual])}
              onExcluirAvatar={(id) =>
                setMeusAvatares((atual) => atual.filter((a) => a.id !== id))
              }
            />
          </Bloco>

          <Navegacao
            onVoltar={() => irSub("produto")}
            podeAvancar={!!avatar}
            onAvancar={() => irSub("cenario")}
          />
        </Tela>
      )}

      {etapa === "cena" && sub === "cenario" && (
        <Tela chave="cenario">
          <Bloco n={1} titulo="Cenário" obrigatorio>
            <LabCenario
              escolhido={cenario}
              textoLivre={cenarioTexto}
              onEscolher={setCenario}
              onTextoLivre={setCenarioTexto}
            />
          </Bloco>

          <Navegacao
            onVoltar={() => irSub("avatar")}
            podeAvancar={cenarioOk}
            rotulo="Revisar"
            onAvancar={() => irSub("resumo")}
          />
        </Tela>
      )}

      {etapa === "cena" && estiloSel && produto && avatar && cenario && sub === "resumo" && (
        <Tela chave="resumo">
          <section className="rounded-3xl border border-border/60 bg-card/40 p-5 sm:p-7">
            <LabResumo
              estilo={estiloSel}
              produto={produto}
              avatar={avatar}
              cenario={cenario}
              cenarioTexto={cenarioTexto}
              cena={cena}
              onEditar={(destino) => irSub(destino)}
            />
          </section>

          {/* chamada da geração: card destacado com brilho, o "botão da vez" */}
          <section className="rounded-3xl border border-primary/40 bg-primary/8 p-5 shadow-[0_0_40px_-18px_var(--color-primary)] sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Gerar imagem com IA</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A imagem é criada com base nas suas escolhas. Depois você usa ela
                  para gerar o vídeo final.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!prontoPraImagem}
              onClick={() => {
                setImagemPropria(false);
                irPara("imagem");
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_30px_-6px_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="size-4" />
              Gerar imagem
            </button>

            {/* quem já tem a foto do avatar com o produto não precisa gerar de
                novo: entra direto no vídeo, sem gastar crédito */}
            <button
              type="button"
              onClick={() => {
                setImagemPropria(true);
                irPara("imagem");
              }}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <SkipForward className="size-3.5" />
              Já tenho a imagem pronta, quero usar a minha
            </button>
          </section>

          <Navegacao
            onVoltar={() => irSub("cenario")}
            podeAvancar={prontoPraImagem}
            rotulo="Gerar imagem"
            onAvancar={() => irPara("imagem")}
          />
        </Tela>
      )}
      {etapa === "imagem" && estiloSel && produto && avatar && cenario && (
        <Tela chave="imagem">
          <Bloco n={1} titulo="Sua imagem">
            <LabImagem
              estilo={estiloSel}
              produto={produto}
              avatar={avatar}
              cena={cena}
              cenario={cenario}
              cenarioTexto={cenarioTexto}
              imagem={imagem}
              onGerou={setImagem}
              minhasImagens={meusAvatares}
              comecarPulando={imagemPropria}
            />
          </Bloco>

          <Navegacao
            onVoltar={() => irPara("cena")}
            podeAvancar={!!imagem}
            rotulo="Gerar vídeo"
            onAvancar={() => irPara("video")}
          />
        </Tela>
      )}

      {etapa === "video" && imagem && subVideo === "config" && (
        <Tela chave="video-config">
          <Bloco n={1} titulo="Como vai ser o vídeo" obrigatorio>
            <LabVideo config={video} onMudar={setVideo} produtoNome={produto?.titulo} />
          </Bloco>

          <Navegacao
            onVoltar={() => irPara("imagem")}
            podeAvancar
            rotulo="Próximo"
            onAvancar={() => {
              setSubVideo("movimento");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </Tela>
      )}

      {etapa === "video" && imagem && subVideo === "movimento" && (
        <Tela chave="video-movimento">
          <Bloco n={1} titulo="Movimento do vídeo">
            <LabMovimentos
              estilo={estilo}
              escolhido={video.movimento}
              onEscolher={(m) => setVideo({ ...video, movimento: m })}
            />
          </Bloco>

          <Navegacao
            onVoltar={() => irSubVideo("config")}
            podeAvancar
            rotulo="Revisar"
            onAvancar={() => irSubVideo("resumo")}
          />
        </Tela>
      )}

      {etapa === "video" && imagem && subVideo === "resumo" && (
        <Tela chave="video-resumo">
          <section className="rounded-3xl border border-border/60 bg-card/40 p-5 sm:p-7">
            <LabResumoVideo
              config={video}
              imagem={imagem}
              onEditar={(destino) => irSubVideo(destino)}
            />
          </section>

          <section className="rounded-3xl border border-primary/40 bg-primary/8 p-5 shadow-[0_0_40px_-18px_var(--color-primary)] sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Gerar vídeo com IA</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A imagem ganha movimento e fala. Costuma levar de 3 a 5 minutos.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_30px_-6px_var(--color-primary)]"
            >
              <Sparkles className="size-4" />
              Gerar vídeo
            </button>
          </section>

          <Navegacao
            onVoltar={() => irSubVideo("movimento")}
            podeAvancar
            rotulo="Gerar vídeo"
            onAvancar={() => {}}
          />
        </Tela>
      )}
    </div>
  );
}
