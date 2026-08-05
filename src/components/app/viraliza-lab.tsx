"use client";

import { useEffect, useState } from "react";
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
import {
  ESTILOS_CAMERA,
  estiloPorChave,
  VARIACOES_POV,
  variacaoPovPorChave,
  type EstiloCamera,
} from "@/lib/estilos-camera";
import type { CenaDaImagem } from "@/lib/movimentos";
import { LabProdutos, type ProdutoLab } from "@/components/app/lab-produtos";
import { LabCena } from "@/components/app/lab-cena";
import { LabCenario } from "@/components/app/lab-cenario";
import { LabAvatares, SEM_AVATAR, type AvatarLab } from "@/components/app/lab-avatares";
import { LabResumo } from "@/components/app/lab-resumo";
import { LabImagem } from "@/components/app/lab-imagem";
import { LabVideo, type ConfigVideoLab } from "@/components/app/lab-video";
import { LabMovimentos } from "@/components/app/lab-movimentos";
import { LabResumoVideo } from "@/components/app/lab-resumo-video";
import { LabGerando } from "@/components/app/lab-gerando";
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import { espiarImagemParaVideo, limparImagemParaVideo } from "@/lib/lab-handoff";
import { custoVideoLab } from "@/lib/lab-custos";
import { falaCabeNoTempo } from "@/lib/lab-video";

/**
 * Viraliza Lab V2: o caminho guiado que transforma um produto em criativo.
 * Três etapas grandes (criar a cena, gerar a IMAGEM, animar em VÍDEO). O "Criar
 * cena" tem quatro telas internas (estilo, produto + descrição, influenciador,
 * cenário) e quem mostra o avanço delas é a barra neon embaixo da trilha.
 *
 * Esta tela é SÓ o funil guiado. As outras ferramentas do Labs (minhas imagens,
 * vídeo livre e gerador de prompt) eram abas de um dock aqui embaixo e hoje têm
 * rota própria, no submenu "Viraliza Labs" da barra lateral.
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

/** Telas internas do "Gerar vídeo". */
type SubVideo = "config" | "movimento" | "resumo" | "gerando";

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
  /**
   * "Novo vídeo" da galeria (tela "Minhas imagens"): a imagem já existe e já
   * sabemos como ela nasceu, então o funil abre montado e direto no passo do
   * vídeo. Nada é gerado de novo aqui, logo não custa crédito nenhum. A galeria
   * virou outra rota, então ela deixa a imagem de recado e manda a pessoa pra cá
   * (ver lab-handoff.ts); quem entra pelo menu não tem recado e começa do zero.
   */
  const [retomada] = useState(espiarImagemParaVideo);
  const ctx = retomada?.contexto ?? {};

  const [etapa, setEtapa] = useState<Etapa>(retomada ? "video" : "cena");
  const [sub, setSub] = useState<SubCena>("estilo");
  // tela interna do "Gerar vídeo": configuração, movimentos, revisão e a geração
  const [subVideo, setSubVideo] = useState<SubVideo>("config");
  // qual vídeo já foi pedido (sobrevive a quem desmonta a tela de geração e
  // antes fazia ela pedir tudo de novo)
  const [jobVideo, setJobVideo] = useState<string | null>(null);
  // idem pra imagem: marca que ela já foi pedida nessa sessão
  const [imagemPedidaEm, setImagemPedidaEm] = useState<number | null>(null);
  const [estilo, setEstilo] = useState<string | null>(ctx.estilo ?? null);
  // variação do estilo Mãos (POV): "maos" segurando ou "parado" na bancada
  const [variacao, setVariacao] = useState(ctx.variacao ?? "maos");
  const [produto, setProduto] = useState<ProdutoLab | null>(
    retomada
      ? {
          id: ctx.produtoId ?? "galeria",
          titulo: ctx.produtoTitulo ?? retomada.titulo,
          imagem: ctx.produtoImagem,
          meu: !!ctx.produtoMeu,
        }
      : null,
  );
  const [cena, setCena] = useState(ctx.cena ?? "");
  const [avatar, setAvatar] = useState<AvatarLab | null>(
    retomada
      ? ctx.avatarImagem
        ? {
            id: ctx.avatarId ?? "galeria",
            nome: ctx.avatarNome ?? "Influenciador",
            imagemUrl: ctx.avatarImagem,
          }
        : SEM_AVATAR
      : null,
  );
  const [meusAvatares, setMeusAvatares] = useState<AvatarLab[]>(avataresIniciais);
  const [cenario, setCenario] = useState<string | null>(ctx.cenario ?? null);
  const [cenarioTexto, setCenarioTexto] = useState(ctx.cenarioTexto ?? "");
  const [imagem, setImagem] = useState<string | null>(retomada?.imagem ?? null);
  // true quando a pessoa clicou em "já tenho a imagem": a etapa da imagem abre no
  // modo de subir/escolher, sem disparar (e sem cobrar) a geração sozinha.
  // Quem chegou pela galeria também entra assim: a imagem dela já está pronta.
  const [imagemPropria, setImagemPropria] = useState(!!retomada);
  // fala, instruções e movimento NÃO vêm da imagem retomada de propósito: são do
  // produto anterior, e se ficassem a pessoa pagaria um vídeo narrando outra coisa
  const [video, setVideo] = useState<ConfigVideoLab>({
    duracao: "15s",
    tom: "animado",
    voz: "feminina",
    tonalidade: "media",
    fala: "",
    instrucoes: "",
    movimento: null,
    semFala: false,
  });

  const estiloSel = estiloPorChave(estilo);
  // fala maior que o tempo do vídeo sai atropelada: segura aqui, antes de cobrar
  const falaCabe = falaCabeNoTempo(video.fala, video.duracao, video.semFala);
  const custoVideo = custoVideoLab(video.duracao);
  const ehPov = estilo === "maos";
  const variacaoSel = variacaoPovPorChave(variacao);
  // Quem manda na lista de movimentos é o ESTILO escolhido, e ponto: imagem POV
  // só anima movimento de POV; imagem com pessoa nunca mostra POV.
  const cenaImagem: CenaDaImagem = ehPov
    ? { temPessoa: false, temMaos: variacaoSel.temMaos }
    : { temPessoa: true, temMaos: true };

  /**
   * Guarda a imagem base e descobre o que existe nela: é isso que decide quais
   * movimentos aparecem depois. Quando a imagem é nossa, o funil já sabe (POV não
   * tem pessoa, "produto parado" não tem nem mão); quando veio de fora, só a IA
   * olhando a foto resolve.
   */
  function definirImagem(url: string) {
    setImagem(url);
  }
  // todo cenário agora é um card (nosso ou o que a pessoa subiu): escolheu, tá ok
  const cenarioOk = !!cenario;
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
    // voltar pra montagem da cena encerra o pedido da imagem SÓ se ela já
    // chegou: aí mexer e avançar gera (e custa) uma nova de propósito. No meio
    // da geração NÃO encerra, senão voltar/avançar disparava uma 2ª cobrança.
    if (prox === "cena" && imagem) setImagemPedidaEm(null);
    setEtapa(prox);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function irSub(prox: SubCena) {
    setSub(prox);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function irSubVideo(prox: SubVideo) {
    // sair da tela de geração encerra aquele pedido: se ela voltar e mandar
    // gerar de novo, é porque quer OUTRO vídeo (e aí sim custa de novo)
    if (prox !== "gerando") setJobVideo(null);
    setSubVideo(prox);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // O recado da galeria vale uma vez só: entrar no Labs pelo menu, depois, abre
  // o funil limpo em vez de cair de novo no vídeo da imagem anterior.
  useEffect(limparImagemParaVideo, []);

  /** Zera o funil pra criar outro criativo do zero (mantém os avatares salvos). */
  function recomecar() {
    setEstilo(null);
    setProduto(null);
    setCena("");
    setAvatar(null);
    setCenario(null);
    setCenarioTexto("");
    setImagem(null);
    setImagemPropria(false);
    setSubVideo("config");
    setJobVideo(null);
    setImagemPedidaEm(null);
    setSub("estilo");
    irPara("cena");
  }

  return (
    // a folga de baixo (espaço da barrinha flutuante) vem do layout do Labs
    <div className="relative">
      <LabCabecalho
        Icone={Video}
        chamada="O laboratório onde produtos viram criativos"
        titulo={
          <>
            Viraliza <span className="text-primary">Labs</span>
          </>
        }
        descricao="Ambiente de criação onde você transforma produtos validados em criativos prontos."
      >
        <Trilha atual={etapa} />
        <BarraProgresso pct={pct} />
      </LabCabecalho>

      {etapa === "cena" && sub === "estilo" && (
        <Tela chave="estilo">
          {/* ATALHO logo na entrada: quem JÁ tem a foto da influenciadora com o
              produto não precisa do funil da imagem: vai direto pro vídeo,
              sem gastar crédito nenhum na imagem. */}
          <button
            type="button"
            onClick={() => {
              if (!estilo) setEstilo("selfie");
              if (!produto) setProduto({ id: "proprio", titulo: "Meu produto", meu: true });
              if (!avatar) setAvatar(SEM_AVATAR);
              if (!cenario) setCenario("casa");
              setImagemPropria(true);
              irPara("imagem");
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-left transition-all hover:border-primary hover:bg-primary/10 sm:p-5"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <ImageIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold sm:text-base">
                Já tenho a imagem da minha influenciadora com o produto
              </span>
              <span className="block text-xs text-muted-foreground sm:text-sm">
                Pula a criação da imagem e vai direto pro vídeo. Não gasta crédito na imagem.
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-primary" />
          </button>

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
                  onEscolher={() => {
                    setEstilo(e.chave);
                    // trocar de estilo troca a lista de movimentos: o que estava
                    // marcado pode nem existir mais
                    setVideo((v) => (v.movimento ? { ...v, movimento: null } : v));
                  }}
                />
              ))}
            </div>

            {/* O POV tem dois enquadramentos possíveis, e a escolha muda o que dá
                pra animar depois: com as mãos no quadro dá pra girar e abrir o
                produto; com ele parado na bancada, só a câmera se move. */}
            {ehPov && (
              <div className="mt-5 space-y-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-4 duration-300 animate-in fade-in slide-in-from-top-2">
                <p className="text-sm font-medium">Como o POV vai ser?</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {VARIACOES_POV.map((v) => {
                    const ativo = variacao === v.chave;
                    return (
                      <button
                        key={v.chave}
                        type="button"
                        onClick={() => {
                          setVariacao(v.chave);
                          setVideo((c) => (c.movimento ? { ...c, movimento: null } : c));
                        }}
                        aria-pressed={ativo}
                        className={cn(
                          "rounded-xl border p-3 text-left transition-all",
                          ativo
                            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                            : "border-border/60 hover:border-primary/40 hover:bg-card",
                        )}
                      >
                        <p className={cn("text-sm font-semibold", ativo && "text-primary")}>
                          {v.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{v.descricao}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {variacaoSel.temMaos
                    ? "No vídeo você vai poder girar, abrir e inclinar o produto com as mãos."
                    : "Sem mãos no quadro, quem se move no vídeo é a câmera (aproximação e pan)."}
                </p>
              </div>
            )}
          </Bloco>

          <Navegacao podeAvancar={!!estilo} onAvancar={() => irSub("produto")} />
        </Tela>
      )}

      {etapa ==="cena" && estiloSel && sub === "produto" && (
        <Tela chave="produto">
          <Bloco n={2} titulo="Selecione um produto" obrigatorio>
            <LabProdutos
              estilo={estiloSel}
              produto={produto}
              onEscolher={setProduto}
              onTrocarEstilo={(chave) => setEstilo(chave)}
            />
          </Bloco>

          <Bloco
            n={3}
            titulo="Como o produto e o avatar devem aparecer na imagem?"
            obrigatorio
          >
            <LabCena
              estilo={estiloSel}
              produtoTitulo={produto?.titulo}
              valor={cena}
              onMudar={setCena}
              sugestaoBase={ehPov ? variacaoSel.sugestao : undefined}
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

      {etapa ==="cena" && estiloSel && sub === "avatar" && (
        <Tela chave="avatar">
          <Bloco n={4} titulo="Escolha o influenciador" obrigatorio>
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

      {etapa ==="cena" && sub === "cenario" && (
        <Tela chave="cenario">
          <Bloco n={5} titulo="Cenário" obrigatorio>
            <LabCenario escolhido={cenario} onEscolher={setCenario} />
          </Bloco>

          <Navegacao
            onVoltar={() => irSub("avatar")}
            podeAvancar={cenarioOk}
            rotulo="Revisar"
            onAvancar={() => irSub("resumo")}
          />
        </Tela>
      )}

      {etapa ==="cena" && estiloSel && produto && avatar && cenario && sub === "resumo" && (
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
              className="mt-2.5 flex w-full items-center gap-3 rounded-xl border border-primary/40 bg-background/60 px-4 py-3 text-left transition-all hover:border-primary hover:bg-primary/5"
            >
              <SkipForward className="size-4.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  Já tenho a imagem da minha influenciadora com o produto
                </span>
                <span className="block text-xs text-muted-foreground">
                  Usa a sua foto e vai direto pro vídeo, sem gastar crédito na imagem.
                </span>
              </span>
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
      {etapa ==="imagem" && estiloSel && produto && avatar && cenario && (
        <Tela chave="imagem">
          <Bloco n={6} titulo="Sua imagem">
            <LabImagem
              estilo={estiloSel}
              produto={produto}
              avatar={avatar}
              cena={cena}
              cenario={cenario}
              cenarioTexto={cenarioTexto}
              imagem={imagem}
              onGerou={definirImagem}
              minhasImagens={meusAvatares}
              comecarPulando={imagemPropria}
              variacao={ehPov ? variacao : undefined}
              jaPediu={!!imagemPedidaEm}
              pedidoEm={imagemPedidaEm}
              onComecou={() => setImagemPedidaEm(Date.now())}
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

      {etapa ==="video" && imagem && subVideo === "config" && (
        <Tela chave="video-config">
          <Bloco n={7} titulo="Como vai ser o vídeo" obrigatorio>
            <LabVideo config={video} onMudar={setVideo} produtoNome={produto?.titulo} />
          </Bloco>

          <Navegacao
            onVoltar={() => irPara("imagem")}
            podeAvancar={falaCabe}
            rotulo="Próximo"
            onAvancar={() => {
              setSubVideo("movimento");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </Tela>
      )}

      {etapa ==="video" && imagem && subVideo === "movimento" && (
        <Tela chave="video-movimento">
          <Bloco n={8} titulo="Movimento do vídeo">
            <LabMovimentos
              estilo={estilo}
              cena={cenaImagem}
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

      {etapa ==="video" && imagem && subVideo === "resumo" && (
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
                  A imagem ganha movimento e fala. Costuma levar de 3 a 5 minutos e
                  custa {custoVideo} créditos, cobrados só quando o vídeo fica pronto.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => irSubVideo("gerando")}
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
            onAvancar={() => irSubVideo("gerando")}
          />
        </Tela>
      )}

      {etapa ==="video" && imagem && subVideo === "gerando" && (
        <Tela chave="video-gerando">
          <Bloco n={9} titulo="Seu vídeo">
            <LabGerando
              config={video}
              imagem={imagem}
              produtoNome={produto?.titulo}
              pov={ehPov}
              semMaos={ehPov && !variacaoSel.temMaos}
              onVoltar={() => irSubVideo("resumo")}
              onRefazer={recomecar}
              jobEmAndamento={jobVideo}
              onJobCriado={setJobVideo}
            />
          </Bloco>
        </Tela>
      )}
    </div>
  );
}
