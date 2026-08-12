"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Plus,
  Film,
  Trash2,
  Scissors,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Lock,
  Volume2,
  VolumeX,
  Music,
  Type,
  Captions,
  Layers,
  Package,
  Info,
  Clock,
  Star,
  Mic,
  Wand2,
  Gauge,
  Compass,
  Image as ImageIcon,
  ClipboardList,
  ListChecks,
  PenLine,
  ZoomIn,
  ZoomOut,
  Video as VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Segmented, type SegOption } from "@/components/app/segmented";
import { MediaPicker } from "@/components/app/media-picker";
import { cn } from "@/lib/utils";
import {
  estimarCreditos,
  custoAnaliseCenas,
  custoPosicionarCenas,
  CREDITOS_FIXO,
} from "@/lib/precos";
import { extrairAudioDaBase } from "@/lib/audio-navegador";
import { criarRascunhoDeUpload, enviarArquivoEmPedacos } from "@/lib/upload-chunked";
import {
  APOIO_MIN,
  DURA_MANUAL_MIN,
  EDICAO_PADRAO,
  IMAGEM_MAX_SEG,
  IMAGEM_MIN_SEG,
  MARCAS_ANALISE,
  MAX_VIDEO_SEG,
  MAX_APOIO_SEG,
  MAX_ARQUIVO_MB,
  MAX_VOLUME_BOOST,
  NARRACAO_CENA_MIN,
  NARRACAO_IA_SEG,
  SEG_POR_APOIO,
  SILENCIOS,
  VOLUMES_PADRAO,
  VOL_APOIO,
  VOL_APOIO_FALANDO,
  VELOCIDADES_MUSICA,
  VELOCIDADE_PADRAO,
  duracaoApoio,
  maxApoios,
  planejarApoios,
  segundosDaNarracao,
  tamanhoEmMB,
  type EdicaoAvancada,
} from "@/lib/montagem";
import { VOZES, VOZ_PADRAO, type VozOpcao } from "@/lib/vozes";
import { SeletorVoz } from "@/components/app/seletor-voz";

/**
 * EDITOR AUTOMÁTICO, em funil guiado de 5 etapas (05/08/2026).
 *
 * Antes era um formulão só: clipes, textos, áudio e produto empilhados numa
 * coluna, e a pessoa tinha que descobrir sozinha em que ordem mexer em cada
 * coisa. Agora a tela pergunta UMA coisa de cada vez, na ordem em que a decisão
 * importa, e a prévia fica parada do lado direito o tempo todo (no desktop),
 * atualizando conforme as mídias entram.
 *
 * As etapas: 1) de onde parte o vídeo, 2) é um produto?, 3) mídias, 4) ajustes
 * e áudio, 5) aprovação.
 *
 * DESCREVER AS CENAS mora na etapa 3, junto das mídias (06/08/2026). O campo de
 * descrição de cada clipe sempre esteve na lista de mídias, mas o botão que
 * preenche esses campos com IA ficava só na etapa 5: quem descrevia na mão só
 * descobria a IA no fim, e quem usava a IA via o mesmo campo em dois lugares. A
 * etapa 5 ficou com o que ela promete - a régua de como o vídeo vai ficar, o
 * custo e o aviso (não trava) de cena que ficou sem descrição.
 *
 * O que NÃO mudou de propósito: o payload que sai daqui é o mesmo `roteiro` +
 * `textos` + `volumes` de antes (ver `src/lib/montagem.ts`), então o worker e a
 * fábrica continuam recebendo o que sempre receberam. A `descricao` e o `trecho`
 * de cada cena já eram campos previstos.
 */

/**
 * Os 4 formatos que existem no backend. A tela nunca mostra os 4 juntos
 * (06/08/2026): no modo "Vídeo com fala" só transcrever/nenhum
 * (`FORMATOS_MODO_BASE`), e na narração o formato é sempre "voz". "legenda"
 * sobrevive no tipo por causa de job antigo reaproveitado ("Reutilizar").
 */
type Formato = "legenda" | "voz" | "transcrever" | "nenhum";

// o que cada formato faz (aparece embaixo do seletor)
const FORMATO_NOTA: Record<string, string> = {
  legenda: "A IA escreve a copy e queima a legenda no vídeo.",
  voz: "A IA escreve a copy e narra com voz de IA.",
  transcrever:
    "A gente transcreve o áudio do seu vídeo e coloca a legenda no tempo certo da fala. O som original fica ligado.",
  nenhum: "Sem legenda e sem voz de IA: sai só a sua montagem, com o áudio e a música que você escolher.",
};
/**
 * Sem produto, os nomes técnicos não ajudam ninguém: "Transcrever fala" e
 * "Nenhum" viram a pergunta que a pessoa de fato responde (06/08/2026). O VALOR
 * é o mesmo de sempre, só o rótulo muda: quem lê isso é gente, e quem recebe é a
 * mesma API.
 *
 * A pergunta é sobre LEGENDA, não sobre ter fala (correção do dono, 06/08/2026):
 * este seletor só aparece depois de a pessoa ter escolhido "Vídeo com fala" na
 * etapa 1, então "Meu vídeo tem fala / Não tem fala" era perguntar de novo o que
 * ela acabou de responder. O que ainda não foi decidido é se essa fala vira
 * legenda na tela.
 */
const FORMATOS_SEM_PRODUTO = [
  { value: "transcrever", label: "Sim, legendar a fala" },
  { value: "nenhum", label: "Não, sem legenda" },
] as const;

/**
 * No modo "Vídeo com fala" a narração já está gravada no próprio vídeo
 * (06/08/2026), com produto ou sem: "Voz narrada" colocaria uma segunda voz por
 * cima da fala da pessoa, e "Legenda" queimaria uma copy inventada em cima do
 * que ela está dizendo. As únicas decisões reais são transcrever a fala ou nada.
 */
const FORMATOS_MODO_BASE = [
  { value: "transcrever", label: "Transcrever fala" },
  { value: "nenhum", label: "Nenhum" },
] as const;

// onde a pessoa vai vender: muda o CTA/hashtags da copy (Shopee = sacolinha laranja)
const PLATAFORMAS = [
  { value: "shopee", label: "Shopee" },
  { value: "outro", label: "Outro" },
] as const;
const TONS = [
  { value: "agressivo", label: "Agressivo" },
  { value: "equilibrado", label: "Equilibrado" },
  { value: "tranquilo", label: "Tranquilo" },
] as const;
const POSICOES = [
  { value: "cima", label: "Em cima" },
  { value: "meio", label: "No meio" },
  { value: "baixo", label: "Embaixo" },
] as const;

/**
 * Como a legenda da FALA aparece na tela.
 * - "palavra": uma palavra por vez, no ritmo exato de quem fala (jeito Reels/TikTok).
 * - "completo": a frase inteira, quebrada em no máximo duas linhas (jeito clássico).
 *
 * Vale só onde a legenda sai da fala (transcrição ou narração da IA): a legenda de
 * copy escrita pela IA já vem em frases curtas prontas.
 */
const ESTILOS_LEGENDA = [
  { value: "palavra", label: "Palavra por palavra" },
  { value: "completo", label: "Legenda completa" },
] as const;

const ESTILO_LEGENDA_NOTA: Record<string, string> = {
  palavra:
    "Aparece uma palavra de cada vez, no ritmo da fala. Prende mais a atenção e é o jeito da maioria dos Reels e TikToks. A frase de abertura aparece inteira, em destaque, e o palavra por palavra começa depois dela.",
  completo:
    "Aparece a frase inteira, em no máximo duas linhas por vez. Mais fácil de ler de uma vez só, jeito clássico de legenda.",
};

type Tom = (typeof TONS)[number]["value"];
type Plataforma = (typeof PLATAFORMAS)[number]["value"];
type Posicao = (typeof POSICOES)[number]["value"];
type LegendaEstilo = (typeof ESTILOS_LEGENDA)[number]["value"];

/**
 * As posições do texto na tela, já reagindo a ONDE A LEGENDA ESTÁ.
 *
 * A faixa ocupada pela legenda não sai da lista: ela só muda de nome, porque o
 * render encaixa o texto ao lado da legenda em vez de por cima (`_estilo_manual`
 * em `bot shopee/fabrica.py` desvia 170px quando os dois pedem a mesma faixa).
 * Sumir com a opção seria pior: "embaixo" é justamente a posição que quase todo
 * mundo quer, e tirá-la deixaria a pessoa sem o lugar que ela veio buscar.
 *
 * `legendaPos` nulo = vídeo sem legenda nenhuma (formato "Nenhum"): aí não há de
 * que desviar e os três nomes voltam ao normal.
 */
function posicoesTexto(legendaPos: Posicao | null): readonly SegOption<Posicao>[] {
  if (!legendaPos) return POSICOES;
  return POSICOES.map((o) =>
    o.value === legendaPos
      ? {
          ...o,
          // legenda em cima: o texto desce pra debaixo dela. Nos outros dois
          // casos ele sobe, então o nome é o mesmo.
          label: legendaPos === "cima" ? "Abaixo da legenda" : "Acima da legenda",
        }
      : o,
  );
}

/**
 * De onde o vídeo parte (etapa 1).
 * - "base": existe um (ou vários) vídeo com ALGUÉM FALANDO. Ele roda por baixo do
 *   começo ao fim, com o som dele, e as outras mídias entram por cima.
 * - "narracao": não há ninguém falando em vídeo. As mídias tocam em sequência e
 *   quem narra é a voz de IA, com o roteiro escrito pela pessoa ou pela própria IA.
 *
 * Os textos daqui não dizem "você aparece falando" de propósito (06/08/2026): o
 * vídeo costuma ser de outra pessoa (um cliente, um influenciador contratado, um
 * corte de terceiro), e a tela tratando quem sobe como quem aparece deixava metade
 * dos casos sem lugar.
 */
type Modo = "base" | "narracao";

type Clip = {
  id: string;
  file: File;
  url: string;
  kind: "video" | "image";
  dur: number;
  inSec: number;
  outSec: number;
  /**
   * "principal" = o vídeo que roda por baixo do começo ao fim, com o SOM DELE
   * (é a pessoa falando). Pode haver vários, e só vídeo pode ser.
   * "apoio" = entra por cima, em tela cheia, e volta pro principal.
   */
  papel: "principal" | "apoio";
  /**
   * Apoio: em que segundo do principal ele entra. `null` = a IA escolhe olhando
   * a fala do principal (a tela mostra a distribuição de reserva enquanto isso).
   */
  entra: number | null;
  /** o que aparece nesse clipe, escrito pela pessoa (ex.: "close no tecido") */
  descricao: string;
  /** true = quem escreveu a descrição foi a IA (botão da etapa 3) */
  descricaoIA?: boolean;
  /**
   * De que segundo DO ARQUIVO sai o pedaço que vai pra tela. É o que impede um
   * apoio de 30s de entrar sempre pelo começo: a IA aponta onde está a ação.
   * `null` = do começo do corte.
   */
  trecho: number | null;
  /**
   * Apoio: quanto tempo a cena fica NA TELA, escolhido pela pessoa nas alças de
   * tamanho do painel da etapa 5. `null` = vale a regra automática (foto 1-3s,
   * vídeo 2-4s). Quando existe, MANDA no render (dono, 11/08/2026).
   */
  dura: number | null;
};

type Texto = {
  id: string;
  conteudo: string;
  pos: Posicao;
  inSec: number; // na linha do tempo GERAL do vídeo
  outSec: number;
};

/**
 * O roteiro que viaja pro servidor: ordem, cortes, quem é o principal, quando
 * cada apoio entra e de que pedaço do arquivo ele sai.
 *
 * Virou função própria porque agora é montado DUAS vezes (11/08/2026): uma na
 * criação do job e outra no `/pronto`, quando a IA termina de encaixar as cenas
 * em segundo plano. Montar em dois lugares seria garantir que um dia ficariam
 * diferentes.
 */
function roteiroDe(lista: Clip[]) {
  return lista.map((c, ordem) => ({
    nome: c.file.name,
    tipo: c.kind,
    ordem,
    in: Number(c.inSec.toFixed(2)),
    out: Number(c.outSec.toFixed(2)),
    papel: c.papel,
    ...(c.papel === "apoio"
      ? { entra: c.entra === null ? null : Number(c.entra.toFixed(2)) }
      : {}),
    ...(c.papel === "apoio" && c.dura !== null
      ? { dura: Number(c.dura.toFixed(2)) }
      : {}),
    ...(c.papel === "apoio" && c.kind === "video" && c.trecho !== null
      ? { trecho: Number(c.trecho.toFixed(2)) }
      : {}),
    ...(c.descricao.trim() ? { descricao: c.descricao.trim() } : {}),
  }));
}

let _seq = 0;
function novoId() {
  _seq += 1;
  return `i${_seq}_${_seq * 7}`;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const DUR_IMAGEM = 3;

/**
 * Teto do roteiro escrito pela pessoa (narração "Eu escrevo"). 420 caracteres
 * dão uns 33 segundos de fala: narração maior que isso vira palestra e mata o
 * ritmo do vídeo curto (tarefa 31: era 450). O mesmo teto vale no servidor
 * (`/api/jobs`).
 */
const MAX_ROTEIRO_FALA = 420;

/** Largura do quadro que a IA olha ao descrever a cena (o mesmo do render). */
const LARGURA_QUADRO = 512;

/* ------------- rascunho: não perder a montagem ao fechar a aba ------------- */

const CHAVE_RASCUNHO = "editor_estudio_rascunho";
/**
 * 5 minutos, e curto de propósito (o do Viral Boost dura 24h): este rascunho
 * existe pra socorrer o F5 sem querer e a aba fechada por engano, não pra guardar
 * montagem do dia anterior. Passado esse tempo a pessoa quase certamente mudou de
 * ideia, e oferecer de volta seria ressuscitar trabalho que ela já abandonou.
 */
const VALIDADE_RASCUNHO_MS = 5 * 60 * 1000;

/**
 * A ficha de uma cena dentro do rascunho.
 *
 * As MÍDIAS em si não cabem aqui: `File` não vira texto e um vídeo de 300 MB
 * estouraria a cota do localStorage já na primeira gravação. O que se guarda é o
 * trabalho CARO feito em cima de cada arquivo: o corte, o momento em que a cena
 * entra, o pedaço escolhido e a descrição (que custa 1 crédito quando é a IA que
 * escreve). Quando a pessoa seleciona os arquivos de novo, cada ficha reencontra
 * o seu pelo nome + tamanho e tudo volta pro lugar, sem pagar de novo.
 */
type FichaCena = {
  nome: string;
  tam: number;
  inSec: number;
  outSec: number;
  entra: number | null;
  trecho: number | null;
  /** rascunho gravado antes do painel de tamanho não tem o campo: ler com `?? null` */
  dura: number | null;
  descricao: string;
  descricaoIA?: boolean;
};

type Rascunho = {
  v: 1;
  em: number;
  passo: number;
  maxVisto: number;
  modo: Modo | null;
  falaPor: "ia" | "eu";
  roteiroFala: string;
  ehProduto: boolean;
  nome: string;
  descricao: string;
  preco: string;
  formato: Formato;
  tom: Tom;
  plataforma: Plataforma;
  voz: string;
  legendaPos: Posicao;
  /** opcional: rascunho gravado antes desta opção existir não tem o campo */
  legendaEstilo?: LegendaEstilo;
  textos: Texto[];
  musicaAuto: boolean;
  musicaEscolhida: string;
  volumeMusica: number;
  velocidadeMusica: number;
  cortarSilencio: number;
  audioVideo: "manter" | "remover";
  volumeOriginal: number;
  volumeVoz: number;
  edicao: EdicaoAvancada;
  cenas: FichaCena[];
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
  window.dispatchEvent(new Event("editor-rascunho"));
}

/** Avisa o React quando o rascunho muda (esta aba ou outra). */
function assinarRascunho(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("editor-rascunho", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("editor-rascunho", callback);
  };
}

/**
 * O ponto em que o grid vira duas colunas: o `lg` do Tailwind.
 *
 * A largura precisa ser lida em JAVASCRIPT, não com `hidden lg:block` (dono,
 * 12/08/2026): esconder por CSS deixa os DOIS palcos montados, e são dois
 * `<video>` disputando a mesma `videoRef` (e dois vídeos decodificando à toa).
 */
const TELA_GRANDE = "(min-width: 1024px)";

/** Avisa o React quando a tela cruza esse ponto (girar o celular, redimensionar). */
function assinarLargura(callback: () => void) {
  const mq = window.matchMedia(TELA_GRANDE);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

const PASSOS = [
  { n: 1, titulo: "Ponto de partida", Icone: Compass },
  { n: 2, titulo: "Produto", Icone: Package },
  { n: 3, titulo: "Mídias", Icone: Layers },
  { n: 4, titulo: "Ajustes e áudio", Icone: Volume2 },
  { n: 5, titulo: "Aprovar cenas", Icone: ListChecks },
] as const;

const ULTIMO_PASSO = PASSOS.length;

export function EditorEstudio({
  bloqueado = false,
  videoInicial,
  configInicial,
}: {
  bloqueado?: boolean;
  /**
   * Vídeo já pronto que veio do "Editar esse vídeo" - carregado como base.
   * `shopee` = veio de um vídeo de produto da Shopee: em vez do modo genérico,
   * o editor abre com o fluxo de PRODUTO pré-selecionado (ver o efeito de carga).
   */
  videoInicial?: { url: string; nome: string; shopee?: boolean };
  /**
   * Ajustes de um vídeo anterior ("Tentar Novamente" / "Editar novamente") -
   * pré-preenche o formulário. Com `midiasServidor` (entrada retida por 24h,
   * tarefa 21), as mídias originais também voltam sozinhas, baixadas do
   * servidor, e na geração são reaproveitadas sem upload nenhum.
   */
  configInicial?: {
    jobId?: string;
    nome: string;
    descricao: string;
    preco: string;
    formato: "legenda" | "voz" | "transcrever" | "nenhum";
    tom: string;
    legendaPos: string;
    voz?: string;
    ehProduto?: boolean;
    audioVideo?: "manter" | "remover";
    comMusica?: boolean;
    musicaNome?: string;
    legendaEstilo?: LegendaEstilo;
    volumes?: { original?: number; musica?: number; voz?: number };
    velocidadeMusica?: number;
    cortarSilencio?: number;
    roteiroFala?: string;
    edicao?: Partial<EdicaoAvancada>;
    textos?: { texto?: string; pos?: string; in?: number; out?: number }[];
    cenas?: {
      nome: string;
      tipo?: string;
      papel?: string;
      in?: number;
      out?: number;
      entra?: number | null;
      trecho?: number | null;
      dura?: number | null;
      descricao?: string;
    }[];
    midiasServidor?: { nome: string; tamanho: number }[];
  };
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imgTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- funil ----
  const [passo, setPassoBruto] = useState(1);
  /**
   * Etapa mais adiantada que a pessoa já alcançou. É o TETO do pulo pra frente na
   * trilha: clicar numa etapa devolve pra uma tela que ela já viu, nunca adianta
   * o funil por cima da validação. Sem esse teto, um formulário recém-aberto
   * deixaria pular direto pro fim sempre que as primeiras etapas nascem válidas.
   */
  const [maxVisto, setMaxVisto] = useState(1);
  /** trocar de etapa é SEMPRE por aqui, senão o `maxVisto` fica pra trás */
  const setPasso = useCallback((n: number) => {
    setPassoBruto(n);
    setMaxVisto((m) => (n > m ? n : m));
  }, []);
  const [modo, setModo] = useState<Modo | null>(null);
  /** na narração: quem escreve o texto da fala */
  const [falaPor, setFalaPor] = useState<"ia" | "eu">("ia");
  const [roteiroFala, setRoteiroFala] = useState("");

  const [clips, setClips] = useState<Clip[]>([]);
  const [sel, setSel] = useState(0);
  /** qual dos clipes principais está tocando na prévia (a base é a sequência deles) */
  const [idxBase, setIdxBase] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0); // tempo dentro do clipe atual
  /**
   * No CELULAR a prévia nasce FECHADA e abre num botão (dono, 12/08/2026).
   *
   * Ela é 9:16, e no celular a coluna da direita desce pro fim da tela: o vídeo
   * virava um paredão embaixo do formulário, com o Voltar/Continuar plantado em
   * cima dele. Quem abrir segue com ela aberta nas etapas seguintes, de
   * propósito: abrir foi um pedido explícito, e fechar de novo é o mesmo toque.
   *
   * No computador este estado não é usado: lá o palco é a coluna da direita,
   * que fica parada do lado e não empurra nada.
   */
  const [previaAberta, setPreviaAberta] = useState(false);
  /**
   * A resposta do servidor é "grande" de propósito: é o que o computador vê, e
   * ele é o único que enxerga o palco já na primeira pintura. No celular a
   * coluna nasce visível e some na hidratação, mas ela fica lá embaixo, fora da
   * dobra, então o pulo não chega a aparecer.
   */
  const telaGrande = useSyncExternalStore(
    assinarLargura,
    () => window.matchMedia(TELA_GRANDE).matches,
    () => true,
  );

  const [textos, setTextos] = useState<Texto[]>([]);
  /**
   * Em que faixa da tela a legenda queimada aparece. Até 06/08/2026 isso não
   * existia na tela: o envio copiava a posição do PRIMEIRO texto escrito à mão
   * (e caía em "baixo" quando não havia texto nenhum), então quem só queria
   * mexer na legenda não tinha como, e quem mexia num texto movia a legenda sem
   * querer. Agora é uma escolha própria, e o render já sabia recebê-la
   * (`legenda_pos` no config, desde sempre).
   */
  const [legendaPos, setLegendaPos] = useState<Posicao>("baixo");
  /**
   * Como a legenda da fala aparece: palavra por palavra ou a frase inteira em
   * duas linhas. Começa em "palavra" porque é o formato que a plataforma toda
   * usa hoje (Reels/TikTok) e o que mais segura quem está assistindo.
   */
  const [legendaEstilo, setLegendaEstilo] = useState<LegendaEstilo>("palavra");

  // produto / IA (opcional)
  const [ehProduto, setEhProduto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [formato, setFormato] = useState<Formato>("legenda");
  // padrão EQUILIBRADO (dono, 12/08/2026; era agressivo): é o tom que serve pra
  // qualquer produto sem precisar de escolha, e quem quiser urgência troca na
  // mão. O agressivo grita, e grito nasce mal em nicho que pede sofisticação.
  const [tom, setTom] = useState<Tom>("equilibrado");
  const [plataforma, setPlataforma] = useState<Plataforma>("shopee");
  const [voz, setVoz] = useState<string>(VOZ_PADRAO);
  const [vozes, setVozes] = useState<VozOpcao[]>(VOZES);

  // áudio. Não existe mais o par "com música / sem música" (06/08/2026): a
  // música É o arquivo que a pessoa subir, e sem arquivo o vídeo sai sem música.
  // Um botão pra dizer "sim, quero música" e outro campo pra dizer qual eram duas
  // perguntas pra uma decisão só.
  const [musica, setMusica] = useState<File[]>([]);
  /**
   * Deixar a plataforma sortear uma trilha da biblioteca dela quando a pessoa não
   * sobe música nenhuma. Vem DESLIGADO: música é gosto, e entregar uma escolhida
   * pela casa sem ninguém pedir é o tipo de surpresa que faz refazer o vídeo.
   */
  const [musicaAuto, setMusicaAuto] = useState(false);
  /** biblioteca da plataforma pro seletor. `null` = ainda não buscada. */
  const [musicasPlataforma, setMusicasPlataforma] = useState<
    { arquivo: string; nome: string }[] | null
  >(null);
  /** trilha escolhida da biblioteca ("" = a IA sorteia uma) */
  const [musicaEscolhida, setMusicaEscolhida] = useState("");
  /** a prévia de música está tocando sozinha (botão de play do seletor)? */
  const [previaMusica, setPreviaMusica] = useState(false);
  /** tem trilha no vídeo? o arquivo da pessoa manda; sem ele, vale a automática */
  const comMusica = musica.length > 0 || musicaAuto;
  const [musicaUrl, setMusicaUrl] = useState("");
  const [volumeMusica, setVolumeMusica] = useState(VOLUMES_PADRAO.musica);
  const [velocidadeMusica, setVelocidadeMusica] = useState<number>(VELOCIDADE_PADRAO);
  /** cortar trechos sem fala maiores que X segundos (0 = não cortar).
   *  Começa em 0,5s: quase toda gravação caseira tem pausa demais, e o corte
   *  curto é o que mais melhora o vídeo sem a pessoa precisar saber que existe. */
  const [cortarSilencio, setCortarSilencio] = useState(0.5);
  const [audioVideo, setAudioVideo] = useState<"manter" | "remover">("manter");
  // mixagem: dá pra ouvir o resultado de cada controle na hora, antes de gerar
  const [volumeOriginal, setVolumeOriginal] = useState(100);
  const [volumeVoz, setVolumeVoz] = useState(100);

  // edição avançada (Ken Burns, transições, som do apoio, melhor trecho)
  const [edicao, setEdicao] = useState<EdicaoAvancada>(EDICAO_PADRAO);

  // análise das cenas (etapa 3) e envio (etapa 5)
  const [analisando, setAnalisando] = useState(false);
  /** id da cena sendo descrita sozinha (botão de varinha da lista) */
  const [analisandoCena, setAnalisandoCena] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /**
   * Posicionamento por IA (etapa 5): ela ouve a fala do vídeo principal e diz em
   * que segundo cada cena de apoio entra, ANTES de renderizar.
   */
  const [posicionando, setPosicionando] = useState(false);
  /**
   * Retrato da montagem no momento em que a IA posicionou (ver `assinaturaMontagem`).
   * Guardar a ASSINATURA, e não um simples "já posicionou", é o que faz o
   * posicionamento CADUCAR sozinho: quem volta e troca, corta ou remove uma cena
   * invalida os segundos escolhidos pra outra montagem, e a tela pede de novo.
   */
  const [posicionadoEm, setPosicionadoEm] = useState<string | null>(null);
  /** cena de apoio selecionada na TIMELINE da aprovação (abre o painel dela) */
  const [cenaSel, setCenaSel] = useState<string | null>(null);
  /** cena que acabou de ser apontada pela régua do tempo (destaque passageiro) */
  const [destacado, setDestacado] = useState<string | null>(null);
  const refsCena = useRef<Record<string, HTMLLIElement | null>>({});

  // ===== RASCUNHO: não perder a montagem se fechar ou recarregar a aba =====
  const [rascunhoDispensado, setRascunhoDispensado] = useState(false);
  /**
   * Fichas do rascunho esperando o arquivo voltar (ver `FichaCena`). Fica numa
   * REF, não em estado, porque o `addFiles` é dependência de efeito e precisa
   * continuar estável: virando estado, o carregamento do "Editar esse vídeo"
   * rodaria de novo a cada mídia adicionada.
   */
  const fichasPendentes = useRef<FichaCena[]>([]);
  const rascunhoCru = useSyncExternalStore(
    assinarRascunho,
    () => localStorage.getItem(CHAVE_RASCUNHO),
    () => null,
  );
  const rascunho = lerRascunho(rascunhoCru);

  const atual = clips[sel];
  const mudo = audioVideo === "remover";
  // voz de IA + som original ligado embola o áudio. Vale COM ou SEM produto: a
  // narração sem produto (fala escrita pela pessoa) sofre do mesmo jeito.
  const conflitoAudio = formato === "voz" && audioVideo === "manter";
  // formatos que usam a copy da IA (tom/plataforma/descrição só importam nesses)
  const usaCopy = ehProduto && (formato === "legenda" || formato === "voz");

  // ---- principais (a base do vídeo, em sequência) e apoios (entram por cima) ----
  const principais = useMemo(() => clips.filter((c) => c.papel === "principal"), [clips]);
  const modoPrincipal = principais.length > 0;
  const durBase = principais.reduce((s, c) => s + (c.outSec - c.inSec), 0);
  const apoios = useMemo(
    () => (modoPrincipal ? clips.filter((c) => c.papel !== "principal") : []),
    [clips, modoPrincipal],
  );
  /** Em que segundo da base esse principal começa. */
  const inicioDoBase = (i: number) =>
    principais.slice(0, i).reduce((s, c) => s + (c.outSec - c.inSec), 0);
  /**
   * Quem entra na linha da base, em que segundo e por quanto tempo, pra uma
   * lista QUALQUER de clipes. A MESMA conta do render (lib/montagem), pra prévia
   * e vídeo não divergirem.
   *
   * Recebe a lista em vez de ler o estado porque o "Aprovar e gerar" posiciona
   * as cenas na hora do envio, em cima de uma montagem que ainda não passou pelo
   * React (as descrições podem ter acabado de chegar da IA).
   */
  const marcasDe = useCallback((lista: Clip[]) => {
    const base = lista.filter((c) => c.papel === "principal");
    if (!base.length) return [];
    const dur = base.reduce((s, c) => s + (c.outSec - c.inSec), 0);
    const ap = lista.filter((c) => c.papel !== "principal");
    return planejarApoios(
      ap.map((c) => ({ tipo: c.kind, in: c.inSec, out: c.outSec, entra: c.entra, dura: c.dura })),
      dur,
    ).map((m) => ({ ...m, id: ap[m.i].id }));
  }, []);
  const marcasApoio = useMemo(() => marcasDe(clips), [marcasDe, clips]);
  const cabemApoios = modoPrincipal ? maxApoios(durBase) : 0;
  // apoio com mais de 1 minuto precisa ser cortado antes de gerar. Só conta os
  // que realmente entram: os que passaram do limite de cenas já ficam de fora.
  const apoioLongo = apoios
    .slice(0, cabemApoios)
    .some((c) => c.outSec - c.inSec > MAX_APOIO_SEG);

  // duração total (com principal o vídeo dura o que ele dura: os apoios
  // SUBSTITUEM trechos em vez de somar tempo) e tempo na linha geral
  const somaClipes = clips.reduce((s, c) => s + (c.outSec - c.inSec), 0);
  const totalDur = modoPrincipal ? durBase : somaClipes;
  const passouDoTeto = totalDur > MAX_VIDEO_SEG;
  const elapsedAntes = clips
    .slice(0, sel)
    .reduce((s, c) => s + (c.outSec - c.inSec), 0);
  // o palco mostra a composição enquanto toca; parado mostra o clipe selecionado,
  // pra continuar dando pra cortar cada um deles
  const palco = modoPrincipal && tocando ? principais[idxBase] : atual;
  // tempo na linha do vídeo: dentro da base é o começo daquele principal mais o
  // quanto já rodou dele
  const idxPalcoBase = palco ? principais.findIndex((c) => c.id === palco.id) : -1;
  const tGlobal = modoPrincipal
    ? idxPalcoBase >= 0
      ? inicioDoBase(idxPalcoBase) +
        Math.max(0, tempo - principais[idxPalcoBase].inSec)
      : 0
    : elapsedAntes + Math.max(0, tempo - (atual?.inSec ?? 0));
  const textosAtivos = textos.filter(
    (t) => t.conteudo.trim() && tGlobal >= t.inSec && tGlobal <= t.outSec,
  );
  /**
   * Sai legenda queimada neste vídeo? Só o formato "Nenhum" não tem: "Legenda"
   * queima a copy da IA, e "Voz" e "Transcrever" queimam as frases no tempo da
   * fala. O render trata os três com o mesmo estilo, então pra a tela é um
   * booleano só. É ele que decide se a escolha de posição aparece e se o texto
   * da pessoa precisa desviar da legenda.
   */
  const temLegenda = formato !== "nenhum";
  /** as posições do texto na tela, já com o nome mudado onde a legenda está */
  const posicoesDoTexto = posicoesTexto(temLegenda ? legendaPos : null);
  /**
   * A legenda deste vídeo vem da FALA (transcrição do vídeo ou narração da IA)?
   * Só nesses dois casos existe tempo de cada palavra, que é o que faz o estilo
   * "palavra por palavra" ser possível. No formato "legenda" a IA já entrega as
   * frases prontas e não há o que sincronizar.
   */
  const legendaDaFala = formato === "transcrever" || formato === "voz";

  // ---- cenas que valem mandar pra IA olhar (botão da etapa 3) ----
  // Cena descrita pela pessoa nunca entra: o que ela escreveu manda. E a análise
  // só serve onde a descrição é usada de verdade: pra encaixar o apoio na fala
  // (modo base) ou pra copy falar do que está na tela (quando há copy).
  const cenasAnalisaveis = useMemo(() => {
    if (!modo) return [];
    const lista = modo === "base" ? apoios.slice(0, cabemApoios) : clips;
    // na narração a descrição só alimenta a copy que a IA escreve. Sem copy, ou
    // com a fala escrita pela própria pessoa, a análise não mudaria NADA no
    // vídeo: oferecer o botão ali seria cobrar crédito por algo sem efeito.
    if (modo === "narracao" && (!usaCopy || falaPor === "eu")) return [];
    return lista.filter((c) => !c.descricao.trim());
  }, [modo, apoios, cabemApoios, clips, usaCopy, falaPor]);
  const custoAnalise = custoAnaliseCenas(cenasAnalisaveis.length);
  /**
   * As que a IA descreve SOZINHA no "Aprovar e gerar" (dono, 11/08/2026).
   *
   * Só no modo base: ali a descrição decide ONDE cada cena de apoio encaixa na
   * fala, e ficar sem ela é resultado pior. Na narração ela só tempera a copy, e
   * gerar sem descrever sempre foi uma escolha legítima - descontar crédito por
   * conta própria num caminho que a tela chama de opcional seria cobrar por algo
   * que a pessoa não pediu. Lá o botão de descrever continua sendo o caminho.
   */
  const cenasAutoDescritas = modo === "base" ? cenasAnalisaveis : [];
  /** o que custa mandar a IA posicionar as cenas que de fato entram no vídeo */
  const custoPosicionar = custoPosicionarCenas(marcasApoio.length);
  /** o que custa descrever sozinha o que a pessoa deixou em branco */
  const custoAutoDescrever = custoAnaliseCenas(cenasAutoDescritas.length);
  /**
   * O bolso do "Abrir editor PRO". Ele descreve o que ficou em branco
   * ANTES de posicionar (dono, 11/08/2026), então precisa anunciar as duas
   * coisas: mostrando só o posicionamento, o botão cobraria mais do que diz.
   */
  const custoVerAntes = custoPosicionar + custoAutoDescrever;

  /**
   * Retrato do que a IA precisa conhecer pra posicionar: a duração da base e o
   * corte de cada cena de apoio. O `entra` NÃO entra aqui de propósito, senão o
   * próprio posicionamento invalidaria a si mesmo (e o ajuste manual de um
   * segundo apagaria o trabalho todo).
   */
  const assinaturaMontagem = useMemo(
    () =>
      `${durBase.toFixed(2)}|` +
      apoios
        .slice(0, cabemApoios)
        .map((c) => `${c.id}:${c.inSec.toFixed(2)}-${c.outSec.toFixed(2)}`)
        .join(","),
    [durBase, apoios, cabemApoios],
  );
  /** esta montagem, do jeito que está agora, já passou pela IA? */
  const posicionadoIA = posicionadoEm !== null && posicionadoEm === assinaturaMontagem;
  /** faz sentido posicionar neste vídeo? (só com fala e com cena de apoio) */
  const podePosicionar = modo === "base" && marcasApoio.length > 0;
  /**
   * Esta montagem ainda não passou pela IA: os apoios estão sem o segundo real.
   *
   * Desde 11/08/2026 isso NÃO trava mais o "Aprovar e gerar" (dono): o clique
   * pede o posicionamento sozinho antes de mandar pra fila. O que ele decide é
   * (a) esconder a régua, que até aqui mostraria tempos de reserva que o render
   * trocaria sozinho, e (b) oferecer o botão pra quem quer conferir antes.
   */
  const precisaPosicionar = podePosicionar && !posicionadoIA;
  /**
   * O PAINEL DE EDITOR da aprovação está na tela? (dono, 11/08/2026, v2)
   *
   * Com ele, a prévia SOBE pra cima da timeline (a coluna da direita some,
   * como num editor de verdade) e a agulha anda junto com o play. Só existe no
   * modo com fala, depois de posicionar: antes disso não há linha do tempo.
   */
  const previewNaTimeline =
    passo === ULTIMO_PASSO &&
    modo === "base" &&
    modoPrincipal &&
    durBase > 0 &&
    !precisaPosicionar;
  /**
   * A cena de apoio que está COBRINDO a fala neste instante. Tocando, é o que
   * desenha a cena por cima do principal; no painel de editor vale também
   * PARADO, pra o clique numa cena mostrar na prévia o que ela cobre ali.
   */
  const marcaAtiva =
    modoPrincipal && (tocando || previewNaTimeline)
      ? marcasApoio.find((m) => tGlobal >= m.entra && tGlobal < m.entra + m.dur)
      : undefined;
  const apoioNaTela = marcaAtiva ? clips.find((c) => c.id === marcaAtiva.id) : undefined;
  const descritasPelaIA = clips.filter((c) => c.descricaoIA).length;
  /**
   * Quem ainda está sem descrição E precisa de uma. É o que pinta o campo de
   * âmbar na lista de mídias: sem isso, cena vazia e cena descrita ficam com a
   * mesma cara e a pessoa não sabe onde faltou. Na montagem em que a descrição
   * não é usada (narração sem produto) o conjunto fica vazio e nada pinta.
   */
  const idsPendentes = useMemo(
    () => new Set(cenasAnalisaveis.map((c) => c.id)),
    [cenasAnalisaveis],
  );
  /**
   * Cenas em que o botão de varinha (descrever SÓ aquela cena) aparece: as
   * mesmas regras da análise em lote, mas SEM filtrar quem já tem descrição -
   * o clique é um pedido explícito de reescrever. O principal fica de fora
   * (nele a IA nunca escreve: a pessoa é quem sabe o que aparece no vídeo dela).
   */
  const idsDescreviveis = useMemo(() => {
    if (!modo) return new Set<string>();
    if (modo === "base") return new Set(apoios.slice(0, cabemApoios).map((c) => c.id));
    // mesma regra da análise em lote: sem copy da IA a descrição não faz nada
    if (!usaCopy || falaPor === "eu") return new Set<string>();
    return new Set(clips.map((c) => c.id));
  }, [modo, apoios, cabemApoios, clips, usaCopy, falaPor]);
  /** análise rodando (em lote ou de uma cena): trava navegação e geração */
  const ocupadoAnalise = analisando || analisandoCena !== null || posicionando;

  function pararTimer() {
    if (imgTimer.current) {
      clearInterval(imgTimer.current);
      imgTimer.current = null;
    }
  }

  // URL do que toca como música na prévia: o arquivo da pessoa (object URL) ou,
  // sem ele, a trilha escolhida da biblioteca (streaming de /api/musicas/...).
  // É o que faz a prévia da trilha da plataforma respeitar o MESMO volume e a
  // MESMA velocidade da música própria: é o mesmo <audio> pros dois casos.
  useEffect(() => {
    if (!musica[0]) {
      setMusicaUrl(
        musicaAuto && musicaEscolhida
          ? `/api/musicas/${encodeURIComponent(musicaEscolhida)}`
          : "",
      );
      return;
    }
    const u = URL.createObjectURL(musica[0]);
    setMusicaUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [musica, musicaAuto, musicaEscolhida]);

  // Trocou a trilha da prévia (outra música, ou de volta pra "sorteada"): PARA
  // o som na hora. Sem isto o áudio antigo continuava tocando (remover o src
  // não descarrega o que já está no elemento) e, como a troca de src não
  // dispara "pause", o ícone do botão ficava preso no estado errado. O load()
  // descarrega o áudio antigo e deixa o elemento pronto pro src novo (ou vazio).
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.load();
  }, [musicaUrl]);

  // MIXAGEM AO VIVO: mexeu no controle, ouve na hora. É o mesmo volume que vai
  // pro render, então o que se ouve aqui é o que sai no vídeo.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volumeMusica / 100;
  }, [volumeMusica, musicaUrl]);

  // velocidade da música na prévia. `preservesPitch` mantém o TOM: sem isso a
  // música acelerada vira voz de desenho e a lenta fica arrastada e grave.
  // É o mesmo efeito do render (que usa time-stretch, não acelera o arquivo).
  useEffect(() => {
    const a = audioRef.current as
      | (HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean })
      | null;
    if (!a) return;
    a.preservesPitch = true;
    a.webkitPreservesPitch = true;
    a.playbackRate = velocidadeMusica;
  }, [velocidadeMusica, musicaUrl]);

  // O `volume` do elemento só vai até 1, então acima de 100% a prévia amplifica
  // pela Web Audio (mesma coisa que o render faz com o filtro de volume).
  const ganhoRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const ganho = volumeOriginal / 100;
    if (ganho <= 1) {
      v.volume = ganho;
      if (ganhoRef.current) ganhoRef.current.gain.gain.value = 1;
      return;
    }
    v.volume = 1;
    if (!ganhoRef.current) {
      try {
        // a ligação é feita UMA vez por elemento: refazer dá erro no navegador
        const ctx = new AudioContext();
        const gain = ctx.createGain();
        ctx.createMediaElementSource(v).connect(gain).connect(ctx.destination);
        ganhoRef.current = { ctx, gain };
      } catch {
        return; // navegador sem Web Audio: fica no volume cheio, sem amplificar
      }
    }
    ganhoRef.current.gain.gain.value = ganho;
    if (ganhoRef.current.ctx.state === "suspended") {
      ganhoRef.current.ctx.resume().catch(() => {});
    }
  }, [volumeOriginal, palco?.id]);

  useEffect(() => {
    return () => {
      clips.forEach((c) => URL.revokeObjectURL(c.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // vozes do seletor: do usuário (chave própria) ou a lista curada (fallback)
  useEffect(() => {
    let vivo = true;
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d: { vozes?: VozOpcao[] }) => {
        if (!vivo || !d.vozes?.length) return;
        setVozes(d.vozes);
        setVoz((v) => (d.vozes!.some((o) => o.id === v) ? v : d.vozes![0].id));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // ---- mídia ----
  const addFiles = useCallback(
    async (files: File[], comoPrincipal = false) => {
      if (!files.length) return;
      const novos: Clip[] = [];
      const recusados: string[] = [];
      const pesados: string[] = [];
      const semSom: string[] = [];
      for (const file of files) {
        // barra aqui o que o servidor recusaria depois: sem isso a pessoa espera o
        // upload inteiro pra receber um erro no fim
        if (file.size > MAX_ARQUIVO_MB * 1024 * 1024) {
          pesados.push(`${file.name} (${tamanhoEmMB(file.size)})`);
          continue;
        }
        const url = URL.createObjectURL(file);
        const ehVideo = file.type.startsWith("video");
        // foto nunca pode ser a base: não tem fala pra correr por baixo
        if (comoPrincipal && !ehVideo) {
          URL.revokeObjectURL(url);
          semSom.push(file.name);
          continue;
        }
        let dur = DUR_IMAGEM;
        if (ehVideo) {
          dur = await new Promise<number>((res) => {
            const v = document.createElement("video");
            v.preload = "metadata";
            v.onloadedmetadata = () => res(v.duration || 5);
            v.onerror = () => res(5);
            v.src = url;
          });
        }
        // o Editor não faz vídeo maior que 2 minutos, então nem aceita a mídia
        if (ehVideo && dur > MAX_VIDEO_SEG) {
          URL.revokeObjectURL(url);
          recusados.push(file.name);
          continue;
        }
        // o rascunho guardou a ficha desta cena? então o corte, o momento e a
        // descrição voltam junto com o arquivo (ver `FichaCena`). O PAPEL não
        // volta de propósito: quem manda nele é o campo que a pessoa usou pra
        // subir agora, senão um arquivo re-enviado como apoio voltaria a ser a
        // base e furaria a ordem da lista.
        const iFicha = fichasPendentes.current.findIndex(
          (f) => f.nome === file.name && f.tam === file.size,
        );
        const ficha = iFicha >= 0 ? fichasPendentes.current.splice(iFicha, 1)[0] : null;
        // o corte é preso na duração real: arquivo trocado por outro de mesmo
        // nome e tamanho é improvável, mas um corte maior que a mídia quebraria
        // a régua da montagem
        const inSec = ficha
          ? Math.min(Math.max(0, ficha.inSec), Math.max(0, dur - 0.1))
          : 0;
        const outSec = ficha ? Math.min(Math.max(inSec + 0.1, ficha.outSec), dur) : dur;
        novos.push({
          id: novoId(),
          file,
          url,
          kind: ehVideo ? "video" : "image",
          dur,
          inSec,
          outSec,
          papel: comoPrincipal ? "principal" : "apoio",
          entra: ficha?.entra ?? null,
          descricao: ficha?.descricao ?? "",
          ...(ficha?.descricaoIA ? { descricaoIA: true } : {}),
          trecho: ficha?.trecho ?? null,
          dura: ficha?.dura ?? null,
        });
      }
      if (recusados.length) {
        toast.error(
          recusados.length === 1
            ? `"${recusados[0]}" passa de ${MAX_VIDEO_SEG / 60} minutos. O editor faz vídeo de até ${MAX_VIDEO_SEG / 60} minutos.`
            : `${recusados.length} vídeos passam de ${MAX_VIDEO_SEG / 60} minutos e ficaram de fora.`,
        );
      }
      if (pesados.length) {
        toast.error(
          `Passa de ${MAX_ARQUIVO_MB} MB por arquivo: ${pesados.join(", ")}. Comprima ou corte antes de subir.`,
        );
      }
      if (semSom.length) {
        toast.error(
          "Foto não pode ser o vídeo principal (não tem fala pra correr por baixo). Suba ela nas cenas de apoio.",
        );
      }
      if (novos.length) {
        // os principais ficam JUNTOS no topo, na ordem em que vão tocar
        setClips((prev) =>
          comoPrincipal
            ? [
                ...prev.filter((c) => c.papel === "principal"),
                ...novos,
                ...prev.filter((c) => c.papel !== "principal"),
              ]
            : [...prev, ...novos],
        );
      }
    },
    [],
  );

  const addArquivos = useCallback(
    (lista: FileList | null, comoPrincipal = false) => {
      if (lista?.length) addFiles(Array.from(lista), comoPrincipal);
    },
    [addFiles],
  );

  // "Editar esse vídeo": baixa o vídeo pronto e injeta na montagem.
  // Ao gerar, sai um job NOVO (cópia) - o vídeo original nunca é alterado.
  //
  // Dois sabores (06/08/2026):
  // - genérico: o vídeo vira a BASE ("Vídeo com fala") e a pessoa cai nas mídias.
  // - `shopee`: é vídeo de PRODUTO da Shopee, então as respostas do funil já são
  //   conhecidas e vêm pré-selecionadas (pedido do dono): narração por IA com "A
  //   IA escreve", produto SIM com o nome do card (preço não existe no dado dos
  //   virais, fica pra pessoa), tom equilibrado, venda na Shopee, o vídeo entra
  //   como mídia, som original MUDO e músicas da plataforma ligadas. A pessoa
  //   começa da etapa 1 e vai só apertando Continuar, conferindo cada passo.
  const carregouInicial = useRef(false);
  useEffect(() => {
    if (carregouInicial.current || !videoInicial?.url) return;
    carregouInicial.current = true;
    (async () => {
      try {
        const res = await fetch(videoInicial.url);
        if (!res.ok) throw new Error("falhou");
        const blob = await res.blob();
        const file = new File([blob], `${videoInicial.nome || "video"}.mp4`, {
          type: blob.type || "video/mp4",
        });
        if (videoInicial.shopee) {
          // vídeo de produto: entra como MÍDIA da narração, não como base
          await addFiles([file], false);
          setModo("narracao");
          setFalaPor("ia");
          setEhProduto(true);
          // o título do card vira o nome do produto ("Nicho: X" perde o prefixo,
          // que é categoria, não nome)
          setNome(videoInicial.nome.replace(/^nicho:\s*/i, "").trim());
          setFormato("voz");
          setTom("equilibrado");
          setPlataforma("shopee");
          // a narração é quem fala: o som original do vídeo sai de fábrica
          setAudioVideo("remover");
          setMusicaAuto(true);
          // a chave já nasce ligada, então a lista do seletor vem junto (o
          // fetch do clique da chave não vai acontecer)
          fetch("/api/musicas")
            .then((r) => r.json())
            .then((d: { musicas?: { arquivo: string; nome: string }[] }) =>
              setMusicasPlataforma(d.musicas ?? []),
            )
            .catch(() => setMusicasPlataforma([]));
          toast.success(
            "Vídeo de produto carregado: montagem pra Shopee já pré-selecionada. Confira cada etapa e vá em Continuar. 🛍️",
          );
        } else {
          // ele É o vídeo: entra como base já resolvida e a pessoa cai direto
          // nas mídias, sem ter que responder de onde o vídeo parte
          await addFiles([file], true);
          setModo("base");
          setFormato("transcrever");
          setPasso(3);
          toast.success("Vídeo carregado. Suas alterações geram uma cópia nova. 🎬");
        }
      } catch {
        toast.error("Não consegui carregar esse vídeo pra edição.");
      }
    })();
  }, [videoInicial, addFiles, setPasso]);

  /**
   * Mídias que voltaram DO SERVIDOR no reuso (tarefa 21). Na geração, os
   * arquivos deste conjunto não sobem de novo: vai só o nome + o job de origem,
   * e o servidor copia de disco a disco. Arquivo trocado/adicionado pela pessoa
   * não está no conjunto e sobe normalmente.
   */
  const midiasServidorRef = useRef<{ jobId: string | null; files: WeakSet<File> }>({
    jobId: null,
    files: new WeakSet<File>(),
  });

  // ===== UPLOAD NA ETAPA 3 (dono, 11/08/2026) =====
  // As mídias sobem assim que a pessoa escolhe, e não mais no clique final. A
  // espera passa a acontecer enquanto ela monta o vídeo, que é tempo que ela ia
  // gastar de qualquer jeito, e no fim não sobra upload: o job nasce na hora e
  // o "pode fechar a aba" chega no instante mais cedo que existe.
  //
  // Elas vão pra um job RASCUNHO ("recebendo"), que o worker não pega e que não
  // aparece em Meus vídeos. No envio o servidor copia daquela pasta pra do job
  // de verdade, disco a disco. Rascunho largado é limpo pela varredura.
  const [envios, setEnvios] = useState<
    Record<string, { pct: number; estado: "subindo" | "ok" | "erro" }>
  >({});
  const rascunhoRef = useRef<{ id: string | null; criando: Promise<string> | null }>({
    id: null,
    criando: null,
  });
  /** um envio por vez: cinco arquivos grandes em paralelo só brigam por banda */
  const filaEnvio = useRef<Promise<unknown>>(Promise.resolve());
  const jaNaFila = useRef(new Set<string>());

  /** Abre o rascunho na primeira mídia e reaproveita ele nas seguintes. */
  const garantirRascunho = useCallback(async () => {
    const r = rascunhoRef.current;
    if (r.id) return r.id;
    if (!r.criando) {
      r.criando = criarRascunhoDeUpload({
        produto: "Rascunho do editor",
        tipo: "produto",
      })
        .then((id) => {
          rascunhoRef.current.id = id;
          return id;
        })
        .catch((e) => {
          // sem zerar isto, uma falha de rede na abertura deixaria TODA mídia
          // seguinte pendurada na mesma promessa quebrada
          rascunhoRef.current.criando = null;
          throw e;
        });
    }
    return r.criando;
  }, []);

  const enfileirarEnvio = useCallback(
    (id: string, kind: "video" | "image", file: File) => {
      filaEnvio.current = filaEnvio.current.then(async () => {
        setEnvios((p) => ({ ...p, [id]: { pct: 0, estado: "subindo" } }));
        try {
          const jobId = await garantirRascunho();
          await enviarArquivoEmPedacos(
            jobId,
            kind === "video" ? "videos" : "imagens",
            file,
            (f) =>
              setEnvios((p) => ({
                ...p,
                [id]: { pct: Math.round(f * 100), estado: "subindo" },
              })),
          );
          setEnvios((p) => ({ ...p, [id]: { pct: 100, estado: "ok" } }));
        } catch (e) {
          setEnvios((p) => ({ ...p, [id]: { pct: 0, estado: "erro" } }));
          // o motivo REAL importa: a abertura do rascunho passa pela trava de
          // geração, então "você já tem 5 vídeos em produção" aparece aqui. Com
          // id fixo, cinco arquivos falhando não viram cinco avisos iguais.
          toast.error(
            (e as Error)?.message || "Não consegui enviar essa mídia. Tente de novo.",
            { id: "envio-editor" },
          );
        }
      });
    },
    [garantirRascunho],
  );

  /** Mídia nova na lista entra na fila de upload. Roda por efeito, e não dentro
   *  do `addFiles`, pra valer também pro que chega por outros caminhos (rascunho
   *  retomado, "Editar esse vídeo"). */
  useEffect(() => {
    if (bloqueado) return;
    for (const c of clips) {
      if (jaNaFila.current.has(c.id)) continue;
      jaNaFila.current.add(c.id);
      // arquivo que veio da entrada de um job anterior já está no servidor: ele
      // viaja pelo caminho de reuso da tarefa 21, sem subir de novo
      if (midiasServidorRef.current.files.has(c.file)) {
        setEnvios((p) => ({ ...p, [c.id]: { pct: 100, estado: "ok" } }));
        continue;
      }
      enfileirarEnvio(c.id, c.kind, c.file);
    }
  }, [clips, bloqueado, enfileirarEnvio]);

  /** Mídia que ainda não terminou de subir (trava o gerar). */
  const enviosPendentes = clips.filter(
    (c) => (envios[c.id]?.estado ?? "subindo") !== "ok",
  );
  const envioFalhou = clips.some((c) => envios[c.id]?.estado === "erro");
  /** Quanto do envio já foi, POR BYTE: com um arquivo de 2 MB e outro de 200 MB,
   *  contar por quantidade mostraria 50% com quase nada enviado. */
  const pctEnvio = (() => {
    const total = clips.reduce((s, c) => s + c.file.size, 0);
    if (!total) return 100;
    const feito = clips.reduce((s, c) => {
      const e = envios[c.id];
      if (e?.estado === "ok") return s + c.file.size;
      return s + (c.file.size * (e?.pct ?? 0)) / 100;
    }, 0);
    return Math.min(100, Math.round((feito / total) * 100));
  })();

  /** Tenta de novo o que falhou, sem mexer no que já subiu. */
  function reenviarFalhas() {
    for (const c of clips) {
      if (envios[c.id]?.estado !== "erro") continue;
      enfileirarEnvio(c.id, c.kind, c.file);
    }
  }

  // "Tentar Novamente" / "Editar novamente": pré-preenche os ajustes de um vídeo
  // anterior e, dentro das 24h de retenção, recarrega as mídias do servidor.
  const aplicouConfig = useRef(false);
  useEffect(() => {
    if (aplicouConfig.current || !configInicial) return;
    aplicouConfig.current = true;
    setEhProduto(configInicial.ehProduto ?? true);
    setNome(configInicial.nome);
    setDescricao(configInicial.descricao);
    setPreco(configInicial.preco);
    // "legenda" não existe mais no modo com fala (a copy queimada brigava com o
    // que a pessoa diz), então config antiga com legenda vira transcrever
    setFormato(configInicial.formato === "legenda" ? "transcrever" : configInicial.formato);
    setTom(configInicial.tom as Tom);
    if (configInicial.voz) setVoz(configInicial.voz);
    // o formato de antes já diz de onde aquele vídeo partia: "voz" era narração
    setModo(configInicial.formato === "voz" ? "narracao" : "base");
    // a posição da legenda do vídeo anterior volta junto (o campo já vinha do
    // banco, mas não tinha onde ser aplicado enquanto ela era por-texto)
    if (configInicial.legendaPos === "cima" || configInicial.legendaPos === "meio")
      setLegendaPos(configInicial.legendaPos);
    // ---- o resto da montagem original (tarefa 21) ----
    if (configInicial.roteiroFala) {
      setFalaPor("eu");
      setRoteiroFala(configInicial.roteiroFala);
    }
    if (configInicial.audioVideo) setAudioVideo(configInicial.audioVideo);
    if (configInicial.legendaEstilo) setLegendaEstilo(configInicial.legendaEstilo);
    if (configInicial.musicaNome) {
      setMusicaAuto(true);
      setMusicaEscolhida(configInicial.musicaNome);
    }
    const vols = configInicial.volumes;
    if (typeof vols?.original === "number") setVolumeOriginal(vols.original);
    if (typeof vols?.musica === "number") setVolumeMusica(vols.musica);
    if (typeof vols?.voz === "number") setVolumeVoz(vols.voz);
    if (typeof configInicial.velocidadeMusica === "number")
      setVelocidadeMusica(configInicial.velocidadeMusica);
    if (typeof configInicial.cortarSilencio === "number")
      setCortarSilencio(configInicial.cortarSilencio);
    if (configInicial.edicao) setEdicao({ ...EDICAO_PADRAO, ...configInicial.edicao });
    const textosDeVolta = (configInicial.textos ?? [])
      .filter((t) => typeof t.texto === "string" && t.texto.trim())
      .map((t) => ({
        id: novoId(),
        conteudo: String(t.texto),
        pos: (["cima", "meio", "baixo"].includes(String(t.pos)) ? t.pos : "baixo") as Posicao,
        inSec: Number(t.in) || 0,
        outSec: Number(t.out) || 0,
      }));
    if (textosDeVolta.length) setTextos(textosDeVolta);
    setPasso(2);

    // ---- mídias originais: dentro das 24h elas ainda estão no servidor ----
    const cenas = configInicial.cenas ?? [];
    const noServidor = configInicial.midiasServidor ?? [];
    const jobOrigem = configInicial.jobId;
    if (!jobOrigem || noServidor.length === 0) {
      toast.info(
        "Ajustes reaproveitados, mas as mídias originais expiraram (valem 24h). Faça o upload dos arquivos novamente pra re-gerar. 🔁",
      );
      return;
    }
    (async () => {
      try {
        // a ficha de cada cena (corte, momento, trecho e descrição) espera o
        // arquivo voltar: o addFiles reencaixa pelo nome + tamanho, o MESMO
        // mecanismo do rascunho
        fichasPendentes.current = cenas
          .map((c) => {
            const arq = noServidor.find((m) => m.nome === c.nome);
            if (!arq) return null;
            return {
              nome: c.nome,
              tam: arq.tamanho,
              inSec: Number(c.in) || 0,
              outSec: Number(c.out) || 0,
              entra: typeof c.entra === "number" ? c.entra : null,
              trecho: typeof c.trecho === "number" ? c.trecho : null,
              dura: typeof c.dura === "number" ? c.dura : null,
              descricao: String(c.descricao ?? ""),
            };
          })
          .filter((f): f is FichaCena => !!f);

        const baixar = async (nome: string) => {
          const r = await fetch(
            `/api/jobs/${jobOrigem}/entrada/${encodeURIComponent(nome)}`,
          );
          if (!r.ok) return null;
          const blob = await r.blob();
          return new File([blob], nome, {
            type: blob.type || "application/octet-stream",
          });
        };

        // baixa na ordem do roteiro, separando principal de apoio (o papel não
        // viaja pela ficha de propósito: quem manda é a chamada do addFiles)
        const principais: File[] = [];
        const apoios: File[] = [];
        const vistos = new Set<string>();
        for (const c of cenas) {
          if (!c.nome || vistos.has(c.nome)) continue;
          vistos.add(c.nome);
          if (!noServidor.some((m) => m.nome === c.nome)) continue;
          const f = await baixar(c.nome);
          if (!f) continue;
          (c.papel === "principal" ? principais : apoios).push(f);
        }
        // arquivo na pasta que não aparece no roteiro (raro): volta como apoio
        for (const m of noServidor) {
          if (vistos.has(m.nome)) continue;
          vistos.add(m.nome);
          const f = await baixar(m.nome);
          if (f) apoios.push(f);
        }

        if (!principais.length && !apoios.length) {
          toast.info(
            "As mídias originais expiraram no servidor. Faça o upload dos arquivos novamente pra re-gerar.",
          );
          return;
        }
        midiasServidorRef.current.jobId = jobOrigem;
        for (const f of [...principais, ...apoios]) midiasServidorRef.current.files.add(f);
        if (principais.length) await addFiles(principais, true);
        if (apoios.length) await addFiles(apoios, false);
        toast.success(
          "Ajustes e mídias originais recuperados: ajuste o que quiser e gere de novo. 🔁",
        );
      } catch {
        toast.info(
          "Não consegui recuperar as mídias originais. Faça o upload dos arquivos novamente pra re-gerar.",
        );
      }
    })();
  }, [configInicial, setPasso, addFiles]);

  function removerClip(id: string) {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      URL.revokeObjectURL(prev[idx].url);
      const next = prev.filter((c) => c.id !== id);
      setSel((s) => Math.max(0, Math.min(s, next.length - 1)));
      return next;
    });
  }

  function mover(idx: number, dir: -1 | 1) {
    setClips((prev) => {
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[alvo]] = [next[alvo], next[idx]];
      return next;
    });
    setSel(idx + dir);
  }

  function setTrim(qual: "in" | "out", valor: number) {
    setClips((prev) =>
      prev.map((c, i) => {
        if (i !== sel) return c;
        if (qual === "in") return { ...c, inSec: Math.min(valor, c.outSec - 0.3), trecho: null };
        return { ...c, outSec: Math.max(valor, c.inSec + 0.3), trecho: null };
      }),
    );
  }

  // ---- textos ----
  function addTexto() {
    setTextos((prev) => [
      ...prev,
      {
        id: novoId(),
        conteudo: "",
        pos: "baixo",
        inSec: 0,
        outSec: totalDur > 0 ? Math.round(totalDur * 10) / 10 : 5,
      },
    ]);
  }
  function updTexto(id: string, patch: Partial<Texto>) {
    setTextos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function setTextoTempo(id: string, qual: "in" | "out", valor: number) {
    setTextos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (qual === "in") return { ...t, inSec: Math.min(valor, t.outSec - 0.2) };
        return { ...t, outSec: Math.max(valor, t.inSec + 0.2) };
      }),
    );
  }
  function removerTexto(id: string) {
    setTextos((prev) => prev.filter((t) => t.id !== id));
  }

  // ---- player ----
  const irPara = useCallback(
    (idx: number, auto: boolean) => {
      pararTimer();
      if (idx >= clips.length) {
        setTocando(false);
        audioRef.current?.pause();
        return;
      }
      setSel(idx);
      const c = clips[idx];
      setTempo(c.inSec);
      const v = videoRef.current;
      if (c.kind === "video" && v) {
        v.currentTime = c.inSec;
        if (auto) v.play().catch(() => {});
      } else if (c.kind === "image" && auto) {
        // tique pra o playhead/textos andarem durante a imagem
        imgTimer.current = setInterval(() => {
          setTempo((t) => {
            const nt = t + 0.1;
            if (nt >= c.outSec) {
              pararTimer();
              irPara(idx + 1, true);
              return c.outSec;
            }
            return nt;
          });
        }, 100);
      }
    },
    [clips],
  );

  /**
   * Leva a prévia pro segundo `t` da LINHA DO VÍDEO (a régua da timeline).
   *
   * A linha é a emenda dos principais, então o segundo global vira (a) QUAL
   * principal está tocando ali e (b) o tempo DENTRO do arquivo dele. Quando o
   * palco ainda é outro clipe, o pulo fica anotado em `seekPendente` e o efeito
   * que troca o `src` aplica na carga - setar `currentTime` antes disso seria
   * engolido pelo `inSec` que o efeito põe por padrão.
   */
  const seekPendente = useRef<number | null>(null);
  function seekGlobal(t: number) {
    if (!modoPrincipal || !principais.length) return;
    const alvoT = Math.max(0, Math.min(t, Math.max(0, durBase - 0.05)));
    let i = principais.length - 1;
    for (let k = 0; k < principais.length; k++) {
      const fim = inicioDoBase(k) + (principais[k].outSec - principais[k].inSec);
      if (alvoT < fim - 0.001) {
        i = k;
        break;
      }
    }
    const alvo = principais[i];
    const local = Math.min(alvo.outSec, alvo.inSec + (alvoT - inicioDoBase(i)));
    pararTimer();
    setIdxBase(i);
    const idxClips = clips.findIndex((c) => c.id === alvo.id);
    if (idxClips >= 0) setSel(idxClips);
    setTempo(local);
    const v = videoRef.current;
    if (v && palco?.id === alvo.id) v.currentTime = local;
    else seekPendente.current = local;
    // a música acompanha a agulha (tocando, muda na hora; parada, o próximo
    // play parte daqui). 1s de vídeo consome `velocidadeMusica` s do arquivo,
    // e o render repete a faixa quando ela é mais curta: daí o resto da divisão.
    const a = audioRef.current;
    if (a && musicaUrl && comMusica) {
      const alvoMus = alvoT * velocidadeMusica;
      a.currentTime =
        a.duration && isFinite(a.duration) && a.duration > 0
          ? alvoMus % a.duration
          : alvoMus;
    }
  }

  /**
   * Para tudo: o vídeo, a música e o relógio que anda durante as fotos.
   *
   * Saiu de dentro do `togglePlay` (dono, 12/08/2026) porque o botão que fecha
   * a prévia no celular precisa da mesma parada. Sem ela, fechar tocando
   * deixaria a música rodando numa tela sem vídeo nenhum.
   */
  function pararPrevia() {
    if (!tocando) return;
    setTocando(false);
    videoRef.current?.pause();
    audioRef.current?.pause();
    pararTimer();
  }

  function togglePlay() {
    if (!clips.length) return;
    if (tocando) {
      pararPrevia();
      return;
    }
    setTocando(true);
    if (audioRef.current && musicaUrl && comMusica) {
      const a = audioRef.current;
      // no painel de editor a música parte do ponto da AGULHA, não do zero
      // (mesma conta do seekGlobal); fora dele, do começo, como sempre foi
      const alvoMus = previewNaTimeline ? tGlobal * velocidadeMusica : 0;
      a.currentTime =
        a.duration && isFinite(a.duration) && a.duration > 0
          ? alvoMus % a.duration
          : alvoMus;
      a.volume = volumeMusica / 100;
      a.play().catch(() => {});
    }
    if (modoPrincipal) {
      // com principal a prévia É a composição: eles tocam em sequência, com o som
      // deles, e os apoios entram por cima nos momentos marcados.
      pararTimer();
      const i = idxBase < principais.length ? idxBase : 0;
      if (i !== idxBase) setIdxBase(i);
      const base = principais[i];
      const v = videoRef.current;
      // se o palco já estava nesse principal o efeito abaixo não dispara: toca aqui
      if (v && base && atual?.id === base.id) {
        if (v.currentTime < base.inSec || v.currentTime >= base.outSec) {
          v.currentTime = base.inSec;
        }
        v.play().catch(() => {});
      }
      return;
    }
    irPara(sel, true);
  }

  useEffect(() => {
    const v = videoRef.current;
    if (palco?.kind === "video" && v) {
      v.src = palco.url;
      // um pulo da timeline pode ter chegado antes do src trocar: ele manda
      v.currentTime = seekPendente.current ?? palco.inSec;
      seekPendente.current = null;
      v.volume = volumeOriginal / 100;
      if (tocando && modoPrincipal) v.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palco?.id]);

  // O palco MUDA DE COLUNA quando o painel de editor liga/desliga (a prévia
  // sobe pra cima da timeline): o <video> remonta e voltaria pro quadro 0,
  // fora do corte. Devolve pro pedaço certo e refaz o volume, que também é do
  // elemento antigo.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || palco?.kind !== "video") return;
    v.currentTime = Math.max(palco.inSec, Math.min(tempo, palco.outSec));
    v.volume = Math.min(1, volumeOriginal / 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewNaTimeline]);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !palco) return;
    setTempo(v.currentTime);
    if (v.currentTime >= palco.outSec) {
      if (modoPrincipal) {
        // acabou este principal: emenda no próximo, ou termina o vídeo
        const prox = idxPalcoBase + 1;
        if (tocando && prox < principais.length) {
          setIdxBase(prox);
          return;
        }
        v.pause();
        audioRef.current?.pause();
        setTocando(false);
        setIdxBase(0);
        v.currentTime = palco.inSec;
        setTempo(palco.inSec);
        // no painel de editor, acabar o vídeo devolve a agulha (e a música)
        // pro zero: sem isso o próximo play partia do fim, com a música muda
        if (previewNaTimeline) seekGlobal(0);
      } else if (tocando) {
        irPara(sel + 1, true);
      } else {
        v.pause();
      }
    }
  }

  // ---- clipes principais (a base, em sequência) ----
  function alternarPrincipal(id: string) {
    const alvo = clips.find((c) => c.id === id);
    if (!alvo || alvo.kind !== "video") return;
    const virandoPrincipal = alvo.papel !== "principal";
    // os principais ficam JUNTOS no topo, na ordem em que vão tocar. O clipe que
    // muda de papel vai pro fim desse bloco: marcando, vira o último principal;
    // desmarcando, vira o primeiro apoio. Nos dois casos é a mesma posição.
    const destino = clips.filter((c) => c.id !== id && c.papel === "principal").length;
    setClips((prev) => {
      const marcados = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              papel: (virandoPrincipal ? "principal" : "apoio") as Clip["papel"],
              entra: null,
              trecho: null,
              dura: null,
              // a descrição SOBREVIVE à troca de papel (06/08/2026): agora o
              // principal também pode ser descrito, e apagar o que a pessoa
              // escreveu só porque ela marcou a estrelinha seria perder texto
              descricao: c.descricao,
              descricaoIA: c.descricaoIA,
            }
          : c,
      );
      const mudou = marcados.find((c) => c.id === id)!;
      const outros = marcados.filter((c) => c.id !== id);
      return [...outros.slice(0, destino), mudou, ...outros.slice(destino)];
    });
    setSel(destino);
    setTocando(false);
    setIdxBase(0);
    pararTimer();
    videoRef.current?.pause();
    audioRef.current?.pause();
    // quem narra passa a ser a pessoa: a voz da IA por cima brigaria com a fala dela
    if (virandoPrincipal && formato === "voz") {
      setFormato("transcrever");
      if (audioVideo === "remover") setAudioVideo("manter");
      toast.info("Com clipe principal a narração é a fala do vídeo: mudei pra Transcrever fala. 🙂");
    }
  }

  /**
   * Geometria da cena vinda do painel da etapa 5 (arrasto e alças de tamanho).
   *
   * Um setter só pros dois campos de propósito: a alça da esquerda muda o
   * `entra` E o `dura` no MESMO gesto (o fim da cena fica parado), e em duas
   * chamadas o React aplicaria uma por cima da outra com um quadro de diferença.
   * Nada aqui invalida o posicionamento da IA (dono, 11/08/2026): quem mexeu foi
   * a pessoa, e a assinatura da montagem olha só o corte de cada cena.
   */
  function setGeoApoio(id: string, geo: { entra?: number | null; dura?: number | null }) {
    setClips((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              ...(geo.entra !== undefined ? { entra: geo.entra } : {}),
              ...(geo.dura !== undefined ? { dura: geo.dura } : {}),
            }
          : c,
      ),
    );
  }

  /** O pedaço do arquivo que aparece, escolhido na faixa de corte do painel. */
  function setTrechoApoio(id: string, valor: number | null) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, trecho: valor } : c)));
  }

  function setDescricaoClip(id: string, valor: string) {
    setClips((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, descricao: valor, descricaoIA: false } : c,
      ),
    );
  }

  // ---- etapa 1: de onde o vídeo parte ----
  function escolherModo(novo: Modo) {
    setModo(novo);
    if (novo === "narracao") {
      // não há ninguém falando em vídeo: quem narra é a voz de IA, então nada de
      // clipe principal
      setClips((prev) =>
        prev.map((c) =>
          c.papel === "principal" ? { ...c, papel: "apoio", entra: null } : c,
        ),
      );
      setFormato("voz");
      // padrão do modo (tarefa 31): a narração abre com "A IA escreve", e a IA
      // precisa do produto pra ter assunto, então o produto já liga junto. A
      // pessoa pode trocar pra "Eu escrevo" e aí destravar o "Não" da etapa 2.
      setFalaPor("ia");
      if (!ehProduto) setEhProduto(true);
      if (audioVideo === "manter") setAudioVideo("remover");
    } else {
      setFalaPor("ia");
      setRoteiroFala("");
      // no modo com fala só existem transcrever/nenhum: a voz de IA brigaria
      // com a fala do vídeo e a legenda de copy contaria outra história por cima
      if (formato === "voz" || formato === "legenda") setFormato("transcrever");
      // no modo com fala o som do vídeo É a narração: ele nunca sai
      setAudioVideo("manter");
    }
  }

  /**
   * Quem escreve a fala da narração (etapa 1).
   *
   * "A IA escreve" LIGA o produto junto (06/08/2026): sem produto a IA fica sem
   * assunto e "escreveria" do nada, então o par IA-escrevendo + sem-produto não
   * existe. É por isso que, com ela marcada, o "Não" da etapa 2 fica travado.
   */
  function escolherFalaPor(quem: "ia" | "eu") {
    setFalaPor(quem);
    if (quem === "ia" && !ehProduto) {
      setEhProduto(true);
      toast.info(
        "Pra IA escrever a fala ela precisa do produto: liguei o 'É um produto?' pra você preencher na próxima etapa. 🙂",
      );
    }
  }

  /** o "Não" da etapa 2 fica travado enquanto a IA é quem escreve a fala */
  const produtoObrigatorio = modo === "narracao" && falaPor === "ia";

  /**
   * Liga e desliga o "É um produto?".
   *
   * Com "A IA escreve" marcado na narração o Não é bloqueado (botão desabilitado
   * e guarda aqui): a IA precisa do produto pra ter assunto. Quem escolheu "Eu
   * escrevo" alterna livremente.
   */
  function mudarProduto(novo: boolean) {
    if (!novo && produtoObrigatorio) {
      toast.info(
        "Com 'A IA escreve' o produto é obrigatório: é dele que a IA tira o assunto. Volte na etapa 1 e escolha 'Eu escrevo' se não for um produto. 🙂",
      );
      return;
    }
    setEhProduto(novo);
  }

  /**
   * Responde a pergunta de legenda da etapa 2 ("Sim, legendar a fala" / "Não").
   *
   * Além de guardar o formato, arruma duas coisas que dependem dele: o som
   * original precisa estar ligado pra existir fala pra transcrever, e a posição
   * da legenda volta pro padrão quando a pessoa desliga a legenda (senão, ao
   * religar depois, ela reapareceria numa faixa escolhida pra outro vídeo).
   */
  function mudarFormatoLegenda(v: "transcrever" | "nenhum") {
    setFormato(v);
    if (v === "transcrever" && audioVideo === "remover") {
      setAudioVideo("manter");
      toast.info("Liguei o som original: é ele que vira a legenda. 🙂");
    }
    if (v === "nenhum") setLegendaPos("baixo");
  }

  // ---- a IA olha as cenas que ficaram sem descrição (etapa 3) ----
  /**
   * Tira alguns quadros do clipe DENTRO do navegador, no arquivo local, e devolve
   * em JPEG pequeno. É o que evita subir 300 MB de vídeo só pra IA olhar cinco
   * imagens - e é rápido porque o arquivo já está aqui.
   */
  const quadrosDoClip = useCallback(async (c: Clip): Promise<string[]> => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const desenhar = (fonte: CanvasImageSource, w: number, h: number) => {
      if (!w || !h) return "";
      const escala = Math.min(1, LARGURA_QUADRO / w);
      canvas.width = Math.max(1, Math.round(w * escala));
      canvas.height = Math.max(1, Math.round(h * escala));
      ctx.drawImage(fonte, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", 0.7);
      return url.slice(url.indexOf(",") + 1);
    };

    if (c.kind === "image") {
      const img = await new Promise<HTMLImageElement | null>((res) => {
        const el = new Image();
        el.onload = () => res(el);
        el.onerror = () => res(null);
        el.src = c.url;
      });
      if (!img) return [];
      const q = desenhar(img, img.naturalWidth, img.naturalHeight);
      return q ? [q] : [];
    }

    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.src = c.url;
    const pronto = await new Promise<boolean>((res) => {
      v.onloadeddata = () => res(true);
      v.onerror = () => res(false);
    });
    if (!pronto) return [];

    const janela = Math.max(0.1, c.outSec - c.inSec);
    const quadros: string[] = [];
    // trecho curto não tem o que comparar: um quadro só, e não cinco iguais
    const marcas = janela > 0.6 ? MARCAS_ANALISE : [0.5];
    for (const p of marcas) {
      const alvo = Math.min(c.dur - 0.05, c.inSec + janela * p);
      const chegou = await new Promise<boolean>((res) => {
        const fim = () => {
          v.onseeked = null;
          res(true);
        };
        v.onseeked = fim;
        v.onerror = () => res(false);
        v.currentTime = Math.max(0, alvo);
        // navegador que engasga no seek não pode travar a etapa inteira
        setTimeout(() => res(false), 4000);
      });
      if (!chegou) continue;
      const q = desenhar(v, v.videoWidth, v.videoHeight);
      if (q) quadros.push(q);
    }
    v.src = "";
    return quadros;
  }, []);

  /**
   * Play/pause da PRÉVIA da trilha da plataforma (botão ao lado do seletor).
   * Usa o mesmo <audio> da música própria, então o volume e a velocidade
   * escolhidos ali embaixo valem aqui também.
   */
  function alternarPreviaMusica() {
    const a = audioRef.current;
    if (!a || !musicaUrl) return;
    if (a.paused) {
      a.currentTime = 0;
      a.volume = volumeMusica / 100;
      a.play().catch(() => toast.error("Não consegui tocar essa música agora."));
    } else {
      a.pause();
    }
  }

  /**
   * Contexto do produto pra IA que descreve as cenas (dono, 06/08/2026): com
   * "É um produto? Sim", nome/preço/descrição vão junto e a IA reconhece o que
   * está vendo ("close no tecido da Blusa X" em vez de "close num tecido").
   */
  function contextoProduto() {
    if (!ehProduto || !nome.trim()) return undefined;
    return {
      nome: nome.trim(),
      preco: preco.trim(),
      descricao: descricao.trim(),
    };
  }

  /**
   * O que a IA devolveu vira descrição + melhor trecho de cada cena.
   *
   * É função PURA de propósito: o "Aprovar e gerar" descreve as cenas que
   * ficaram em branco no instante do envio e precisa do resultado NA HORA pra
   * montar o roteiro. Esperando o estado do React ele mandaria a lista velha.
   */
  function comDescricoes(
    lista: Clip[],
    vindas: Record<string, { mostra?: string; melhor?: number }>,
  ): Clip[] {
    return lista.map((c, i) => {
      const achou = vindas[String(i)];
      if (!achou?.mostra) return c;
      // "melhor" (0 a 1) vira o segundo do arquivo de onde sai o pedaço que
      // aparece na tela, sem deixar a cena começar tão no fim que não caiba
      const dur = duracaoApoio({ tipo: c.kind, in: c.inSec, out: c.outSec, dura: c.dura });
      const espaco = Math.max(0, c.outSec - c.inSec - dur);
      const trecho =
        c.kind === "video" && espaco > 0.2
          ? Number((c.inSec + espaco * Math.max(0, Math.min(1, achou.melhor ?? 0))).toFixed(2))
          : null;
      return { ...c, descricao: achou.mostra, descricaoIA: true, trecho };
    });
  }

  /** A mesma conta, aplicada no estado (botões de descrever da etapa Mídias). */
  function aplicarDescricoes(vindas: Record<string, { mostra?: string; melhor?: number }>) {
    setClips((prev) => comDescricoes(prev, vindas));
  }

  /**
   * Manda a IA olhar as cenas `alvos` e devolve o que ela respondeu, SEM tocar
   * na tela. Quem chama decide o destino: os botões da etapa Mídias aplicam no
   * estado, e o "Aprovar e gerar" usa direto na montagem que está enviando.
   *
   * `faltaCreditos` sai separado do resto porque é a única falha que segura o
   * vídeo: sem saldo nada adianta tentar de novo mais adiante.
   */
  async function pedirDescricoes(lista: Clip[], alvos: Clip[]) {
    const vazio = {
      vindas: {} as Record<string, { mostra?: string; melhor?: number }>,
      faltaCreditos: false,
    };
    const cenas: { i: number; tipo: string; quadros: string[] }[] = [];
    for (const c of alvos) {
      const quadros = await quadrosDoClip(c);
      if (quadros.length) {
        cenas.push({ i: lista.indexOf(c), tipo: c.kind, quadros });
      }
    }
    if (!cenas.length) {
      return {
        ...vazio,
        erro: "Não consegui ler os quadros do arquivo. Descreva na mão e siga em frente.",
      };
    }
    try {
      const res = await fetch("/api/editor/descrever-cenas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cenas, produto: contextoProduto() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        erro?: string;
        faltaCreditos?: boolean;
        cenas?: Record<string, { mostra?: string; melhor?: number }>;
        creditos?: number;
      };
      if (!res.ok) {
        return {
          ...vazio,
          faltaCreditos: !!data.faltaCreditos,
          erro: data.erro ?? "Não consegui analisar as cenas agora.",
        };
      }
      return { vindas: data.cenas ?? {}, faltaCreditos: false, erro: "" };
    } catch {
      return { ...vazio, erro: "Sem conexão com o servidor." };
    }
  }

  async function analisarCenas() {
    if (bloqueado) {
      toast.info("Conta de demonstração não usa a análise de cenas. 🙂");
      return;
    }
    if (!cenasAnalisaveis.length) return;
    setAnalisando(true);
    try {
      const { vindas, erro } = await pedirDescricoes(clips, cenasAnalisaveis);
      if (erro) {
        toast.error(erro);
        return;
      }
      aplicarDescricoes(vindas);
      const n = Object.keys(vindas).length;
      toast.success(
        `${n} ${n === 1 ? "cena descrita" : "cenas descritas"} pela IA. Confira e ajuste o que quiser. 🔎`,
      );
    } finally {
      setAnalisando(false);
    }
  }

  /**
   * Descreve UMA cena (botão de varinha ao lado da descrição na lista). Mesma
   * rota e mesmo preço por cena do lote; a diferença é que aqui o clique é
   * explícito, então reescreve inclusive descrição que já existia.
   */
  async function analisarCena(id: string) {
    if (bloqueado) {
      toast.info("Conta de demonstração não usa a análise de cenas. 🙂");
      return;
    }
    const c = clips.find((x) => x.id === id);
    if (!c || ocupadoAnalise) return;
    setAnalisandoCena(id);
    try {
      const { vindas, erro } = await pedirDescricoes(clips, [c]);
      if (erro) {
        toast.error(erro);
        return;
      }
      aplicarDescricoes(vindas);
      toast.success("Cena descrita pela IA. Confira e ajuste se quiser. 🔎");
    } finally {
      setAnalisandoCena(null);
    }
  }

  /**
   * POSICIONAR AS CENAS POR IA.
   *
   * A IA ouve a fala do vídeo principal e devolve em que segundo cada cena de
   * apoio entra. Isso vira o campo `entra` de cada uma, ou seja: a linha do tempo
   * da tela passa a ser a MESMA que vai pro render.
   *
   * Roda em dois momentos: no botão da etapa 5 (a pessoa quer ver e corrigir os
   * segundos antes) e dentro do "Aprovar e gerar", pra quem não clicou em nada.
   * Por isso recebe a lista de clipes em vez de ler o estado - no envio ela pode
   * ter descrições que a IA acabou de escrever e que o React ainda não aplicou.
   *
   * O áudio é extraído AQUI, do arquivo que já está na máquina (`extrairAudioDaBase`):
   * o transcritor mora na máquina que renderiza, e subir o vídeo inteiro só pra
   * isso seria mandar centenas de megabytes à toa.
   */
  async function pedirPosicoes(lista: Clip[]) {
    const vazio = {
      porId: new Map<string, number>(),
      semAudio: false,
      estimadas: 0,
      entram: 0,
      faltaCreditos: false,
    };
    const base = lista.filter((c) => c.papel === "principal");
    const dur = base.reduce((s, c) => s + (c.outSec - c.inSec), 0);
    const marcas = marcasDe(lista);
    const entram = marcas
      .map((m) => lista.find((c) => c.id === m.id))
      .filter((c): c is Clip => !!c);
    if (!entram.length) {
      return { ...vazio, erro: "Não há cena de apoio pra posicionar nesse vídeo." };
    }

    try {
      const audio = await extrairAudioDaBase(
        base.map((c) => ({ file: c.file, inSec: c.inSec, outSec: c.outSec })),
      );
      const res = await fetch("/api/editor/posicionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durBase: dur,
          descricaoBase: base
            .map((c) => c.descricao.trim())
            .filter(Boolean)
            .join("; "),
          produto: contextoProduto(),
          audio: audio?.base64 ?? "",
          audioMime: audio?.mime ?? "",
          cenas: entram.map((c) => ({
            i: lista.indexOf(c),
            tipo: c.kind,
            descricao: c.descricao,
            dur:
              marcas.find((m) => m.id === c.id)?.dur ??
              (c.kind === "image" ? IMAGEM_MIN_SEG : APOIO_MIN),
            // tamanho escolhido na mão: avisa o servidor pra ele aceitar cena
            // menor que o piso automático (mexer nos apoios invalida a
            // assinatura da montagem e um novo posicionamento pode rodar já
            // com tamanhos redimensionados na mão)
            manual: c.dura !== null,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        erro?: string;
        faltaCreditos?: boolean;
        semAudio?: boolean;
        estimadas?: number;
        cenas?: { i: number; entra: number; porque?: string }[];
      };
      if (!res.ok) {
        return {
          ...vazio,
          entram: entram.length,
          faltaCreditos: !!data.faltaCreditos,
          erro: data.erro ?? "Não consegui posicionar as cenas agora.",
        };
      }

      // o `porque` que a rota devolve não é lido: o painel da cena mostrava
      // isso e o dono tirou (11/08/2026 - o segundo escolhido já se vê na
      // timeline, a justificativa só ocupava linha)
      const porId = new Map<string, number>();
      for (const p of data.cenas ?? []) {
        const c = lista[p.i];
        if (!c) continue;
        porId.set(c.id, p.entra);
      }
      // TODAS as cenas que entram precisam ter voltado com um segundo. Faltando
      // uma, a linha do tempo mostrada não seria a do vídeo: nada é aplicado e
      // quem chamou decide (o botão avisa, o envio segue com o encaixe do render).
      if (porId.size < entram.length) {
        return {
          ...vazio,
          entram: entram.length,
          erro: `A IA devolveu o lugar de ${porId.size} de ${entram.length} cenas. Tente de novo pra ver a linha do tempo inteira antes de gerar.`,
        };
      }
      return {
        porId,
        semAudio: !!data.semAudio,
        estimadas: data.estimadas ?? 0,
        entram: entram.length,
        faltaCreditos: false,
        erro: "",
      };
    } catch {
      return { ...vazio, entram: entram.length, erro: "Sem conexão com o servidor." };
    }
  }

  /**
   * TERMINA O VÍDEO DEPOIS QUE A PESSOA JÁ SAIU DA TELA (dono, 11/08/2026).
   *
   * O job já existe e já tem as mídias; falta descrever o que ficou em branco,
   * encaixar as cenas na fala e soltar pra fila. Isso roda com o componente
   * DESMONTADO (ela está em Meus vídeos vendo o card gerar), então aqui não se
   * conta com estado nem com nada da tela: só com o que veio por parâmetro.
   *
   * As URLs dos clipes são refeitas na entrada porque a tela revoga as antigas
   * ao sair, e é delas que saem os quadros que a IA olha. O arquivo em si segue
   * vivo na memória, preso por esta função.
   *
   * DEU ERRO, NÃO GERA: qualquer falha vira erro NO JOB, com o motivo escrito.
   * Assim ela descobre pelo card em vez de receber um vídeo mal montado, e o
   * "Tentar Novamente" reabre o Editor com as mídias, que continuam no servidor.
   */
  async function terminarComIA(jobId: string, lista: Clip[]) {
    const avisar = async (motivo: string) => {
      await fetch(`/api/jobs/${jobId}/pronto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erro: motivo }),
      }).catch(() => {});
      toast.error(motivo);
    };

    const vivos = lista.map((c) => ({ ...c, url: URL.createObjectURL(c.file) }));
    try {
      let finais = vivos;
      const alvos = vivos.filter((c) => cenasAutoDescritas.some((a) => a.id === c.id));
      if (alvos.length) {
        const { vindas, erro } = await pedirDescricoes(finais, alvos);
        if (erro) return void (await avisar(erro));
        if (Object.keys(vindas).length) finais = comDescricoes(finais, vindas);
      }

      if (precisaPosicionar) {
        const pos = await pedirPosicoes(finais);
        // `entram` zerado é o caso de não haver cena de apoio pra posicionar:
        // não é falha, é vídeo que não precisa deste passo
        if (pos.erro && pos.entram) return void (await avisar(pos.erro));
        if (pos.porId.size) {
          finais = finais.map((c) =>
            pos.porId.has(c.id) ? { ...c, entra: pos.porId.get(c.id)! } : c,
          );
        }
      }

      const r = await fetch(`/api/jobs/${jobId}/pronto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roteiro: roteiroDe(finais) }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { erro?: string };
        return void (await avisar(d.erro ?? "Não consegui mandar o vídeo pra fila."));
      }
      toast.success("Cenas encaixadas: seu vídeo entrou na fila. 🎬");
      try {
        router.refresh();
      } catch {
        /* a pessoa pode já ter navegado pra outro lugar */
      }
    } catch {
      await avisar("Perdi a conexão antes de terminar de encaixar as cenas do seu vídeo.");
    } finally {
      vivos.forEach((c) => URL.revokeObjectURL(c.url));
    }
  }

  async function posicionarPorIA() {
    if (bloqueado) {
      toast.info("Conta de demonstração não usa o posicionamento por IA. 🙂");
      return;
    }
    if (ocupadoAnalise) return;

    try {
      // ===== DESCREVER ANTES DE POSICIONAR (dono, 11/08/2026) =====
      // É a descrição que conta pra IA o que cada cena MOSTRA: sem ela, casar a
      // cena com o trecho certo da fala vira chute. Este botão posicionava às
      // cegas quando havia cena em branco - a régua saía pronta e o aviso de
      // "cena sem descrição" continuava logo abaixo dela, na mesma tela.
      //
      // O resultado é usado na hora (`lista`), não pelo estado: `setClips` só
      // chega no render seguinte, e o posicionamento sairia com a lista velha.
      let lista = clips;
      if (cenasAutoDescritas.length) {
        setAnalisando(true);
        const { vindas, erro } = await pedirDescricoes(lista, cenasAutoDescritas);
        setAnalisando(false);
        // erro aqui NÃO segue em frente: posicionar sem a descrição é gastar
        // crédito num encaixe pior do que a pessoa teria pedindo de novo
        if (erro) {
          toast.error(erro);
          return;
        }
        if (Object.keys(vindas).length) {
          lista = comDescricoes(lista, vindas);
          setClips(lista);
        }
      }

      setPosicionando(true);
      const r = await pedirPosicoes(lista);
      if (r.erro) {
        if (r.entram) toast.error(r.erro);
        else toast.info(r.erro);
        return;
      }
      setClips((prev) =>
        prev.map((c) => (r.porId.has(c.id) ? { ...c, entra: r.porId.get(c.id)! } : c)),
      );
      setPosicionadoEm(assinaturaMontagem);
      // o painel de editor nasce agora: a prévia (que sobe pra cima da
      // timeline) começa do zero da composição, não do último clipe mexido
      seekGlobal(0);
      const quantas = `${r.porId.size} ${r.porId.size === 1 ? "cena posicionada" : "cenas posicionadas"}`;
      toast.success(
        r.semAudio
          ? `${quantas}. Não consegui ouvir a fala deste vídeo, então a IA distribuiu pelas descrições: confira os tempos. 🎬`
          : r.estimadas
            ? `${quantas} (${r.estimadas} a IA não soube decidir e ficaram espalhadas por tempo). Confira os tempos e ajuste o que quiser. 🎬`
            : `${quantas} pela fala do seu vídeo. Confira os tempos e ajuste o que quiser. 🎬`,
      );
    } finally {
      setAnalisando(false);
      setPosicionando(false);
    }
  }

  /**
   * Clicou num bloco da régua do tempo: leva até a cena e pisca ela.
   *
   * Sem isso a régua era só um desenho: dava pra ver que existia uma cena no
   * segundo 12, mas achar QUAL das oito era ela virava caça-palavra.
   *
   * A lista de cenas mora na etapa Mídias (06/08/2026), então vindo da régua da
   * aprovação isto VOLTA uma etapa e só aí rola: o `setTimeout` é pra lista já
   * ter sido desenhada quando o `scrollIntoView` procurar o item.
   */
  function focarCena(id: string) {
    setPasso(3);
    setDestacado(id);
    window.setTimeout(() => {
      refsCena.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    window.setTimeout(() => setDestacado((d) => (d === id ? null : d)), 1800);
  }

  // ---- navegação do funil ----
  /**
   * O que ainda falta na etapa `n`. Vazio = etapa resolvida.
   *
   * Vale pra QUALQUER etapa, não só pra atual (06/08/2026). Antes isto olhava só
   * o `passo` corrente, e por isso a trilha não tinha como saber quais etapas já
   * estavam de pé: ela marcava como feita toda etapa que ficou pra trás e travava
   * o clique pra frente. Perguntando por etapa dá pra pôr o visto verde no lugar
   * certo e devolver a pessoa direto pra onde ela estava.
   */
  const travaDoPasso = useCallback(
    (n: number) => {
    if (n === 1) {
      if (!modo) return "Escolha de onde o seu vídeo parte.";
      if (modo === "narracao" && falaPor === "eu" && roteiroFala.trim().length < 15)
        return "Escreva o texto que a voz vai falar (ou deixe a IA escrever).";
      return "";
    }
    if (n === 2) {
      if (ehProduto && nome.trim().length < 2) return "Dê um nome ao produto.";
      return "";
    }
    if (n === 3) {
      if (!clips.length) return "Adicione pelo menos um clipe ou imagem.";
      if (modo === "base" && !modoPrincipal)
        return "Suba o vídeo com a pessoa falando (ou volte e escolha a narração por IA).";
      if (passouDoTeto)
        return `O editor faz vídeo de até ${MAX_VIDEO_SEG / 60} minutos e o seu está com ${fmt(totalDur)}.`;
      if (apoioLongo)
        return `Tem cena de apoio com mais de ${MAX_APOIO_SEG / 60} minuto. Corte ela com as alças verdes, embaixo da prévia.`;
      // cena sem descrição NÃO trava mais o Continuar (dono, 11/08/2026): o que
      // a pessoa não escrever, a IA escreve sozinha no Aprovar e gerar. Escrever
      // aqui continua sendo de graça e melhor (é a sua palavra, não a dela).
      return "";
    }
    return "";
    },
    [
      modo,
      falaPor,
      roteiroFala,
      ehProduto,
      nome,
      clips.length,
      modoPrincipal,
      passouDoTeto,
      apoioLongo,
      totalDur,
    ],
  );

  const motivoTravado = travaDoPasso(passo);

  /**
   * Etapa já alcançada e sem pendência: é ela que ganha o visto verde na trilha.
   * Os dois testes importam. Só "já alcançada" marcaria como pronta uma etapa que
   * a pessoa nunca viu (a 2, por exemplo, nasce válida quando não é produto), e
   * só "sem pendência" faria o mesmo.
   */
  const passoResolvido = useCallback(
    (n: number) => n <= maxVisto && !travaDoPasso(n),
    [maxVisto, travaDoPasso],
  );

  /**
   * Dá pra pular direto pra etapa `n` clicando na trilha?
   * - pra trás é sempre livre: é o conserto, a pessoa está voltando arrumar algo;
   * - pra frente, só até onde ela já chegou e enquanto tudo antes continuar de
   *   pé. É esse segundo teste que impede o atalho de virar um furo na validação:
   *   quem volta e desfaz uma resposta perde o pulo até responder de novo.
   */
  const podeIrAoPasso = useCallback(
    (n: number) => {
      if (n === passo) return false;
      if (n < passo) return true;
      if (n > maxVisto) return false;
      for (let i = 1; i < n; i += 1) if (travaDoPasso(i)) return false;
      return true;
    },
    [passo, maxVisto, travaDoPasso],
  );

  function avancar() {
    if (motivoTravado) {
      toast.error(motivoTravado);
      return;
    }
    setPasso(Math.min(ULTIMO_PASSO, passo + 1));
  }

  function irPasso(n: number) {
    if (!podeIrAoPasso(n)) return;
    setPasso(n);
  }

  // ---- rascunho: retomar, descartar e guardar ----

  /**
   * O aviso de retomar só aparece enquanto a pessoa não começou nada NESTA
   * visita, senão ele ficaria pendurado por cima de um formulário já em uso. E
   * some de vez quando ela chegou com um pedido explícito ("Editar esse vídeo"
   * ou "Reutilizar"): aí ela veio fazer outra coisa, não retomar.
   */
  const mostrarRetomar =
    !!rascunho &&
    !rascunhoDispensado &&
    !videoInicial &&
    !configInicial &&
    !modo &&
    clips.length === 0 &&
    textos.length === 0;

  function retomarRascunho() {
    if (!rascunho) return;
    setModo(rascunho.modo);
    setFalaPor(rascunho.falaPor);
    setRoteiroFala(rascunho.roteiroFala);
    setEhProduto(rascunho.ehProduto);
    setNome(rascunho.nome);
    setDescricao(rascunho.descricao);
    setPreco(rascunho.preco);
    setFormato(rascunho.formato);
    setTom(rascunho.tom);
    setPlataforma(rascunho.plataforma);
    setVoz(rascunho.voz);
    setLegendaPos(rascunho.legendaPos);
    if (rascunho.legendaEstilo) setLegendaEstilo(rascunho.legendaEstilo);
    setTextos(rascunho.textos);
    setMusicaAuto(rascunho.musicaAuto);
    setMusicaEscolhida(rascunho.musicaEscolhida);
    setVolumeMusica(rascunho.volumeMusica);
    setVelocidadeMusica(rascunho.velocidadeMusica);
    setCortarSilencio(rascunho.cortarSilencio);
    setAudioVideo(rascunho.audioVideo);
    setVolumeOriginal(rascunho.volumeOriginal);
    setVolumeVoz(rascunho.volumeVoz);
    setEdicao(rascunho.edicao);
    fichasPendentes.current = rascunho.cenas;
    // as mídias não voltam sozinhas (ver `FichaCena`), então parar depois das
    // Mídias jogaria a pessoa numa aprovação de cenas que ainda não existem. O
    // `maxVisto` volta cheio: as etapas da frente reabrem sozinhas assim que os
    // arquivos estiverem de volta, porque a trilha confere etapa por etapa.
    setPasso(Math.min(rascunho.passo, 3));
    setMaxVisto(rascunho.maxVisto);
    setRascunhoDispensado(true);
    toast.success(
      rascunho.cenas.length
        ? `Voltamos de onde você parou. Escolha as mídias de novo (${rascunho.cenas.length}): os cortes e as descrições delas já estão guardados. 🎬`
        : "Pronto, voltamos de onde você parou. 🎬",
    );
  }

  function descartarRascunho() {
    setRascunhoDispensado(true);
    apagarRascunho();
  }

  /**
   * Guarda o rascunho a cada mudança. Só grava quando existe progresso de
   * verdade: sem essa guarda, a tela recém-aberta (tudo vazio) apagaria o que
   * estava salvo ANTES de a pessoa ver o aviso de retomar.
   */
  useEffect(() => {
    if (enviando) return;
    // enquanto o aviso de retomar está na tela, o que está guardado é justamente
    // o que ele oferece: gravar por cima agora apagaria a montagem antiga antes
    // de a pessoa decidir (dá pra chegar aqui só digitando o nome do produto).
    if (mostrarRetomar) return;
    const temProgresso =
      !!modo || clips.length > 0 || textos.length > 0 || nome.trim().length > 0;
    if (!temProgresso) return;
    const r: Rascunho = {
      v: 1,
      em: Date.now(),
      passo,
      maxVisto,
      modo,
      falaPor,
      roteiroFala,
      ehProduto,
      nome,
      descricao,
      preco,
      formato,
      tom,
      plataforma,
      voz,
      legendaPos,
      legendaEstilo,
      textos,
      musicaAuto,
      musicaEscolhida,
      volumeMusica,
      velocidadeMusica,
      cortarSilencio,
      audioVideo,
      volumeOriginal,
      volumeVoz,
      edicao,
      cenas: clips.map((c) => ({
        nome: c.file.name,
        tam: c.file.size,
        inSec: c.inSec,
        outSec: c.outSec,
        entra: c.entra,
        trecho: c.trecho,
        dura: c.dura,
        descricao: c.descricao,
        ...(c.descricaoIA ? { descricaoIA: true as const } : {}),
      })),
    };
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
    } catch {
      /* cota cheia ou modo privado: seguir sem guardar */
    }
  }, [
    enviando,
    mostrarRetomar,
    passo,
    maxVisto,
    modo,
    falaPor,
    roteiroFala,
    ehProduto,
    nome,
    descricao,
    preco,
    formato,
    tom,
    plataforma,
    voz,
    legendaPos,
    legendaEstilo,
    textos,
    musicaAuto,
    musicaEscolhida,
    volumeMusica,
    velocidadeMusica,
    cortarSilencio,
    audioVideo,
    volumeOriginal,
    volumeVoz,
    edicao,
    clips,
  ]);

  // ---- enviar ----
  async function gerar() {
    if (bloqueado) {
      toast.info("Conta de demonstração não gera vídeos. 🙂");
      return;
    }
    if (clips.length === 0)
      return toast.error("Adicione pelo menos um clipe ou imagem.");
    // o maxLength da caixa já segura a digitação; esta guarda pega texto colado
    // ou restaurado de rascunho que passe do teto (tarefa 31)
    if (modo === "narracao" && falaPor === "eu" && roteiroFala.trim().length > MAX_ROTEIRO_FALA)
      return toast.error(
        `O roteiro da narração não pode passar de ${MAX_ROTEIRO_FALA} caracteres.`,
      );
    if (ehProduto && nome.trim().length < 2)
      return toast.error("Dê um nome ao produto (ou desative 'É um produto?').");
    if (modoPrincipal && formato === "voz")
      return toast.error(
        "Com clipe principal a narração é a fala do vídeo. Escolha Transcrever fala ou Nenhum.",
      );
    if (passouDoTeto)
      return toast.error(
        `O editor faz vídeo de até ${MAX_VIDEO_SEG / 60} minutos. Corte alguns clipes (agora está em ${fmt(totalDur)}).`,
      );
    if (apoioLongo)
      return toast.error(
        `Tem cena de apoio com mais de ${MAX_APOIO_SEG / 60} minuto. Corte ela com as alças verdes, embaixo da prévia.`,
      );
    // as mídias sobem desde a etapa 3, mas quem chega correndo no fim pode
    // alcançar o upload. Aqui é o único ponto que precisa esperar de verdade.
    if (enviosPendentes.length)
      return toast.error(
        envioFalhou
          ? "O envio de alguma mídia falhou. Volte pras mídias e toque em Enviar de novo."
          : `Ainda estou enviando ${enviosPendentes.length === 1 ? "uma mídia" : `${enviosPendentes.length} mídias`}. Só um instante e o botão libera.`,
      );
    const titulo = ehProduto
      ? nome.trim()
      : textos.find((t) => t.conteudo.trim())?.conteudo.trim().slice(0, 60) ||
        "Vídeo livre";

    setEnviando(true);
    try {
      // ===== O QUE FALTOU, A IA FAZ DEPOIS, EM SEGUNDO PLANO (dono, 11/08/2026) =====
      // Descrever as cenas em branco e encaixá-las na fala continuam
      // acontecendo neste clique, mas NÃO mais com a pessoa parada olhando uma
      // tela de espera: o job é criado primeiro (as mídias já subiram na etapa
      // 3), ela vai pra Meus vídeos e vê o card gerando enquanto o navegador
      // termina o serviço e solta o vídeo pra fila.
      const finais = clips;

      const fd = new FormData();
      fd.set("produto", titulo);
      fd.set("ehProduto", ehProduto ? "1" : "0");
      // o formato vai SEMPRE: na narração sem produto é ele que diz que existe
      // voz de IA (antes ele só era mandado com "é um produto?" ligado)
      fd.set("formato", formato);
      if (ehProduto) {
        fd.set("descricao", descricao.trim());
        fd.set("preco", preco.trim());
        fd.set("tom", tom);
        fd.set("plataforma", plataforma);
      }
      if (formato === "voz") {
        fd.set("vozId", voz);
        // roteiro escrito pela pessoa: a IA não inventa o texto, só narra
        if (falaPor === "eu" && roteiroFala.trim()) {
          fd.set("roteiroFala", roteiroFala.trim());
        }
      }
      fd.set("variantes", "1");
      fd.set("audioVideo", audioVideo);
      fd.set("comMusica", comMusica ? "1" : "0");
      // trilha ESCOLHIDA da biblioteca (etapa 4). Só sem arquivo próprio: o
      // arquivo da pessoa sempre manda. Vazio = a IA sorteia, como sempre foi.
      if (musicaAuto && musica.length === 0 && musicaEscolhida) {
        fd.set("musicaNome", musicaEscolhida);
      }
      fd.set("volumeMusica", String(volumeMusica));
      fd.set("velocidadeMusica", String(velocidadeMusica));
      fd.set("cortarSilencio", String(cortarSilencio));
      fd.set("edicao", JSON.stringify(edicao));
      // volumes da mixagem: o render usa exatamente estes números
      fd.set(
        "volumes",
        JSON.stringify({
          original: volumeOriginal,
          musica: volumeMusica,
          voz: volumeVoz,
        }),
      );

      // textos (camada de legendas com posição + tempo)
      const textosLimpos = textos
        .filter((t) => t.conteudo.trim())
        .map((t) => ({
          texto: t.conteudo.trim(),
          pos: t.pos,
          in: Number(t.inSec.toFixed(2)),
          out: Number(t.outSec.toFixed(2)),
        }));
      fd.set("textos", JSON.stringify(textosLimpos));
      // Onde a legenda queimada fica. Antes isto copiava a posição do PRIMEIRO
      // texto escrito à mão, o que amarrava duas coisas independentes: sem texto
      // nenhum a legenda caía em "baixo" de qualquer jeito, e mexer num texto
      // arrastava a legenda junto. Agora é a escolha própria da pessoa.
      fd.set("legendaPos", legendaPos);
      // Como a legenda da fala aparece (palavra por palavra ou frase completa).
      // Só vale onde a legenda SAI da fala: no formato "legenda" a IA já entrega
      // as frases prontas e não há tempo de palavra pra sincronizar.
      if (legendaDaFala) fd.set("legendaEstilo", legendaEstilo);
      // compat com o worker atual (uma legenda só, em texto)
      if (textosLimpos[0]) fd.set("legenda", textosLimpos[0].texto);

      // roteiro: ordem, cortes, quem é o principal, quando cada apoio entra e de
      // que pedaço do arquivo ele sai
      fd.set("roteiro", JSON.stringify(roteiroDe(finais)));

      // NENHUM arquivo de vídeo sobe aqui (dono, 11/08/2026): a essa altura toda
      // mídia já está no servidor, e o que viaja é só o NOME dela. São duas
      // origens possíveis, e podem se misturar na mesma montagem:
      //  - `reusarEntradaDe`: veio da entrada de um job anterior (tarefa 21);
      //  - `rascunhoDe`: subiu na etapa 3, enquanto a pessoa montava o vídeo.
      // O servidor copia das duas pastas, disco a disco.
      const doServidor = midiasServidorRef.current;
      const reusarNomes: string[] = [];
      const rascunhoNomes: string[] = [];
      finais.forEach((c) => {
        if (doServidor.jobId && doServidor.files.has(c.file)) reusarNomes.push(c.file.name);
        else rascunhoNomes.push(c.file.name);
      });
      if (doServidor.jobId && reusarNomes.length) {
        fd.set("reusarEntradaDe", doServidor.jobId);
        fd.set("reusarArquivos", JSON.stringify(reusarNomes));
      }
      if (rascunhoRef.current.id && rascunhoNomes.length) {
        fd.set("rascunhoDe", rascunhoRef.current.id);
        fd.set("rascunhoArquivos", JSON.stringify(rascunhoNomes));
      }
      if (comMusica) musica.forEach((f) => fd.append("musica", f));

      // ainda falta a IA? então o job nasce em "preparando" e alguém precisa
      // soltá-lo pra fila depois: é o que a `terminarComIA` faz lá embaixo
      const faltaIA = cenasAutoDescritas.length > 0 || precisaPosicionar;
      if (faltaIA) fd.set("aguardarIA", "1");

      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { erro?: string; id?: string };
      if (!res.ok || !data.id) {
        toast.error(data.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      // entregou: o rascunho não serve mais pra nada, e deixar ele vivo faria a
      // próxima visita oferecer de volta uma montagem que já virou vídeo
      apagarRascunho();
      toast.success(
        faltaIA
          ? "Vídeo enviado! A IA está encaixando as cenas e ele entra na fila sozinho. 🎬"
          : "Vídeo enviado pra fila! 🎬",
      );
      router.push("/painel");
      router.refresh();
      // A tela sai de cima AGORA e o resto continua rodando aqui atrás. Isso
      // funciona porque a navegação do Next não recarrega a página: o
      // componente some, mas a promessa segue viva com os arquivos na memória.
      if (faltaIA) void terminarComIA(data.id, finais);
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setEnviando(false);
      // rede de segurança: se a leitura dos quadros ou do áudio estourar no meio,
      // a tela não pode ficar com o overlay de "analisando" preso pra sempre
      setAnalisando(false);
      setPosicionando(false);
    }
  }

  const estimativa =
    formato === "nenhum"
      ? `${CREDITOS_FIXO.editorManual} créditos`
      : `no máximo ${estimarCreditos(formato === "voz" ? "voz" : "legenda", totalDur).toLocaleString("pt-BR")} créditos`;

  /**
   * A CAIXA DO PLAYER (o vídeo 9:16 com o apoio por cima, os textos e o play).
   *
   * Virou variável porque ela mora em DOIS lugares (11/08/2026, v2 do painel):
   * na coluna da direita nas etapas 1-4 e ACIMA DA TIMELINE na aprovação. Só um
   * dos dois é desenhado por vez, então o `videoRef` sempre aponta pro certo -
   * e o efeito de `previewNaTimeline` conserta o tempo quando o elemento troca.
   */
  const palcoBox = (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-black">
      {palco ? (
        palco.kind === "video" ? (
          <video
            ref={videoRef}
            src={palco.url}
            playsInline
            muted={mudo}
            onTimeUpdate={onTimeUpdate}
            onClick={togglePlay}
            className="size-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={palco.url}
            alt=""
            onClick={togglePlay}
            className="size-full object-contain"
          />
        )
      ) : (
        <div className="grid size-full place-items-center p-6 text-center text-sm text-muted-foreground">
          <span>
            <Film className="mx-auto mb-2 size-8 opacity-60" />
            A prévia aparece aqui
            <br />
            assim que você subir as mídias
          </span>
        </div>
      )}

      {/* apoio por cima do principal: tela cheia, e sai sozinho.
          A key força remontar a cada troca, pra o clipe começar do início.
          O vídeo de apoio é o `ApoioOverlay`, que SEGUE A AGULHA: esfregar a
          régua arrasta o quadro dele junto, e o play do meio da cena parte do
          ponto certo do pedaço (não do começo). */}
      {apoioNaTela &&
        marcaAtiva &&
        (apoioNaTela.kind === "video" ? (
          <ApoioOverlay
            key={apoioNaTela.id}
            cena={apoioNaTela}
            marca={marcaAtiva}
            tGlobal={tGlobal}
            tocando={tocando}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={apoioNaTela.id}
            src={apoioNaTela.url}
            alt=""
            className={cn(
              "absolute inset-0 size-full bg-black object-contain",
              edicao.kenBurns && tocando && "animate-[kenburns_3s_ease-out_forwards]",
            )}
          />
        ))}

      {/* textos ao vivo (por posição) */}
      {palco &&
        (["cima", "meio", "baixo"] as Posicao[]).map((pos) => {
          const ts = textosAtivos.filter((t) => t.pos === pos);
          if (!ts.length) return null;
          return (
            <div
              key={pos}
              className={cn(
                "pointer-events-none absolute inset-x-3 flex flex-col items-center gap-1",
                pos === "cima" && "top-6",
                pos === "meio" && "top-1/2 -translate-y-1/2",
                pos === "baixo" && "bottom-10",
              )}
            >
              {ts.map((t) => (
                <span
                  key={t.id}
                  className="rounded bg-black/50 px-2 py-1 text-center text-base font-extrabold uppercase leading-tight text-white [text-shadow:_0_2px_8px_rgba(0,0,0,0.9)]"
                >
                  {t.conteudo}
                </span>
              ))}
            </div>
          );
        })}

      {palco && !tocando && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center"
          aria-label="Tocar"
        >
          <span className="grid size-14 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
            <Play className="size-7 fill-white text-white" />
          </span>
        </button>
      )}
      <style>{`@keyframes kenburns {
        from { transform: scale(1); }
        to { transform: scale(1.12); }
      }`}</style>
    </div>
  );

  /**
   * O palco MAIS o tocar e as alças verdes de cortar o clipe.
   *
   * Viraram um bloco só (dono, 12/08/2026) porque são a MESMA ferramenta: a
   * alça se arrasta olhando o quadro mudar. Quando a prévia passou a ser
   * recolhível no celular, o corte precisou viajar junto - deixar ele pra trás
   * seria tirar do celular o único jeito de cortar um clipe, e a etapa 5 manda
   * cortar quando uma cena de apoio passa de 1 minuto.
   */
  const palcoComCorte = (
    <div className="space-y-4">
      {palcoBox}

      {/* controles + trim do clipe */}
      {atual && (
        <div className="mx-auto w-full max-w-[340px] space-y-2">
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="secondary" onClick={togglePlay}>
              {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {fmt(tGlobal)} / {fmt(totalDur)}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Scissors className="size-3.5" />
              clipe {fmt(atual.outSec - atual.inSec)}
            </span>
          </div>

          <TrilhaCorte
            dur={atual.dur}
            inSec={atual.inSec}
            outSec={atual.outSec}
            tempo={tempo}
            onChange={setTrim}
            onScrub={(t) => {
              setTempo(t);
              if (atual.kind === "video" && videoRef.current)
                videoRef.current.currentTime = t;
            }}
          />
          <p className="text-center text-[11px] text-muted-foreground">
            Arraste as alças <span className="text-primary">verdes</span> pra
            cortar o clipe.
          </p>
        </div>
      )}
    </div>
  );

  return (
    // formulário à ESQUERDA e prévia à DIREITA, parada: a pessoa mexe num campo e
    // vê o efeito sem rolar a tela atrás do player. Na APROVAÇÃO com o painel de
    // editor a prévia sobe pra cima da timeline e a coluna da direita some.
    <div
      className={cn(
        "grid gap-5",
        !previewNaTimeline && "lg:grid-cols-[minmax(0,1fr)_360px]",
      )}
    >
      <audio
        ref={audioRef}
        src={musicaUrl || undefined}
        onPlay={() => setPreviaMusica(true)}
        onPause={() => setPreviaMusica(false)}
        className="hidden"
      />

      {/* ANÁLISE EM ANDAMENTO: overlay que segura a pessoa na tela. Não tem X
          nem clique-fora de propósito: a análise já foi pedida (e vai ser
          cobrada), então sair no meio só deixaria o resultado órfão. Some
          sozinho quando a IA termina. z-50 = mesmo andar das telas cheias. */}
      {ocupadoAnalise && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-border bg-card/90 p-6 text-center shadow-2xl">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              {posicionando
                ? "Ouvindo a fala do seu vídeo e encaixando cada cena..."
                : "Analisando suas mídias e gerando descrições com IA..."}
            </p>
            <p className="text-xs text-muted-foreground">
              {posicionando
                ? "Aguarde um instante: a IA está lendo o áudio inteiro pra achar o momento de cada cena."
                : "Aguarde um instante: costuma levar poucos segundos por cena."}
            </p>
          </div>
        </div>
      )}

      {/* ===== PASSOS =====
          `min-w-0` NÃO é enfeite (dono, 11/08/2026): item de grid nasce com
          `min-width: auto`, ou seja, ele se recusa a ficar menor que o conteúdo
          mais largo lá dentro. Sem isso, UMA miniatura, um nome de arquivo ou um
          campo teimoso empurra a coluna inteira e o CELULAR ganha rolagem pro
          lado - a tela "fica grande demais pelas laterais". Com o zero, o que
          não couber se vira por dentro (truncar, quebrar, rolar sozinho). */}
      <div className="min-w-0 space-y-5">
        {bloqueado && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-amber-500">Demo:</span> você
              edita e pré-visualiza à vontade; gerar fica na conta completa.
            </p>
          </div>
        )}

        {/* Retomar é uma ESCOLHA, não acontece sozinho. Preencher a tela sem
            pedir traria de volta montagem que a pessoa pode ter largado de
            propósito, e ler o navegador durante a renderização quebraria a
            hidratação (por isso o `useSyncExternalStore` lá em cima). Mesmo
            desenho do rascunho do Viral Boost. */}
        {mostrarRetomar && (
          <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Você tinha um vídeo em andamento</p>
                <p className="text-[11px] text-muted-foreground">
                  {rascunho?.cenas.length
                    ? `Seus ajustes e as descrições de ${rascunho.cenas.length} cena(s) ainda estão aqui. As mídias você escolhe de novo.`
                    : "Seus ajustes ainda estão aqui, do jeito que você deixou."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" onClick={retomarRascunho}>
                Retomar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={descartarRascunho}
              >
                Começar do zero
              </Button>
            </div>
          </div>
        )}

        <Trilha
          passo={passo}
          onIr={irPasso}
          resolvido={passoResolvido}
          liberado={podeIrAoPasso}
        />

        {/* ---------- ETAPA 1: ponto de partida ---------- */}
        {passo === 1 && (
          <Secao icon={Compass} titulo="De onde parte o seu vídeo?">
            <div className="grid gap-3 sm:grid-cols-2">
              <CartaoModo
                ativo={modo === "base"}
                onClick={() => escolherModo("base")}
                Icone={VideoIcon}
                titulo="Vídeo com fala"
                descricao="Você já tem um vídeo com alguém falando na câmera, seja você ou outra pessoa. Ele roda por baixo do começo ao fim, com o som dele, e as outras mídias entram por cima mostrando o produto."
              />
              <CartaoModo
                ativo={modo === "narracao"}
                onClick={() => escolherModo("narracao")}
                Icone={Mic}
                titulo="Voz de IA narrando"
                descricao="Não tem ninguém falando em vídeo. Suas fotos e vídeos tocam em sequência e uma voz de IA narra por cima, no ritmo das cenas."
              />
            </div>

            {modo === "narracao" && (
              <div className="space-y-3 rounded-xl border border-border bg-card p-3">
                <div>
                  <Label className="text-xs">Quem escreve a fala</Label>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <BotaoOpcao
                      ativo={falaPor === "ia"}
                      onClick={() => escolherFalaPor("ia")}
                      icon={Sparkles}
                      label="A IA escreve"
                    />
                    <BotaoOpcao
                      ativo={falaPor === "eu"}
                      onClick={() => escolherFalaPor("eu")}
                      icon={PenLine}
                      label="Eu escrevo"
                    />
                  </div>
                </div>
                {falaPor === "eu" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Texto que a voz vai falar</Label>
                    <Textarea
                      rows={5}
                      maxLength={MAX_ROTEIRO_FALA}
                      placeholder="Escreva do jeito que quer ouvir. A voz lê exatamente isto, sem mudar nada."
                      value={roteiroFala}
                      onChange={(e) => setRoteiroFala(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {roteiroFala.length}/{MAX_ROTEIRO_FALA} caracteres. O limite de{" "}
                      {MAX_ROTEIRO_FALA} (cerca de 33 segundos de fala) garante um ritmo
                      dinâmico na narração.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Na próxima etapa você conta o que é o produto, e a IA escreve a fala a
                    partir disso e das cenas que você subir.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Voz da narração</Label>
                  <SeletorVoz vozes={vozes} value={voz} onChange={setVoz} />
                  <p className="text-[11px] text-muted-foreground">
                    Toque no play pra ouvir uma prévia antes de gerar.
                  </p>
                </div>
              </div>
            )}
          </Secao>
        )}

        {/* ---------- ETAPA 2: produto ---------- */}
        {passo === 2 && (
          <>
          <Secao
            icon={Package}
            titulo="É um produto?"
            acao={
              <div className="flex gap-1 rounded-lg border border-border p-1">
                <button
                  type="button"
                  onClick={() => mudarProduto(false)}
                  disabled={produtoObrigatorio}
                  title={
                    produtoObrigatorio
                      ? "Com 'A IA escreve' o produto é obrigatório: é dele que a IA tira o assunto da fala. Volte na etapa 1 e escolha 'Eu escrevo' se não for um produto."
                      : undefined
                  }
                  className={cn(
                    "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    !ehProduto
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                    produtoObrigatorio && "cursor-not-allowed opacity-40",
                  )}
                >
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => mudarProduto(true)}
                  className={cn(
                    "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                    ehProduto
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Sim
                </button>
              </div>
            }
          >
            {ehProduto ? (
              <>
                <Input
                  placeholder="Nome do produto"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
                {(usaCopy || (modo === "narracao" && falaPor === "ia")) && (
                  <Textarea
                    rows={3}
                    placeholder="Descrição (a IA escreve a copy a partir disso)"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                )}
                <Input
                  inputMode="decimal"
                  placeholder="Preço (ex: 69,90)"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  className="max-w-40"
                />
                {modo === "base" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Formato</Label>
                    <Segmented
                      // no "Vídeo com fala" só transcrever/nenhum: a narração já
                      // está gravada no vídeo (ver FORMATOS_MODO_BASE)
                      options={FORMATOS_MODO_BASE}
                      value={formato === "transcrever" ? "transcrever" : "nenhum"}
                      onChange={mudarFormatoLegenda}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {FORMATO_NOTA[formato === "transcrever" ? "transcrever" : "nenhum"]}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <b className="text-foreground">Voz narrada</b> e{" "}
                      <b className="text-foreground">legenda escrita pela IA</b> ficam de
                      fora aqui: a fala do seu vídeo já é a narração.
                    </p>
                  </div>
                )}
                {/* Tom e "Onde vai vender" parametrizam a COPY que a IA escreve.
                    No modo "Vídeo com fala" a IA não escreve copy nenhuma (só
                    transcreve ou nada), então mostrar os dois ali era pedir
                    configuração pra um texto que nunca ia existir (06/08/2026). */}
                {modo === "narracao" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tom</Label>
                      <Segmented options={TONS} value={tom} onChange={setTom} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Onde vai vender</Label>
                      <Segmented
                        options={PLATAFORMAS}
                        value={plataforma}
                        onChange={setPlataforma}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {plataforma === "shopee"
                          ? "A copy usa o CTA e as hashtags da Shopee (sacolinha laranja, #AchadinhosShopee)."
                          : "A copy usa um CTA neutro (corre no link) e hashtags do nicho - sem citar a Shopee."}
                      </p>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Ative se for divulgar um produto - a IA escreve a copy e as hashtags pra
                  você. Pra um corte, um meme ou um vídeo informativo, deixe no{" "}
                  <b className="text-foreground">Não</b> e siga em frente.
                </p>
                {modo === "narracao" ? (
                  // sem produto a IA não tem do que falar, então o texto da
                  // narração é sempre o que a pessoa escreveu na etapa 1
                  <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                    A voz de IA vai ler{" "}
                    <b className="text-foreground">o texto que você escreveu</b> na etapa
                    anterior. Sem produto não há copy pra IA inventar, então nada mais é
                    escrito por ela.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Quer a fala do vídeo escrita na tela?
                    </Label>
                    <Segmented
                      options={FORMATOS_SEM_PRODUTO}
                      value={formato === "transcrever" ? "transcrever" : "nenhum"}
                      onChange={mudarFormatoLegenda}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {FORMATO_NOTA[formato === "transcrever" ? "transcrever" : "nenhum"]}
                    </p>
                  </div>
                )}
              </>
            )}
          </Secao>

          {/* Ligou a legenda, decide AQUI mesmo como ela aparece (dono,
              06/08/2026). Antes essas escolhas moravam três etapas à frente,
              longe da pergunta que as liga: quem respondia "sim, legendar" não
              via mais nada sobre legenda até as Mídias. O bloco some inteiro no
              "Não, sem legenda" (não há legenda pra posicionar). */}
          {temLegenda && (
            <Secao icon={Captions} titulo="Como a legenda aparece">
              <div className="space-y-1.5">
                <Label className="text-xs">Onde aparece na tela</Label>
                <Segmented
                  options={POSICOES}
                  value={legendaPos}
                  onChange={(v) => setLegendaPos(v as Posicao)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {formato === "transcrever"
                    ? "Vale pra legenda da fala do seu vídeo."
                    : formato === "voz"
                      ? "Vale pra legenda que acompanha a narração da IA."
                      : "Vale pra legenda que a IA escreve e queima no vídeo."}{" "}
                  Um texto seu nesta mesma faixa entra ao lado dela, nunca por cima.
                </p>
              </div>

              {legendaDaFala && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Estilo da legenda</Label>
                  <Segmented
                    options={ESTILOS_LEGENDA}
                    value={legendaEstilo}
                    onChange={(v) => setLegendaEstilo(v as LegendaEstilo)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {ESTILO_LEGENDA_NOTA[legendaEstilo]}
                  </p>
                </div>
              )}
            </Secao>
          )}
          </>
        )}

        {/* ---------- ETAPA 3: mídias ---------- */}
        {passo === 3 && (
          <>
            {modo === "base" && (
              <Secao
                icon={Star}
                titulo={`Vídeo com fala (${principais.length})`}
                acao={<AddMidia onPick={(l) => addArquivos(l, true)} label="Adicionar" />}
              >
                {principais.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Suba aqui o vídeo com a pessoa falando. Ele é a base: o som dele
                    corre do começo ao fim.
                  </p>
                ) : (
                  <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                    O vídeo vai durar <b className="text-foreground">{fmt(durBase)}</b>
                    {principais.length > 1 &&
                      " (os principais tocam em sequência, na ordem da lista)"}{" "}
                    e cabem{" "}
                    <b className="text-foreground">
                      {cabemApoios} {cabemApoios === 1 ? "cena" : "cenas"} de apoio
                    </b>{" "}
                    (1 a cada {SEG_POR_APOIO}s).
                  </p>
                )}
                {/* ENVIO EM TEMPO REAL (dono, 11/08/2026). As mídias sobem já
                    aqui, e não no clique final: a espera acontece enquanto a
                    pessoa monta o vídeo, e ela pode seguir pras próximas etapas
                    normalmente enquanto isso. Só o Aprovar e gerar espera. */}
                {clips.length > 0 && !bloqueado && (enviosPendentes.length > 0 || envioFalhou) && (
                  <div
                    className={cn(
                      "space-y-1.5 rounded-xl border p-3",
                      envioFalhou
                        ? "border-destructive/40 bg-destructive/10"
                        : "border-primary/30 bg-primary/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium">
                        {envioFalhou
                          ? "Alguma mídia não subiu."
                          : `Enviando suas mídias pro servidor... ${pctEnvio}%`}
                      </span>
                      {envioFalhou ? (
                        <button
                          type="button"
                          onClick={reenviarFalhas}
                          className="shrink-0 font-semibold text-primary underline underline-offset-2"
                        >
                          Enviar de novo
                        </button>
                      ) : (
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {clips.length - enviosPendentes.length}/{clips.length}
                        </span>
                      )}
                    </div>
                    {!envioFalhou && (
                      <>
                        <div className="h-1.5 overflow-hidden rounded-full bg-primary/15">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300"
                            style={{ width: `${pctEnvio}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Pode continuar montando: isso acontece por baixo. Assim, na
                          hora de gerar não sobra espera nenhuma.
                        </p>
                      </>
                    )}
                  </div>
                )}
                <ListaClipes
                  clips={principais}
                  todos={clips}
                  sel={sel}
                  modoPrincipal={modoPrincipal}
                  principais={principais}
                  apoios={apoios}
                  cabemApoios={cabemApoios}
                  marcasApoio={marcasApoio}
                  pendentes={idsPendentes}
                  descreviveis={idsDescreviveis}
                  analisandoCena={analisandoCena}
                  ocupadoAnalise={ocupadoAnalise}
                  destacado={destacado}
                  refs={refsCena}
                  onSelecionar={(i) => {
                    setTocando(false);
                    pararTimer();
                    irPara(i, false);
                  }}
                  onAlternarPrincipal={alternarPrincipal}
                  onMover={mover}
                  onRemover={removerClip}
                  onDescricao={setDescricaoClip}
                  onDescreverIA={analisarCena}
                />
                {/* POR QUE descrever o principal. O campo em si já é o da lista
                    acima: a transcrição conta o que a pessoa FALA, e só esta
                    frase conta o que está na TELA enquanto ela fala. É opcional,
                    de graça, e a IA nunca preenche (ela só olha os apoios). */}
                {principais.length > 0 && (
                  <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                    Vale escrever no campo de cada vídeo acima{" "}
                    <b className="text-foreground">o que aparece nele</b> (ex: ela
                    segurando o tênis e depois mostrando a etiqueta). A fala a IA já
                    escuta; o que ela não tem jeito de saber é o que está na imagem.
                    Com isso, as cenas de apoio entram no momento em que você fala
                    daquilo, e a copy comenta o que está na tela. É opcional e de graça.
                  </p>
                )}
              </Secao>
            )}

            <Secao
              icon={Layers}
              titulo={
                modo === "base"
                  ? `Cenas de apoio (${apoios.length})`
                  : `Suas mídias (${clips.length})`
              }
              acao={<AddMidia onPick={(l) => addArquivos(l)} label="Adicionar" />}
            >
              <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                {modo === "base" ? (
                  <>
                    Fotos e vídeos do produto. Eles entram <b className="text-foreground">por cima</b>{" "}
                    de você, em tela cheia, e a tela volta pra você depois. Descreva o que
                    tem em cada um (ou deixe a IA descrever, aqui embaixo): é assim que ela
                    sabe em que momento da fala encaixar cada cena. O segundo em que cada
                    uma entra você vê e ajusta na última etapa,{" "}
                    <b className="text-foreground">Aprovar cenas</b>.
                  </>
                ) : (
                  <>
                    Fotos e vídeos que vão tocar <b className="text-foreground">em sequência</b>,
                    na ordem da lista, com a voz narrando por cima. Use as setinhas pra
                    trocar a ordem.
                  </>
                )}
              </p>
              <ListaClipes
                clips={modo === "base" ? apoios : clips}
                todos={clips}
                sel={sel}
                modoPrincipal={modoPrincipal}
                principais={principais}
                apoios={apoios}
                cabemApoios={cabemApoios}
                marcasApoio={marcasApoio}
                escondeEstrela={modo === "narracao"}
                pendentes={idsPendentes}
                descreviveis={idsDescreviveis}
                analisandoCena={analisandoCena}
                ocupadoAnalise={ocupadoAnalise}
                destacado={destacado}
                refs={refsCena}
                onSelecionar={(i) => {
                  setTocando(false);
                  pararTimer();
                  irPara(i, false);
                }}
                onAlternarPrincipal={alternarPrincipal}
                onMover={mover}
                onRemover={removerClip}
                onDescricao={setDescricaoClip}
                onDescreverIA={analisarCena}
              />

              {/* DESCREVER COM IA. Mora aqui, embaixo das mídias (06/08/2026),
                  e não mais na etapa de aprovação: o campo de descrição de cada
                  cena sempre esteve nesta lista, então o botão que preenche
                  esses campos estar três etapas adiante fazia a pessoa escrever
                  na mão sem saber que a IA faria por ela. */}
              {clips.length > 0 &&
                (cenasAnalisaveis.length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs">
                      <b>
                        {cenasAnalisaveis.length}{" "}
                        {cenasAnalisaveis.length === 1 ? "cena está" : "cenas estão"} sem
                        descrição.
                      </b>{" "}
                      A IA pode olhar {cenasAnalisaveis.length === 1 ? "ela" : "elas"} e
                      escrever o que {cenasAnalisaveis.length === 1 ? "mostra" : "mostram"}
                      {modoPrincipal && edicao.trechoInteligente
                        ? ", além de apontar o melhor pedaço de cada uma"
                        : ""}
                      .
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={ocupadoAnalise || bloqueado}
                      onClick={analisarCenas}
                    >
                      {analisando ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Wand2 className="size-4" />
                      )}
                      {analisando
                        ? "Olhando as cenas..."
                        : `Descrever com IA (${custoAnalise} ${custoAnalise === 1 ? "crédito" : "créditos"})`}
                    </Button>
                    <p className="text-[10px] text-muted-foreground">
                      {CREDITOS_FIXO.analiseCena} crédito por cena. Escrever você mesmo é de
                      graça, e o que você escreve sempre manda na frente da IA.{" "}
                      {modo === "base"
                        ? "O que ficar em branco a IA descreve sozinha na hora de gerar, pelo mesmo preço: clicar aqui só serve pra você ler e ajustar antes."
                        : "Dá pra gerar sem descrever: aí a IA escreve a copy sem saber o que aparece nas cenas."}
                    </p>
                  </div>
                ) : (
                  <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    {clips.some((c) => c.descricao.trim())
                      ? `Todas as cenas estão descritas${descritasPelaIA ? ` (${descritasPelaIA} pela IA)` : ""}. Confira e ajuste o que quiser.`
                      : "Nada a descrever nesta montagem."}
                  </p>
                ))}
            </Secao>

            <Secao
              icon={Type}
              titulo={`Textos na tela (${textos.length})`}
              acao={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addTexto}
                  disabled={clips.length === 0}
                >
                  <Plus className="size-4" />
                  Texto
                </Button>
              }
            >
              {textos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  {clips.length === 0
                    ? "Adicione mídias primeiro."
                    : "Opcional: escreva um texto e escolha em que momento e posição ele aparece."}
                </p>
              ) : (
                textos.map((t) => (
                  <TextoBloco
                    key={t.id}
                    texto={t}
                    posicoes={posicoesDoTexto}
                    totalDur={totalDur}
                    tGlobal={tGlobal}
                    onUpd={(patch) => updTexto(t.id, patch)}
                    onTempo={(qual, v) => setTextoTempo(t.id, qual, v)}
                    onRemover={() => removerTexto(t.id)}
                  />
                ))
              )}
            </Secao>
          </>
        )}

        {/* ---------- ETAPA 4: ajustes e áudio ---------- */}
        {passo === 4 && (
          <>
            {modoPrincipal && (
              <Secao icon={Scissors} titulo="Cortar partes sem fala">
                <div className="grid grid-cols-5 gap-1.5">
                  {SILENCIOS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCortarSilencio(s)}
                      className={cn(
                        "rounded-md border px-1 py-1.5 text-xs font-medium tabular-nums transition-colors",
                        s === cortarSilencio
                          ? "border-primary bg-primary/12 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {s === 0 ? "Não" : `${s.toLocaleString("pt-BR")}s`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {cortarSilencio === 0
                    ? "Sem corte: a base sai do jeito que você gravou."
                    : `Todo trecho calado por mais de ${cortarSilencio.toLocaleString("pt-BR")}s sai fora, imagem e som juntos, com uma folga pra não engolir a respiração. O vídeo fica mais curto, então pode caber menos cena de apoio. O corte acontece no render: a prévia aqui toca o clipe inteiro.`}
                </p>
              </Secao>
            )}

            <Secao icon={Volume2} titulo="Áudio">
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Som original do vídeo
                </p>
                {/* No modo "Vídeo com fala" o som do clipe principal É a narração
                    do vídeo: deixar ele mudo entregaria um vídeo sem ninguém
                    falando, que nunca é o que a pessoa quis. Por isso ali o par
                    Manter/Mudo nem aparece (06/08/2026). */}
                {modo === "base" ? (
                  <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                    <b className="text-foreground">O som do vídeo fica ligado.</b> É a fala
                    dele que narra o vídeo inteiro, então ela não sai. Dá pra ajustar o
                    volume aqui embaixo.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <BotaoOpcao
                      ativo={!mudo}
                      onClick={() => setAudioVideo("manter")}
                      icon={Volume2}
                      label="Manter"
                    />
                    <BotaoOpcao
                      ativo={mudo}
                      onClick={() => {
                        // no "Transcrever fala" o som original é a fonte da legenda
                        if (formato === "transcrever") {
                          toast.info("No formato Transcrever fala o som original fica ligado. 🙂");
                          return;
                        }
                        setAudioVideo("remover");
                      }}
                      icon={VolumeX}
                      label="Mudo"
                    />
                  </div>
                )}
                {conflitoAudio && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200/90">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                    <span>
                      Com <b>voz narrada</b>, manter o som do vídeo pode embolar o
                      áudio. Sugerimos <b>Mudo</b>.
                    </span>
                  </div>
                )}

                {!mudo && (
                  <div className="mt-3">
                    <ControleVolume
                      icon={Volume2}
                      label="Volume do som do vídeo"
                      valor={volumeOriginal}
                      max={MAX_VOLUME_BOOST}
                      onChange={setVolumeOriginal}
                      dica={
                        modoPrincipal
                          ? "A fala do clipe principal. Dê o play na prévia e ajuste ouvindo."
                          : "Som que já vem nos seus vídeos. Dê o play na prévia e ajuste ouvindo."
                      }
                    />
                  </div>
                )}
              </div>

              {/* Música: NÃO existe mais o par "com música / sem música"
                  (06/08/2026). Eram duas perguntas pra uma decisão só, e a
                  segunda ("qual?") já respondia a primeira. Ficaram os dois
                  caminhos de verdade: o SEU arquivo, ou a biblioteca da casa
                  (chave abaixo, desligada por padrão). Nenhum dos dois = vídeo
                  sem trilha. */}
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Música de fundo{" "}
                  <span className="text-muted-foreground/70">(opcional)</span>
                </p>
                <div className="space-y-3">
                  {/* aceita vídeo também: a plataforma usa só o SOM dele como
                      música (é comum a pessoa ter o áudio dentro de um mp4) */}
                  <MediaPicker
                    kind="audio"
                    files={musica}
                    onChange={(fs) => {
                      const grande = fs.find(
                        (f) => f.size > MAX_ARQUIVO_MB * 1024 * 1024,
                      );
                      if (grande) {
                        toast.error(
                          `"${grande.name}" tem ${tamanhoEmMB(grande.size)} e o limite é ${MAX_ARQUIVO_MB} MB por arquivo.`,
                        );
                        return;
                      }
                      setMusica(fs);
                    }}
                    multiple={false}
                    accept="audio/*,video/*"
                    volume={volumeMusica / 100}
                    velocidade={velocidadeMusica}
                    hint="Suba um áudio ou um vídeo (usamos só o som dele)."
                  />

                  <Chave
                    ativo={musicaAuto}
                    onClick={() => {
                      setMusicaAuto((v) => !v);
                      // a lista é buscada no PRIMEIRO clique, não na montagem da
                      // tela: quem nunca liga a chave não paga essa chamada
                      if (musicasPlataforma === null) {
                        fetch("/api/musicas")
                          .then((r) => r.json())
                          .then((d: { musicas?: { arquivo: string; nome: string }[] }) =>
                            setMusicasPlataforma(d.musicas ?? []),
                          )
                          .catch(() => setMusicasPlataforma([]));
                      }
                    }}
                    titulo="Usar músicas da plataforma"
                    descricao={
                      musica.length
                        ? "Você já subiu uma música, e é ela que vai tocar. Esta chave só entra em ação quando o campo acima está vazio."
                        : "A plataforma escolhe uma trilha da biblioteca dela pra este vídeo. Desligada e sem arquivo acima, o vídeo sai sem música nenhuma."
                    }
                  />

                  {/* Qual trilha da biblioteca: sorteada pela IA (padrão) ou uma
                      específica. Só aparece sem arquivo próprio, porque com
                      arquivo é ele que toca e o seletor seria promessa vazia. */}
                  {musicaAuto && musica.length === 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qual música da plataforma</Label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={musicaEscolhida}
                          onChange={(e) => setMusicaEscolhida(e.target.value)}
                          aria-label="Música da plataforma"
                          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                        >
                          <option value="">Sorteada pela IA (aleatória)</option>
                          {(musicasPlataforma ?? []).map((m) => (
                            <option key={m.arquivo} value={m.arquivo}>
                              {m.nome}
                            </option>
                          ))}
                        </select>
                        {/* a sorteada não tem o que ouvir (só existe no render),
                            por isso o play some sem trilha escolhida */}
                        {musicaEscolhida && (
                          <button
                            type="button"
                            onClick={alternarPreviaMusica}
                            title={
                              previaMusica
                                ? "Pausar a prévia"
                                : "Ouvir esta música (o volume e a velocidade ali de baixo valem na prévia)"
                            }
                            aria-label="Ouvir uma prévia da música escolhida"
                            className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
                          >
                            {previaMusica ? (
                              <Pause className="size-4" />
                            ) : (
                              <Play className="size-4" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {musicasPlataforma === null
                          ? "Carregando a lista de músicas..."
                          : musicasPlataforma.length === 0
                            ? "A lista não está disponível agora, então a IA sorteia uma trilha da biblioteca."
                            : musicaEscolhida
                              ? "Toque no play pra ouvir. O volume e a velocidade ajustados aqui embaixo valem na prévia e no vídeo."
                              : "Escolha uma trilha (dá pra ouvir antes) ou deixe a IA sortear na hora do render."}
                      </p>
                    </div>
                  )}

                  {comMusica && (
                    <>
                      <ControleVolume
                        icon={Music}
                        label="Volume da música"
                        valor={volumeMusica}
                        onChange={setVolumeMusica}
                        dica="Vale pra sua música e pra da plataforma. Deixe baixo pra não abafar a fala."
                      />

                      <VelocidadeMusica
                        valor={velocidadeMusica}
                        onChange={setVelocidadeMusica}
                        temPreview={!!musicaUrl}
                      />
                    </>
                  )}
                </div>
              </div>

              {formato === "voz" && (
                <ControleVolume
                  icon={Mic}
                  label="Volume da narração"
                  valor={volumeVoz}
                  max={MAX_VOLUME_BOOST}
                  onChange={setVolumeVoz}
                  dica="Voz da IA. Ela só existe depois do render, então não dá pra ouvir aqui: no vídeo pronto tem o botão Reajustar áudio pra acertar ouvindo, sem gastar crédito."
                />
              )}
            </Secao>

            <Secao icon={Wand2} titulo="Edição avançada">
              <p className="text-[11px] text-muted-foreground">
                O que a plataforma faz sozinha pra o vídeo não parecer clipes colados.
                Desligue o que você já resolveu na sua própria edição.
              </p>
              <Chave
                ativo={edicao.kenBurns}
                onClick={() => setEdicao((e) => ({ ...e, kenBurns: !e.kenBurns }))}
                titulo="Zoom lento nas fotos"
                descricao={`A foto não fica parada na tela: a câmera vai fechando devagar nela enquanto aparece. Cada foto fica de ${IMAGEM_MIN_SEG} a ${IMAGEM_MAX_SEG} segundos.`}
              />
              <Chave
                ativo={edicao.transicoes}
                onClick={() => setEdicao((e) => ({ ...e, transicoes: !e.transicoes }))}
                titulo="Transição suave entre as cenas"
                descricao="A cena de apoio entra e sai com um esmaecido curto, em vez de um corte seco."
              />
              {/* O som do apoio é a ÚLTIMA da lista e vem DESLIGADA (06/08/2026):
                  é a única que mexe no que se ouve, e na maioria dos vídeos o
                  barulho de fundo do apoio só atrapalha a fala. Quem quiser liga. */}
              {modoPrincipal && (
                <>
                  <Chave
                    ativo={edicao.trechoInteligente}
                    onClick={() =>
                      setEdicao((e) => ({ ...e, trechoInteligente: !e.trechoInteligente }))
                    }
                    titulo={
                      modo === "narracao"
                        ? "A IA escolhe o melhor pedaço de cada cena"
                        : "A IA escolhe o melhor pedaço do apoio"
                    }
                    // na narração esta chave faz MAIS do que escolher o pedaço:
                    // é ela que liga a IA que divide a fala entre as cenas
                    // (12/08/2026). Desligada, elas dividem o tempo por igual e
                    // começam onde a pessoa cortou, sem nenhuma chamada de IA.
                    descricao={
                      modo === "narracao"
                        ? "Suas cenas dividem entre si o tempo da narração, na ordem que você montou. Com esta chave ligada a IA olha cada clipe e escolhe o pedaço que combina com o que está sendo falado enquanto ele está na tela. Desligada, cada cena entra pelo ponto em que você cortou e o tempo é dividido por igual."
                        : "Um vídeo de apoio de 30 segundos não entra inteiro: a IA olha o clipe e mostra o pedaço em que a ação acontece, em vez de começar sempre pelo início."
                    }
                  />
                  <Chave
                    ativo={edicao.somApoio}
                    onClick={() => setEdicao((e) => ({ ...e, somApoio: !e.somApoio }))}
                    titulo="Som das cenas de apoio"
                    descricao={`Desligado, as cenas de apoio entram mudas e só a fala do vídeo é ouvida. Ligado, o barulho delas entra baixinho (${VOL_APOIO}%) e cai pra ${VOL_APOIO_FALANDO}% nos trechos em que há fala, pra nunca disputar com ela.`}
                  />
                </>
              )}
            </Secao>
          </>
        )}

        {/* ---------- ETAPA 5: aprovação ---------- */}
        {passo === 5 && (
          <>
            {/* RESUMO DO PEDIDO: tudo o que foi decidido nas 4 etapas, numa tela
                só. Antes a aprovação mostrava a régua do tempo e mais nada, então
                conferir o que tinha sido escolhido lá atrás exigia voltar etapa
                por etapa. */}
            <Secao icon={ClipboardList} titulo="Resumo do pedido">
              <div className="grid gap-2 sm:grid-cols-2">
                <Resumo
                  titulo={modo === "base" ? "Vídeo com fala" : "Voz de IA narrando"}
                  linhas={
                    modo === "base"
                      ? [
                          `${principais.length} ${principais.length === 1 ? "vídeo principal" : "vídeos principais"}`,
                          `${fmt(durBase)} de base`,
                          cortarSilencio > 0
                            ? `corta pausas de mais de ${cortarSilencio.toLocaleString("pt-BR")}s`
                            : "sem corte de silêncio",
                        ]
                      : [
                          falaPor === "ia" ? "a IA escreve a fala" : "você escreveu a fala",
                          `voz ${vozes.find((v) => v.id === voz)?.nome ?? "padrão"}`,
                          `${fmt(totalDur)} de vídeo`,
                        ]
                  }
                  onIr={() => setPasso(1)}
                />
                <Resumo
                  titulo={ehProduto ? `Produto: ${nome.trim() || "sem nome"}` : "Não é produto"}
                  linhas={[
                    temLegenda
                      ? `legenda ${POSICOES.find((p) => p.value === legendaPos)?.label.toLowerCase()}`
                      : "sem legenda",
                    temLegenda && legendaDaFala
                      ? legendaEstilo === "palavra"
                        ? "palavra por palavra"
                        : "frase inteira (2 linhas)"
                      : FORMATO_NOTA[formato]?.slice(0, 60) ?? "",
                    ehProduto && preco.trim() ? `R$ ${preco.trim()}` : "",
                  ].filter(Boolean)}
                  onIr={() => setPasso(2)}
                />
                <Resumo
                  titulo={`Mídias (${clips.length})`}
                  linhas={[
                    modo === "base"
                      ? `${apoios.length} ${apoios.length === 1 ? "cena de apoio" : "cenas de apoio"} (${marcasApoio.length} ${marcasApoio.length === 1 ? "entra" : "entram"})`
                      : `${clips.length} ${clips.length === 1 ? "mídia toca" : "mídias tocam"} em sequência`,
                    `${clips.filter((c) => c.descricao.trim()).length} de ${clips.length} descritas`,
                    textos.length
                      ? `${textos.length} ${textos.length === 1 ? "texto" : "textos"} na tela`
                      : "sem texto na tela",
                  ]}
                  onIr={() => setPasso(3)}
                />
                <Resumo
                  titulo="Áudio"
                  linhas={[
                    modo === "base" || audioVideo === "manter"
                      ? `som do vídeo em ${volumeOriginal}%`
                      : "som original desligado",
                    comMusica
                      ? `música em ${volumeMusica}%${velocidadeMusica !== VELOCIDADE_PADRAO ? ` (${velocidadeMusica}x)` : ""}${musicaAuto && !musica.length ? " (da plataforma)" : ""}`
                      : "sem música de fundo",
                    formato === "voz" ? `narração em ${volumeVoz}%` : "",
                  ].filter(Boolean)}
                  onIr={() => setPasso(4)}
                />
              </div>
            </Secao>

            <Secao icon={ListChecks} titulo="Como o vídeo vai ficar">
              <p className="text-[11px] text-muted-foreground">
                {modo === "base" ? (
                  precisaPosicionar ? (
                    <>
                      Falta o último passo: a IA precisa{" "}
                      <b className="text-foreground">ouvir a fala do seu vídeo</b> pra
                      encaixar cada cena de apoio no momento em que você fala daquilo.
                      Depois disso a linha do tempo aparece aqui com os segundos reais, e
                      você confere (e muda) antes de gerar.
                    </>
                  ) : (
                    <>
                      A IA ouviu a fala do seu vídeo e encaixou cada cena de apoio no
                      momento em que a fala combina com o que a cena mostra, respeitando as
                      pausas pra o corte não cair no meio de uma palavra.{" "}
                      <b className="text-foreground">
                        Estes são os segundos finais: o render obedece exatamente isso.
                      </b>
                    </>
                  )
                ) : falaPor === "eu" ? (
                  <>
                    As mídias tocam nesta ordem e a narração corre por cima.{" "}
                    <b className="text-foreground">
                      A voz lê exatamente o texto que você escreveu na etapa 1.
                    </b>
                  </>
                ) : (
                  <>
                    As mídias tocam nesta ordem e a narração corre por cima.{" "}
                    <b className="text-foreground">
                      A descrição de cada cena é o que faz a fala combinar com o que está
                      na tela naquele momento.
                    </b>
                  </>
                )}
              </p>
              {/* A RÉGUA SÓ APARECE DEPOIS DE POSICIONAR (dono, 06/08/2026).
                  Antes disso ela mostrava tempos de RESERVA, que o render ia
                  trocar sozinho: a pessoa lia uma linha do tempo, aprovava, e
                  recebia outra. Agora ou os segundos são os finais, ou não há
                  régua nenhuma pra ler. */}
              {precisaPosicionar ? (
                <div className="relative flex flex-col items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5 text-center">
                  <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-wider text-primary">
                    PRO
                  </span>
                  <span className="grid size-10 place-items-center rounded-full bg-primary/15">
                    <Wand2 className="size-5 text-primary" />
                  </span>
                  <p className="text-xs font-medium">
                    {marcasApoio.length}{" "}
                    {marcasApoio.length === 1
                      ? "cena de apoio esperando o lugar dela"
                      : "cenas de apoio esperando o lugar delas"}
                  </p>
                  <p className="max-w-sm text-[11px] text-muted-foreground">
                    A IA ouve a fala do seu vídeo e diz em que segundo cada uma encaixa.
                    Ela faz isso sozinha quando você gerar, mas pedindo{" "}
                    <b className="text-foreground">agora</b> você vê a linha do tempo com
                    os segundos reais e muda o que discordar.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    disabled={ocupadoAnalise || bloqueado}
                    onClick={posicionarPorIA}
                    className="mt-1 h-11 w-full max-w-sm"
                  >
                    {posicionando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                    {analisando
                      ? "Olhando as cenas..."
                      : posicionando
                        ? "Ouvindo a fala..."
                        : `Abrir editor PRO (${custoVerAntes} ${custoVerAntes === 1 ? "crédito" : "créditos"})`}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    {custoAutoDescrever > 0 ? (
                      <>
                        {custoPosicionar} pra posicionar e {custoAutoDescrever} pra descrever{" "}
                        {cenasAutoDescritas.length === 1
                          ? "a cena que ficou em branco"
                          : "as cenas que ficaram em branco"}
                        . É o mesmo preço de gerar direto: muda só se você confere antes.
                      </>
                    ) : (
                      <>
                        {CREDITOS_FIXO.posicionarCena} crédito por cena, aqui ou na hora de
                        gerar: o preço é o mesmo, muda só se você confere antes.
                      </>
                    )}
                  </p>
                </div>
              ) : previewNaTimeline ? (
                <>
                  {/* ===== O PAINEL DE EDITOR (v2, dono 11/08/2026): prévia em
                      cima, timeline de DUAS LINHAS embaixo, como num editor.
                      A linha 1 (principais) é só visual de propósito: cortar ou
                      reordenar a base muda a fala inteira e obrigaria a
                      posicionar tudo de novo - isso continua na etapa 3. ===== */}
                  <div className="mx-auto w-full max-w-[260px]">{palcoBox}</div>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={togglePlay}
                    >
                      {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmt(tGlobal)} / {fmt(durBase)}
                    </span>
                  </div>
                  <TimelineEditor
                    durBase={durBase}
                    principais={principais}
                    apoios={apoios}
                    marcasApoio={marcasApoio}
                    tGlobal={tGlobal}
                    selecionada={cenaSel}
                    onSelecionar={setCenaSel}
                    onSeek={seekGlobal}
                    onGeo={setGeoApoio}
                    onTrecho={setTrechoApoio}
                    onIrParaCena={focarCena}
                  />

                  {/* A IA posiciona UMA vez só (dono 11/08/2026): daqui pra frente
                      o ajuste é na mão, na timeline. Não existe "posicionar de
                      novo" - repetir cobraria crédito de novo pelo mesmo passo. */}
                  {podePosicionar && (
                    <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                      <p className="text-[10px] text-muted-foreground">
                        <b className="text-foreground">Os tempos acima são os finais.</b> A
                        IA ouviu a fala do seu vídeo e escolheu cada momento; o render vai
                        obedecer exatamente isso. Discordou de algum?{" "}
                        <b className="text-foreground">Arraste a cena na timeline</b>{" "}
                        pra mudar o momento,{" "}
                        <b className="text-foreground">puxe as alças das pontas</b> pra mudar
                        o tamanho e <b className="text-foreground">toque nela</b> pra abrir os
                        ajustes finos (segundo exato e qual pedaço do arquivo aparece). As
                        cenas não se sobrepõem: o bloco encosta na vizinha e para. Nada disso
                        gasta crédito.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <Plano
                  modo={modo}
                  durBase={durBase}
                  totalDur={totalDur}
                  clips={clips}
                  falaPor={falaPor}
                  roteiroFala={roteiroFala}
                />
              )}
            </Secao>

            {/* ÚLTIMA CHANCE de descrever você mesmo. A descrição em si mora na
                etapa Mídias (06/08/2026): aqui só sobra o aviso de que ficou
                cena sem ela, com o atalho de volta. Não trava a geração: desde
                11/08/2026 a IA descreve o que ficou em branco sozinha, nos DOIS
                botões desta etapa (ver a linha do tempo antes e aprovar e
                gerar), sempre antes de posicionar. */}
            {cenasAnalisaveis.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200/90">
                <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                <span>
                  <b>
                    {cenasAnalisaveis.length}{" "}
                    {cenasAnalisaveis.length === 1 ? "cena está" : "cenas estão"} sem
                    descrição.
                  </b>{" "}
                  {modo === "base" ? (
                    <>
                      Pode seguir assim mesmo: a IA descreve{" "}
                      {cenasAnalisaveis.length === 1 ? "ela" : "cada uma"} sozinha antes de
                      posicionar, por {custoAnalise}{" "}
                      {custoAnalise === 1 ? "crédito" : "créditos"}, tanto em Ver a linha do
                      tempo antes quanto em Aprovar e gerar. Escrever você mesmo é de graça
                      e sai do seu jeito.{" "}
                    </>
                  ) : (
                    <>
                      Dá pra gerar assim mesmo, mas a copy é escrita sem saber o que
                      aparece nas cenas.{" "}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setPasso(3)}
                    className="font-semibold underline underline-offset-2"
                  >
                    Voltar pras mídias e descrever
                  </button>
                </span>
              </div>
            )}

            {!bloqueado && (
              <p className="text-center text-xs text-muted-foreground">
                Usará <span className="font-semibold text-primary">{estimativa}</span>
                {/* o que a IA ainda vai fazer sozinha no clique também custa, e a
                    pessoa precisa ver isso ANTES de apertar (dono, 11/08/2026) */}
                {(cenasAutoDescritas.length > 0 || precisaPosicionar) && (
                  <>
                    {" + "}
                    <span className="font-semibold text-primary">
                      {custoAutoDescrever + (precisaPosicionar ? custoPosicionar : 0)}{" "}
                      créditos
                    </span>{" "}
                    que a IA usa no clique pra{" "}
                    {cenasAutoDescritas.length > 0 && precisaPosicionar
                      ? "descrever e posicionar as cenas"
                      : cenasAutoDescritas.length > 0
                        ? "descrever as cenas em branco"
                        : "posicionar as cenas"}
                  </>
                )}
                {descritasPelaIA > 0 && (
                  <>
                    {" "}
                    (a análise das cenas já foi cobrada:{" "}
                    {custoAnaliseCenas(descritasPelaIA)} créditos)
                  </>
                )}
              </p>
            )}

            {(passouDoTeto || apoioLongo) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200/90">
                <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                <span>
                  {passouDoTeto
                    ? `Seu vídeo está com ${fmt(totalDur)}. O editor faz até ${MAX_VIDEO_SEG / 60} minutos: volte e corte alguns clipes.`
                    : `Tem cena de apoio com mais de ${MAX_APOIO_SEG / 60} minuto. Volte e corte ela com as alças verdes, embaixo da prévia.`}
                </span>
              </div>
            )}
          </>
        )}

        {/* ===== PALCO, casa nº 3: o celular (dono, 12/08/2026).
            Aqui a prévia fica FECHADA. Ela é 9:16, e no celular a coluna da
            direita desce pro fim da tela: o vídeo virava um paredão embaixo do
            formulário, com o Voltar/Continuar plantado em cima dele. Fechada,
            os botões voltam pra logo depois das perguntas.
            Não some de vez porque as alças verdes de cortar o clipe moram
            dentro dela: sem este botão, cortar pelo celular deixaria de
            existir - e a tela manda cortar quando uma cena passa de 1 minuto,
            travando o Gerar até isso ser feito. ===== */}
        {!previewNaTimeline && !telaGrande && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                // fechando com o vídeo rodando: para ANTES de sumir com ele,
                // senão sobra música tocando numa tela sem imagem nenhuma
                if (previaAberta) pararPrevia();
                setPreviaAberta((v) => !v);
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground transition-colors active:bg-muted"
            >
              {previaAberta ? (
                <ChevronUp className="size-4 text-primary" />
              ) : (
                <ChevronDown className="size-4 text-primary" />
              )}
              {previaAberta
                ? "esconder a prévia"
                : atual
                  ? "ver a prévia e cortar o clipe"
                  : "ver a prévia"}
            </button>
            {/* escondida por CSS, NÃO desmontada: assim o palco existe uma vez
                só e sempre, e o `<video>` não fica indo e voltando a cada
                toque. Desmontar aqui devolveria o clipe pro quadro zero e
                deixaria o elemento antigo tocando solto por baixo. */}
            <div className={cn(!previaAberta && "hidden")}>{palcoComCorte}</div>
          </div>
        )}

        {/* ---------- navegação ---------- */}
        {/* durante a análise das cenas os botões travam (além do overlay que
            cobre a tela): navegar no meio deixaria a cobrança correndo com a
            pessoa em outra etapa */}
        <div className="flex items-center gap-2 border-t border-border pt-4">
          {passo > 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={ocupadoAnalise}
              onClick={() => setPasso(Math.max(1, passo - 1))}
            >
              <ChevronLeft className="size-4" />
              Voltar
            </Button>
          )}
          {passo < ULTIMO_PASSO ? (
            <Button
              type="button"
              className="ml-auto"
              disabled={ocupadoAnalise}
              onClick={avancar}
            >
              Continuar
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="ml-auto h-11"
              // posicionar virou automático (dono, 11/08/2026): quem não pediu
              // antes recebe no clique, e agora em SEGUNDO PLANO, com a pessoa
              // já em Meus vídeos vendo o card gerar
              title={
                precisaPosicionar
                  ? "A IA vai ouvir a fala e escolher o momento de cada cena. Você não precisa esperar nesta tela."
                  : undefined
              }
              disabled={
                enviando ||
                bloqueado ||
                passouDoTeto ||
                apoioLongo ||
                ocupadoAnalise ||
                enviosPendentes.length > 0
              }
              onClick={gerar}
            >
              {bloqueado ? (
                <Lock className="size-4" />
              ) : enviando || enviosPendentes.length > 0 ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {bloqueado
                ? "Indisponível na demo"
                : enviosPendentes.length > 0 && !envioFalhou
                  ? `Enviando mídias... ${pctEnvio}%`
                  : "Aprovar e gerar"}
            </Button>
          )}
        </div>
        {/* o botão fica travado enquanto o upload não fecha: o único momento do
            fluxo em que ainda existe espera de verdade */}
        {passo === ULTIMO_PASSO && enviosPendentes.length > 0 && !bloqueado && (
          <p className="text-right text-[11px] text-muted-foreground">
            {envioFalhou
              ? "Alguma mídia não subiu. Volte pras mídias e toque em Enviar de novo."
              : "Só falta terminar de enviar as suas mídias pro servidor."}
          </p>
        )}

        {motivoTravado && passo < ULTIMO_PASSO && (
          <p className="text-right text-[11px] text-muted-foreground">{motivoTravado}</p>
        )}
      </div>

      {/* ===== PALCO, casa nº 2: a coluna da direita, SÓ no computador.
          No celular ele mora dentro do formulário, num botão (casa nº 3), e na
          aprovação com o painel de editor sobe pra cima da timeline (casa
          nº 1). Uma de cada vez, sempre. ===== */}
      {!previewNaTimeline && telaGrande && (
        // `min-w-0` pelo mesmo motivo da coluna dos passos: o palco é 9:16 e
        // tem player dentro, justamente o tipo de conteúdo que estica o grid.
        //
        // O `hidden lg:block` NÃO substitui o `telaGrande` (esse é que desmonta
        // o palco): ele cobre o piscar do primeiro instante. Até a hidratação a
        // resposta da largura é "computador", então sem ele o celular pintaria
        // o vídeo uma vez e o apagaria em seguida.
        <div className="hidden min-w-0 lg:sticky lg:top-4 lg:block lg:self-start">
          {palcoComCorte}
        </div>
      )}
    </div>
  );
}

/* ---------------- componentes auxiliares ---------------- */

/**
 * Barra de progresso do funil.
 *
 * Desde 06/08/2026 a trilha é NAVEGÁVEL nos dois sentidos: quem volta consertar
 * algo na etapa 1 clica direto de volta em "Mídias" em vez de apertar Continuar
 * etapa por etapa. O visto verde diz quais já estão de pé, e é exatamente ele que
 * libera o clique: etapa apagada é etapa que ainda não dá pra visitar.
 */
function Trilha({
  passo,
  onIr,
  resolvido,
  liberado,
}: {
  passo: number;
  onIr: (n: number) => void;
  /** a etapa já foi alcançada e está sem pendência (visto verde) */
  resolvido: (n: number) => boolean;
  /** dá pra clicar e ir direto pra ela */
  liberado: (n: number) => boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {PASSOS.map(({ n, titulo, Icone }) => {
          const agora = n === passo;
          const feito = !agora && resolvido(n);
          const clicavel = liberado(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => onIr(n)}
              disabled={!clicavel}
              title={
                agora
                  ? titulo
                  : clicavel
                    ? `Ir para: ${titulo}`
                    : `${titulo} (falta terminar as etapas anteriores)`
              }
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition-colors",
                clicavel ? "cursor-pointer hover:bg-accent" : "cursor-default",
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
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${(passo / PASSOS.length) * 100}%` }}
        />
      </div>
      <p className="text-center text-[11px] text-muted-foreground sm:hidden">
        Etapa {passo} de {PASSOS.length}: {PASSOS[passo - 1].titulo}
      </p>
    </div>
  );
}

/** Um dos dois pontos de partida da etapa 1. */
function CartaoModo({
  ativo,
  onClick,
  Icone,
  titulo,
  descricao,
}: {
  ativo: boolean;
  onClick: () => void;
  Icone: typeof Volume2;
  titulo: string;
  descricao: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg",
        ativo
          ? "border-primary bg-primary/8 shadow-md shadow-primary/10"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span className="flex items-center gap-2">
        <Icone className={cn("size-5", ativo ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-semibold">{titulo}</span>
        {ativo && <Check className="ml-auto size-4 text-primary" />}
      </span>
      <span className="text-[11px] leading-relaxed text-muted-foreground">{descricao}</span>
    </button>
  );
}

/** Liga/desliga de uma melhoria de edição (etapa 4). */
function Chave({
  ativo,
  onClick,
  titulo,
  descricao,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  descricao: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        ativo ? "border-primary/50 bg-primary/5" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded border transition-colors",
          ativo ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {ativo && <Check className="size-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium">{titulo}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{descricao}</span>
      </span>
    </button>
  );
}

/**
 * O ROTEIRO VISUAL da etapa 5: a régua do vídeo com o lugar de cada cena.
 *
 * Com base, mostra a faixa da fala e os blocos dos apoios em cima dela, no
 * segundo em que cada um entra. Sem base, mostra as mídias em sequência, no
 * tamanho proporcional ao tempo de cada uma. É a mesma conta que o render usa.
 */
/**
 * Um cartão do resumo do pedido: o título da etapa, o que foi decidido nela e um
 * atalho pra voltar e mexer. Existe pra a aprovação mostrar TUDO numa tela só,
 * em vez de obrigar a pessoa a percorrer o funil de novo pra conferir.
 */
function Resumo({
  titulo,
  linhas,
  onIr,
}: {
  titulo: string;
  linhas: string[];
  onIr: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold" title={titulo}>
          {titulo}
        </p>
        <button
          type="button"
          onClick={onIr}
          className="shrink-0 text-[10px] font-medium text-primary underline underline-offset-2"
        >
          mudar
        </button>
      </div>
      <ul className="mt-1 space-y-0.5">
        {linhas.map((l) => (
          <li key={l} className="text-[11px] text-muted-foreground">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ARRASTAR A CENA NA RÉGUA pra escolher o segundo em que ela entra.
 *
 * Existe porque digitar o número era o ÚNICO jeito de mover (dono, 11/08/2026:
 * "só se move clicando no número, o que é ruim, mas útil também"). O campo
 * ficou: ele é a via de cravar 13,3s. O arrasto é a via de ACHAR o momento, que
 * é o que a pessoa está fazendo aqui.
 *
 * Trabalha por DELTA (quanto o dedo andou desde que encostou), não pela posição
 * absoluta do ponteiro: pegando o bloco pelo meio ele não pula pro dedo. E o
 * ponto de partida é gravado UMA vez, no começo do gesto, em vez de lido do
 * estado a cada movimento - o `planejarApoios` pode segurar o valor quando a
 * cena anterior está no caminho, e lendo de lá o bloco escorregaria sozinho.
 */
/**
 * Os buracos LIVRES da linha do tempo, tirando as outras cenas. É a base do ímã
 * anti-sobreposição: o render não desenha duas cenas de apoio ao mesmo tempo,
 * então o arrasto nem deixa a pessoa soltar uma em cima da outra.
 */
function vaosLivres(outras: { entra: number; dur: number }[], durBase: number) {
  const ocupadas = [...outras].sort((a, b) => a.entra - b.entra);
  const vaos: { ini: number; fim: number }[] = [];
  let cursor = 0;
  for (const o of ocupadas) {
    if (o.entra > cursor + 0.01) vaos.push({ ini: cursor, fim: o.entra });
    cursor = Math.max(cursor, o.entra + o.dur);
  }
  if (cursor < durBase - 0.01) vaos.push({ ini: cursor, fim: durBase });
  return vaos;
}

/**
 * O ímã em si: o lugar mais perto do dedo em que uma cena desse tamanho cabe
 * inteira. Encostou numa vizinha, o bloco gruda na borda dela; puxou mais, pula
 * pro buraco do outro lado. `null` = não há buraco que a comporte (aí o gesto
 * não faz nada, em vez de empurrar as outras).
 */
function acomodarNosVaos(
  alvo: number,
  dur: number,
  vaos: { ini: number; fim: number }[],
): number | null {
  let melhor: number | null = null;
  let dist = Infinity;
  for (const v of vaos) {
    if (v.fim - v.ini < dur - 0.01) continue;
    const p = Math.max(v.ini, Math.min(alvo, v.fim - dur));
    const d = Math.abs(p - alvo);
    if (d < dist) {
      dist = d;
      melhor = p;
    }
  }
  return melhor;
}

/** O vão em que a cena mora agora: é até onde as alças deixam ela crescer. */
function vaoDe(vaos: { ini: number; fim: number }[], entra: number) {
  return vaos.find((v) => entra >= v.ini - 0.01 && entra <= v.fim + 0.01) ?? null;
}

/** Os três gestos da régua: mover o bloco ou puxar uma das alças de tamanho. */
type GestoRegua = "mover" | "esq" | "dir";

/** A geometria que o painel devolve. `null` no `dura` = volta pro automático. */
type GeoApoio = { entra?: number | null; dura?: number | null };

function useArrastarNaRegua(
  faixaRef: RefObject<HTMLElement | null>,
  durBase: number,
  onGeo?: (id: string, geo: GeoApoio) => void,
) {
  const arraste = useRef<{
    id: string;
    gesto: GestoRegua;
    /** onde o dedo encostou e de que geometria a cena partiu */
    x0: number;
    entra0: number;
    dur0: number;
    /** largura da régua em pixels, medida no início (não muda no meio do gesto) */
    largura: number;
    /** piso e teto do TAMANHO desta cena (o teto é o material: vídeo não estica além do corte) */
    minDur: number;
    maxDur: number;
    /** buracos livres SEM esta cena, medidos no início do gesto: o ímã */
    vaos: { ini: number; fim: number }[];
    moveu: boolean;
  } | null>(null);
  /** o gesto que acabou foi arrasto? serve pra o clique de "abrir a cena nas
   *  mídias" não disparar no fim de um arrasto */
  const arrastou = useRef(false);

  function aplicar(a: NonNullable<typeof arraste.current>, clientX: number) {
    const dx = ((clientX - a.x0) / a.largura) * durBase;
    // 1 casa decimal: é o passo dos campos ao lado, então o número mostrado e o
    // valor guardado são o mesmo
    const arred = (n: number) => Number(n.toFixed(1));
    if (a.gesto === "mover") {
      const alvo = acomodarNosVaos(a.entra0 + dx, a.dur0, a.vaos);
      if (alvo === null) return;
      onGeo?.(a.id, { entra: arred(alvo) });
      return;
    }
    const vao = vaoDe(a.vaos, a.entra0);
    if (a.gesto === "dir") {
      // alça da direita: o começo fica parado e o tamanho muda, crescendo até o
      // material acabar ou até encostar na cena seguinte (ou no fim do vídeo)
      const teto = Math.min(a.maxDur, (vao ? vao.fim : durBase) - a.entra0);
      const dura = Math.max(a.minDur, Math.min(a.dur0 + dx, Math.max(a.minDur, teto)));
      onGeo?.(a.id, { dura: arred(dura) });
      return;
    }
    // alça da esquerda: o FIM fica parado; o começo anda e o tamanho compensa
    const fim = a.entra0 + a.dur0;
    const piso = Math.max(vao ? vao.ini : 0, fim - a.maxDur);
    const teto = fim - a.minDur;
    const entra = Math.max(piso, Math.min(a.entra0 + dx, teto));
    onGeo?.(a.id, { entra: arred(entra), dura: arred(fim - entra) });
  }

  return {
    /** sem `onGeo` a régua é só desenho (etapas onde o tempo ainda não é final) */
    ativo: !!onGeo,
    arrastou: () => arrastou.current,
    /** `jaMoveu` = o gesto já nasceu movendo (toque fora do bloco, que o joga pra lá) */
    descer(
      e: ReactPointerEvent<HTMLElement>,
      cena: { id: string; entra: number; dur: number; minDur: number; maxDur: number },
      outras: { entra: number; dur: number }[],
      gesto: GestoRegua = "mover",
      jaMoveu = false,
    ) {
      const largura = faixaRef.current?.getBoundingClientRect().width ?? 0;
      // botão do meio e da direita não arrastam (no toque e na caneta o button é 0)
      if (!onGeo || largura <= 0 || e.button !== 0) return;
      arrastou.current = jaMoveu;
      arraste.current = {
        id: cena.id,
        gesto,
        x0: e.clientX,
        entra0: cena.entra,
        dur0: cena.dur,
        largura,
        minDur: cena.minDur,
        maxDur: cena.maxDur,
        vaos: vaosLivres(outras, durBase),
        moveu: jaMoveu,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (jaMoveu) aplicar(arraste.current, e.clientX);
    },
    mover(e: ReactPointerEvent<HTMLElement>) {
      const a = arraste.current;
      if (!a) return;
      // menos de 3px é tremida de dedo, não intenção de mover: sem isso todo
      // toque pra abrir a cena viraria um arrasto de alguns milésimos de segundo
      if (!a.moveu && Math.abs(e.clientX - a.x0) < 3) return;
      arraste.current = { ...a, moveu: true };
      arrastou.current = true;
      aplicar(arraste.current, e.clientX);
    },
    subir() {
      arraste.current = null;
    },
  };
}

/**
 * A FAIXA DE CORTE do painel da etapa 5: qual pedaço do ARQUIVO aparece.
 *
 * A barra inteira é o corte que a pessoa fez na etapa Mídias (das alças verdes);
 * a janela pintada é o pedaço que de fato vai pro vídeo, do tamanho que a cena
 * fica na tela. Arrastar a janela muda esse pedaço SEM sair da aprovação -
 * antes a única via era voltar pra etapa 3 e mexer no corte inteiro. Só aparece
 * em vídeo com sobra de material (foto não tem pedaço, e corte justo não tem
 * escolha).
 */
function FaixaTrecho({
  cena,
  dur,
  onTrecho,
}: {
  cena: { id: string; inSec: number; outSec: number; trecho: number | null };
  /** quanto tempo a cena fica na tela: é a LARGURA da janela */
  dur: number;
  onTrecho: (id: string, valor: number | null) => void;
}) {
  const faixaRef = useRef<HTMLDivElement>(null);
  const gesto = useRef<{ x0: number; t0: number; largura: number } | null>(null);
  const corte = Math.max(0.1, cena.outSec - cena.inSec);
  const espaco = Math.max(0, corte - dur);
  const t = Math.max(cena.inSec, Math.min(cena.trecho ?? cena.inSec, cena.inSec + espaco));
  const pct = (s: number) => `${Math.max(0, Math.min(100, (s / corte) * 100))}%`;

  function aplicar(clientX: number) {
    const g = gesto.current;
    if (!g) return;
    const alvo = g.t0 + ((clientX - g.x0) / g.largura) * corte;
    onTrecho(
      cena.id,
      Number(Math.max(cena.inSec, Math.min(alvo, cena.inSec + espaco)).toFixed(1)),
    );
  }

  return (
    <div className="mt-1.5">
      {/* 12px e alvo de 40px no atalho (dono, 11/08/2026): em 10px isso era
          rodapé, e é informação que se lê enquanto arrasta a janela */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          Pedaço do arquivo que aparece:{" "}
          <b className="tabular-nums text-foreground">
            {t.toFixed(1)}s a {(t + dur).toFixed(1)}s
          </b>
        </span>
        {cena.trecho !== null && (
          <button
            type="button"
            onClick={() => onTrecho(cena.id, null)}
            className="-my-1 shrink-0 rounded-md px-2 py-2.5 font-medium text-primary hover:underline"
            title="Apaga a escolha manual: a IA volta a apontar onde está a ação"
          >
            deixar automático
          </button>
        )}
      </div>
      <div
        ref={faixaRef}
        onPointerDown={(e) => {
          const r = faixaRef.current?.getBoundingClientRect();
          if (!r || r.width <= 0 || e.button !== 0) return;
          const seg = cena.inSec + ((e.clientX - r.left) / r.width) * corte;
          const noBloco = seg >= t && seg <= t + dur;
          // pegou fora da janela: ela pula pro dedo (centrada) e já sai arrastando
          gesto.current = {
            x0: e.clientX,
            t0: noBloco ? t : seg - dur / 2,
            largura: r.width,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          if (!noBloco) aplicar(e.clientX);
        }}
        onPointerMove={(e) => gesto.current && aplicar(e.clientX)}
        onPointerUp={() => (gesto.current = null)}
        onPointerCancel={() => (gesto.current = null)}
        className="cursor-grab touch-none select-none py-2 active:cursor-grabbing"
        title="Arraste a janela pra escolher qual pedaço do arquivo aparece na tela."
      >
        {/* a barra é de arrastar de dedo: 20px de altura, com o `py-2` em volta
            dando ~36px de alvo (antes eram 10px, fininha demais pra pegar) */}
        <div className="relative h-5 overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 rounded-full border border-primary/60 bg-primary/40"
            style={{ left: pct(t - cena.inSec), width: pct(dur), minWidth: 12 }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * A PRÉVIA da cena selecionada, na esquerda do painel de ajustes finos (dono,
 * 11/08/2026): o pedaço EXATO que vai entrar no vídeo, em laço curto.
 *
 * Não é a prévia da montagem (essa é o palco lá em cima, com a fala por baixo):
 * aqui é só o arquivo da cena, do segundo `ini` até `ini + dur`. Serve pra
 * conferir o pedaço - antes disso ele se escolhia no olho, arrastando uma
 * barrinha e lendo dois números.
 */
function PreviaTrecho({
  cena,
  ini,
  dur,
  entra,
}: {
  cena: Clip;
  /** onde o pedaço começa DENTRO do arquivo */
  ini: number;
  /** quanto tempo a cena fica na tela: é o tamanho do laço */
  dur: number;
  /**
   * O segundo em que a cena entra no vídeo. A prévia NÃO usa esse número (aqui
   * só toca o arquivo), mas mexer nele é mexer na cena - e é isso que o freio
   * de baixo escuta.
   */
  entra: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [tocando, setTocando] = useState(false);
  const fim = ini + dur;

  /**
   * Mexeu em QUALQUER ajuste da cena (o segundo em que entra, o tamanho, o
   * pedaço do arquivo): a prévia PARA e volta pro começo do pedaço novo.
   *
   * Deixar rodando era pior que inútil: o que estava na tela era o pedaço de
   * antes, então a pessoa mudava um número e via a imagem seguir igual, como se
   * o ajuste não tivesse pegado. Parado, o quadro é o do ajuste que ela acabou
   * de fazer - e isso vale também pra arrastar a janela do pedaço, que muda o
   * `ini` a cada milímetro do dedo.
   */
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.pause();
    v.currentTime = ini;
  }, [ini, dur, entra]);

  /**
   * O freio no fim do pedaço, quadro a quadro. `timeupdate` só dispara a cada
   * ~250ms, o que numa cena de 2s deixaria escapar meio segundo de material que
   * não entra no vídeo - justo o que a pessoa veio conferir aqui.
   */
  useEffect(() => {
    if (!tocando) return;
    let raf = 0;
    const olho = () => {
      const v = ref.current;
      if (!v) return;
      if (v.currentTime >= fim - 0.02) {
        v.pause();
        v.currentTime = ini;
        return;
      }
      raf = requestAnimationFrame(olho);
    };
    raf = requestAnimationFrame(olho);
    return () => cancelAnimationFrame(raf);
  }, [tocando, ini, fim]);

  // 192px de largura (dono, 11/08/2026: os 64px do começo não davam pra ver o
  // que estava no quadro). Em 9:16 isso dá ~341px de altura, então o painel
  // quebra em duas linhas no celular - o `flex-wrap` lá no chamador cuida disso.
  const caixa =
    "relative aspect-[9/16] w-48 shrink-0 overflow-hidden rounded-md border border-border bg-black";

  // foto é parada: não há pedaço nem play, só o que vai aparecer na tela
  if (cena.kind === "image") {
    return (
      <div className={caixa}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cena.url} alt="" className="size-full object-contain" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const v = ref.current;
        if (!v) return;
        if (v.paused) {
          // sempre do começo do pedaço: é o que a pessoa quer ver de novo
          v.currentTime = ini;
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      }}
      className={caixa}
      title={`Toca só o pedaço que aparece no vídeo (${ini.toFixed(1)}s a ${fim.toFixed(1)}s do arquivo)`}
    >
      <video
        ref={ref}
        src={cena.url}
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = ini;
        }}
        // o estado vem do ELEMENTO, não do clique: assim o freio lá em cima
        // (que dá pause sozinho no fim do pedaço) volta o botão pro play
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        className="size-full object-contain"
      />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white">
          {tocando ? <Pause className="size-5" /> : <Play className="size-5" />}
        </span>
      </span>
    </button>
  );
}

/**
 * A cena de apoio DESENHADA POR CIMA do principal na prévia.
 *
 * Virou componente com ref (11/08/2026, v2 do painel) porque o overlay precisa
 * SEGUIR A AGULHA, e o `autoPlay` de atributo só vale na montagem do elemento:
 * dar play com a agulha parada no MEIO de uma cena deixava o quadro congelado,
 * e esfregar a régua por cima da cena não mexia na imagem. Agora o tempo DO
 * ARQUIVO é derivado da agulha (começo do pedaço + quanto ela já entrou na
 * cena), o play/pause acompanha a prévia, e tocando só corrige DESVIO grande
 * (um pulo de agulha) - desvio pequeno é o andamento normal do arquivo, e
 * corrigir sempre travaria a reprodução.
 */
function ApoioOverlay({
  cena,
  marca,
  tGlobal,
  tocando,
}: {
  cena: Clip;
  marca: { entra: number; dur: number };
  tGlobal: number;
  tocando: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // onde o pedaço começa DENTRO do arquivo (mesma conta do `_inicio_apoio` da
  // fábrica: o trecho nunca começa tão no fim que a cena não caiba)
  const iniTrecho = Math.max(
    cena.inSec,
    Math.min(cena.trecho ?? cena.inSec, Math.max(cena.inSec, cena.outSec - marca.dur)),
  );
  const alvo = iniTrecho + Math.max(0, Math.min(tGlobal - marca.entra, marca.dur));

  // play/pause acompanham a prévia; no play, a cena parte do ponto da agulha
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (tocando) {
      v.currentTime = alvo;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocando]);

  // parado, o quadro segue o dedo; tocando, só um pulo de agulha reposiciona
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const desvio = Math.abs(v.currentTime - alvo);
    if ((!tocando && desvio > 0.04) || (tocando && desvio > 0.4)) v.currentTime = alvo;
  }, [alvo, tocando]);

  return (
    <video
      ref={ref}
      src={cena.url}
      muted
      playsInline
      preload="auto"
      className="absolute inset-0 size-full bg-black object-contain"
    />
  );
}

/**
 * A prévia da montagem SEM linha do tempo editável: é o caminho da NARRAÇÃO
 * (as mídias tocam em sequência e a voz corre por cima). No modo com fala a
 * etapa 5 usa o `TimelineEditor`, não isto aqui.
 */
function Plano({
  modo,
  durBase,
  totalDur,
  clips,
  falaPor,
  roteiroFala,
}: {
  modo: Modo | null;
  durBase: number;
  totalDur: number;
  clips: Clip[];
  /** quem escreve a fala: muda o quanto dá pra prever o tamanho dela */
  falaPor: "ia" | "eu";
  /** o texto que a pessoa escreveu (vazio quando quem escreve é a IA) */
  roteiroFala: string;
}) {
  if (!clips.length) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        Sem mídias ainda.
      </p>
    );
  }

  /* ===== QUEM MANDA NO TAMANHO É A FALA (dono, 12/08/2026) =====
     O vídeo termina no segundo em que a narração acaba. Até aqui a tela dizia só
     "somando X, a narração corre por cima do vídeo inteiro", que mente NAS DUAS
     PONTAS - não vai somar X, e não é a fala que se ajusta ao vídeo, é o vídeo
     que se ajusta a ela. Quem subia 3 vídeos de 1 minuto aprovava esperando 3
     minutos e recebia 15 segundos.

     O que o render faz com o excedente MUDOU no mesmo dia: antes ele cortava o
     fim e as últimas cenas nunca apareciam; agora as cenas dividem o tempo da
     fala entre si (`_plano_das_cenas`), na ordem montada, e a IA escolhe de cada
     uma o pedaço que combina com o que está sendo falado ali. Só fica de fora
     quem não cabe nem no mínimo de tela. */
  const [narrMin, narrMax] =
    falaPor === "eu" ? segundosDaNarracao(roteiroFala) : NARRACAO_IA_SEG;
  // quantas cenas cabem sem virar piscada: a mesma conta do render
  const cabemNaFala = Math.max(1, Math.floor(narrMax / NARRACAO_CENA_MIN));
  const entram = Math.min(clips.length, cabemNaFala);
  const foraDoVideo = clips.length - entram;
  const porCena = entram > 0 ? narrMax / entram : 0;
  const vaiEncolher = modo === "narracao" && totalDur > narrMax + 0.5;
  // mídia mais curta que a fala: o render repete a sequência do começo em vez de
  // congelar o último quadro (dono, 12/08/2026)
  const vaiRepetir = modo === "narracao" && totalDur < narrMin - 0.5;

  return (
    <div className="space-y-2">
      <div className="flex h-12 gap-0.5 overflow-hidden rounded-lg">
        {clips.map((c, i) => (
          <div
            key={c.id}
            className={cn(
              "grid min-w-0 place-items-center text-[10px] font-medium",
              // a cena que não vai entrar no vídeo aparece apagada: o desenho
              // deixou de ser só decoração e passou a dizer o que sai
              i >= entram
                ? "bg-muted text-muted-foreground/60 line-through"
                : "bg-primary/20 text-primary",
            )}
            style={{ flexGrow: Math.max(0.3, c.outSec - c.inSec) }}
            title={c.file.name}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        As {clips.length} mídias tocam nessa ordem, somando{" "}
        <b className="text-foreground">
          {fmt(modo === "base" && durBase > 0 ? durBase : totalDur)}
        </b>
        {modo === "narracao"
          ? ". Quem manda no tamanho do vídeo é a fala: ele termina no segundo em que ela acaba."
          : ". A narração corre por cima do vídeo inteiro."}
      </p>

      {vaiEncolher && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <span>
            <b className="text-amber-100">Seu vídeo vai sair bem mais curto.</b>{" "}
            {falaPor === "eu"
              ? `O texto que você escreveu dá perto de ${fmt(narrMax)} de fala`
              : `A fala que a IA escreve dura de ${fmt(narrMin)} a ${fmt(narrMax)}`}
            , e suas mídias somam {fmt(totalDur)}. As cenas não somam esse tempo
            todo: elas <b className="text-amber-100">dividem o tempo da fala</b>{" "}
            entre si, na ordem que você montou, e a IA olha cada clipe e escolhe o
            pedaço que combina com o que está sendo falado ali. Cada uma deve
            ficar perto de <b className="text-amber-100">{fmt(porCena)}</b> na
            tela.
            {foraDoVideo > 0 && (
              <>
                {" "}
                <b className="text-amber-100">
                  {foraDoVideo === 1
                    ? "A última cena não vai aparecer"
                    : `As últimas ${foraDoVideo} cenas não vão aparecer`}
                </b>
                : em {fmt(narrMax)} de fala cabem no máximo {cabemNaFala} cenas
                sem virar piscada.
              </>
            )}{" "}
            {falaPor === "eu"
              ? "Quer cada cena mais tempo na tela? Escreva um texto mais longo na etapa 1."
              : "Quer cada cena mais tempo na tela? Escreva você mesmo a fala na etapa 1: aí o tamanho é seu."}
          </span>
        </div>
      )}

      {vaiRepetir && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <span>
            Suas mídias somam <b className="text-amber-100">{fmt(totalDur)}</b> e a
            fala deve passar disso, então{" "}
            <b className="text-amber-100">o vídeo repete do começo</b> até a
            narração terminar
            {clips.length > 1 && ` (as ${clips.length} cenas tocam de novo, na mesma ordem)`}
            . Subir mais mídia evita a repetição.
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Até onde o zoom da linha do tempo estica (8 telas). Acima disso um vídeo de
 * 1 min viraria uma rolagem sem fim pra achar a cena.
 */
const ZOOM_MAX = 8;

/**
 * O PAINEL DE EDITOR da aprovação (v2, dono 11/08/2026): timeline única, como
 * num editor de vídeo.
 *
 * Linha 1 = os principais em sequência (a fala). É SÓ VISUAL de propósito:
 * clicar leva a prévia até ali, mas cortar/reordenar a base continua na etapa
 * 3, porque mexer nela muda a fala inteira e obrigaria a posicionar de novo.
 * Linha 2 = as cenas de apoio, cada bloco no segundo em que cobre a base:
 * arrastar move (com o ímã anti-sobreposição), as alças das pontas mudam o
 * tamanho, e o CLIQUE seleciona - a prévia pula pro momento da cena e o painel
 * embaixo abre os ajustes finos dela (segundo exato, tamanho e pedaço).
 * A régua de segundos em cima é a agulha: tocar/arrastar nela leva a prévia
 * praquele ponto do vídeo, e a CABEÇA dela (a bolinha vermelha) é pegável.
 * O zoom embaixo estica a faixa pros lados: no celular a linha do tempo
 * inteira cabe em ~300px e uma cena de 2s vira um risquinho.
 */
function TimelineEditor({
  durBase,
  principais,
  apoios,
  marcasApoio,
  tGlobal,
  selecionada,
  onSelecionar,
  onSeek,
  onGeo,
  onTrecho,
  onIrParaCena,
}: {
  durBase: number;
  principais: Clip[];
  apoios: Clip[];
  marcasApoio: { id: string; entra: number; dur: number; auto: boolean }[];
  /** o segundo da linha do vídeo em que a prévia está (desenha a agulha) */
  tGlobal: number;
  selecionada: string | null;
  onSelecionar: (id: string | null) => void;
  /** leva a prévia pro segundo `t` da linha do vídeo */
  onSeek: (t: number) => void;
  onGeo: (id: string, geo: GeoApoio) => void;
  onTrecho: (id: string, valor: number | null) => void;
  /** abre a cena na etapa Mídias (descrição e corte com as alças verdes) */
  onIrParaCena: (id: string) => void;
}) {
  const faixaRef = useRef<HTMLDivElement>(null);
  /** a janela que rola: a faixa lá dentro é que estica com o zoom */
  const rolagemRef = useRef<HTMLDivElement>(null);
  const arraste = useArrastarNaRegua(faixaRef, durBase, onGeo);
  /** o dedo está esfregando a régua de segundos (scrub da agulha)? */
  const scrub = useRef(false);
  /**
   * Quantas telas a faixa ocupa (dono, 11/08/2026). Tudo mais continua em % da
   * faixa, então o zoom não mexe em nenhuma conta: os blocos, as alças e o
   * arrasto medem a largura real do elemento na hora do gesto.
   */
  const [zoom, setZoom] = useState(1);
  const pct = (s: number) => `${Math.max(0, Math.min(100, (s / durBase) * 100))}%`;

  /** as outras cenas, vistas da cena `id`: é o que alimenta o ímã do arrasto */
  const outrasDe = (id: string) =>
    marcasApoio.filter((x) => x.id !== id).map((x) => ({ entra: x.entra, dur: x.dur }));
  /**
   * Piso e teto do TAMANHO de cada cena. O piso manual é um só (meio segundo);
   * o teto do vídeo é o material que o corte tem (não dá pra segurar na tela um
   * pedaço que não existe), e foto é parada, então vai até onde a base deixar.
   */
  const limitesDe = (id: string) => {
    const c = apoios.find((a) => a.id === id);
    const material =
      c && c.kind === "video" ? Math.max(DURA_MANUAL_MIN, c.outSec - c.inSec) : durBase;
    return { minDur: DURA_MANUAL_MIN, maxDur: Math.min(material, durBase) };
  };

  // régua de segundos com passo adaptado ao que CABE NUMA TELA (2 min com marca
  // a cada 5s viraria uma parede de 24 números; já com zoom 8 sobra espaço pra
  // marcar de segundo em segundo)
  const escala = zoom > 0 ? durBase / zoom : durBase;
  const passoTick =
    escala > 90 ? 15 : escala > 45 ? 10 : escala > 20 ? 5 : escala > 8 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = 0; t < durBase - passoTick / 2; t += passoTick) ticks.push(t);

  function segDoEvento(e: ReactPointerEvent<HTMLElement>) {
    const r = faixaRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return null;
    return Math.max(0, Math.min(((e.clientX - r.left) / r.width) * durBase, durBase));
  }

  /**
   * Quanto o dedo está ADIANTE da agulha, medido quando o gesto começou.
   * Na régua é sempre 0 (tocou, a agulha vai pro dedo); pegando a cabeça é a
   * folga do toque, pra a agulha não dar um pulo de alguns pixels ao ser pega.
   */
  const scrubFolga = useRef(0);

  /** esfregar a agulha: vale na régua de segundos E no bloco do vídeo base */
  const scrubHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const t = segDoEvento(e);
      if (t === null) return;
      scrub.current = true;
      scrubFolga.current = 0;
      e.currentTarget.setPointerCapture(e.pointerId);
      onSeek(Number(t.toFixed(2)));
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (!scrub.current) return;
      const t = segDoEvento(e);
      if (t === null) return;
      const alvo = Math.max(0, Math.min(t - scrubFolga.current, durBase));
      onSeek(Number(alvo.toFixed(2)));
    },
    onPointerUp: () => {
      scrub.current = false;
    },
    onPointerCancel: () => {
      scrub.current = false;
    },
  };

  /**
   * A CABEÇA da agulha (dono, 11/08/2026): o mesmo esfregar, mas pegando a
   * bolinha. Diferente da régua, aqui o toque NÃO teleporta a agulha pro dedo -
   * ela sai de onde está, senão pegar pra ajustar meio segundo já jogaria a
   * prévia pro pixel encostado.
   */
  const agulhaHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const t = segDoEvento(e);
      if (t === null) return;
      e.stopPropagation();
      scrub.current = true;
      scrubFolga.current = t - Math.max(0, Math.min(tGlobal, durBase));
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: scrubHandlers.onPointerMove,
    onPointerUp: scrubHandlers.onPointerUp,
    onPointerCancel: scrubHandlers.onPointerCancel,
  };

  /**
   * ARRASTAR A FAIXA pelo bloco do vídeo base (dono, 11/08/2026).
   *
   * Com zoom, a faixa é mais larga que a tela e no celular não havia como
   * andar por ela: as duas linhas são `touch-none` (o dedo nelas é gesto de
   * edição, não rolagem do navegador), então a única forma de mudar de pedaço
   * era esfregar a agulha até a borda. Agora o bloco "Vídeo base" é a alça de
   * arrastar: o dedo puxa a faixa como se fosse a película do filme.
   *
   * Sem zoom não há pra onde andar, então lá ele continua esfregando a agulha.
   * E arrastar menos de 4px é toque, não arrasto: cai no seek de sempre.
   */
  const arrastandoFaixa = useRef<{ x0: number; scroll0: number; andou: boolean } | null>(
    null,
  );
  const panHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      const box = rolagemRef.current;
      if (e.button !== 0 || !box) return;
      arrastandoFaixa.current = { x0: e.clientX, scroll0: box.scrollLeft, andou: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const a = arrastandoFaixa.current;
      const box = rolagemRef.current;
      if (!a || !box) return;
      const dx = e.clientX - a.x0;
      if (!a.andou && Math.abs(dx) < 4) return;
      a.andou = true;
      // `clientX` é da tela, não da faixa: mesmo com a faixa andando por baixo
      // do dedo, o deslocamento medido continua sendo o do dedo
      box.scrollLeft = a.scroll0 - dx;
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const a = arrastandoFaixa.current;
      arrastandoFaixa.current = null;
      if (!a || a.andou) return;
      const t = segDoEvento(e);
      if (t !== null) onSeek(Number(t.toFixed(2)));
    },
    onPointerCancel: () => {
      arrastandoFaixa.current = null;
    },
  };

  /**
   * Com zoom, a faixa é maior que a tela: a janela precisa SEGUIR a agulha,
   * senão dar play com zoom 4 mostra um pedaço parado do vídeo. Ao trocar o
   * zoom a agulha vira o centro (o ponto que a pessoa estava olhando não foge);
   * tocando, a janela só empurra quando a agulha chega perto da borda.
   */
  const zoomAnterior = useRef(zoom);
  useEffect(() => {
    const box = rolagemRef.current;
    const faixa = faixaRef.current;
    if (!box || !faixa) return;
    const trocouZoom = zoomAnterior.current !== zoom;
    zoomAnterior.current = zoom;
    const maxScroll = box.scrollWidth - box.clientWidth;
    if (maxScroll <= 1) return;
    // o dedo está puxando a faixa: quem manda na rolagem é ele, não a agulha
    if (arrastandoFaixa.current) return;
    // a agulha em coordenada de ROLAGEM (medida, não calculada: a janela tem
    // um respiro nas laterais pra cabeça da agulha caber nas pontas)
    const rBox = box.getBoundingClientRect();
    const rFaixa = faixa.getBoundingClientRect();
    const fracao = durBase > 0 ? Math.max(0, Math.min(tGlobal / durBase, 1)) : 0;
    const x = rFaixa.left - rBox.left + box.scrollLeft + fracao * rFaixa.width;
    const janela = box.clientWidth;
    let alvo = box.scrollLeft;
    if (trocouZoom) {
      alvo = x - janela / 2;
    } else {
      const margem = Math.min(48, janela * 0.2);
      if (x < box.scrollLeft + margem) alvo = x - margem;
      else if (x > box.scrollLeft + janela - margem) alvo = x - janela + margem;
    }
    alvo = Math.max(0, Math.min(alvo, maxScroll));
    // sem `smooth`: rolagem animada a cada quadro do play vira tremida
    if (Math.abs(alvo - box.scrollLeft) > 1) box.scrollLeft = alvo;
  }, [tGlobal, zoom, durBase]);

  // a cena selecionada (o painel de ajustes finos embaixo é dela)
  const iSel = marcasApoio.findIndex((m) => m.id === selecionada);
  const mSel = iSel >= 0 ? marcasApoio[iSel] : null;
  const cSel = mSel ? apoios.find((a) => a.id === mSel.id) : undefined;
  const limSel = mSel ? limitesDe(mSel.id) : null;
  // o campo de tamanho não deixa a cena invadir a SEGUINTE (o mesmo ímã do
  // arrasto, na versão de digitar): cresce até ela, ou até o fim do vídeo
  const proxSel = iSel >= 0 ? marcasApoio[iSel + 1] : undefined;
  const tetoTamanhoSel =
    mSel && limSel
      ? Math.max(
          limSel.minDur,
          Math.min(limSel.maxDur, (proxSel ? proxSel.entra : durBase) - mSel.entra),
        )
      : 0;
  const fimSel = mSel ? Math.min(durBase, mSel.entra + mSel.dur) : 0;
  // onde o pedaço começa DENTRO do arquivo: a mesma conta do `_inicio_apoio` da
  // fábrica (e do overlay da prévia), pra prévia e render mostrarem o mesmo
  const iniTrechoSel =
    mSel && cSel
      ? Math.max(
          cSel.inSec,
          Math.min(
            cSel.trecho ?? cSel.inSec,
            Math.max(cSel.inSec, cSel.outSec - mSel.dur),
          ),
        )
      : 0;

  return (
    <div className="space-y-2">
      {/* A JANELA. Com zoom > 1 a faixa fica mais larga que ela e rola pros
          lados; a agulha é seguida sozinha (ver o efeito lá em cima). O
          `px-3.5` é respiro: a cabeça da agulha passa 14px de cada lado da
          faixa e, sem ele, nas pontas do vídeo ela ficaria cortada (ou geraria
          uma rolagem fantasma de 14px). */}
      <div
        ref={rolagemRef}
        className="overflow-x-auto overscroll-x-contain px-3.5 pb-1"
      >
        <div
          ref={faixaRef}
          className="relative select-none"
          style={{ width: `${zoom * 100}%` }}
        >
          {/* régua de segundos: tocar/arrastar leva a prévia praquele ponto */}
          <div
            {...scrubHandlers}
            className="relative h-5 cursor-col-resize touch-none"
            title="Toque ou arraste pra levar a prévia praquele ponto do vídeo."
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 text-[9px] tabular-nums text-muted-foreground"
                style={{ left: pct(t) }}
              >
                {t}s
              </span>
            ))}
            <span className="absolute right-0 top-0 text-[9px] tabular-nums text-muted-foreground">
              {fmt(durBase)}
            </span>
            {ticks.map((t) => (
              <span
                key={`r${t}`}
                className="absolute bottom-0 h-1.5 w-px bg-border"
                style={{ left: pct(t) }}
              />
            ))}
          </div>

          {/* linha 1: as CENAS DE APOIO, cada bloco com a MINIATURA da mídia, no
              segundo em que cobre a base (dono, 11/08/2026: apoio em cima) */}
          <div
            className="relative mt-0.5 h-12 rounded-md bg-muted/50"
            onPointerDown={(e) => {
              // toque no vazio da linha só desfaz a seleção (mover é no bloco)
              if (e.target === e.currentTarget) onSelecionar(null);
            }}
          >
            {marcasApoio.map((m, i) => {
              const c = apoios.find((a) => a.id === m.id);
              const lim = limitesDe(m.id);
              const alca = (lado: "esq" | "dir") => ({
                onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
                  // sem isso o bloco (pai) também começaria um gesto de mover
                  e.stopPropagation();
                  arraste.descer(e, { ...m, ...lim }, outrasDe(m.id), lado);
                },
                onPointerMove: arraste.mover,
                onPointerUp: arraste.subir,
                onPointerCancel: arraste.subir,
              });
              return (
                <button
                  key={m.id}
                  type="button"
                  // arrastar move; TOCAR (sem arrastar) seleciona e leva a prévia
                  // pro momento da cena, mostrando o que ela cobre
                  onClick={() => {
                    if (arraste.arrastou()) return;
                    onSelecionar(m.id);
                    onSeek(m.entra + 0.01);
                  }}
                  onPointerDown={(e) => arraste.descer(e, { ...m, ...lim }, outrasDe(m.id))}
                  onPointerMove={arraste.mover}
                  onPointerUp={arraste.subir}
                  onPointerCancel={arraste.subir}
                  className={cn(
                    "absolute inset-y-1 grid touch-none place-items-center overflow-hidden rounded border text-[9px] font-medium",
                    m.auto
                      ? "border-primary/50 bg-primary/40 text-primary-foreground"
                      : "border-amber-400/60 bg-amber-400/40 text-amber-950",
                    selecionada === m.id && "z-10 ring-2 ring-foreground/80",
                    "cursor-grab active:cursor-grabbing",
                  )}
                  style={{ left: pct(m.entra), width: pct(m.dur), minWidth: 18 }}
                  title={`Cena ${i + 1}: entra em ${m.entra.toFixed(1)}s e fica ${m.dur.toFixed(1)}s. Arraste pra mover; alças nas pontas mudam o tamanho; toque pra selecionar.`}
                >
                  {/* a MINIATURA da mídia preenche o bloco; o vídeo usa #t= pra
                      mostrar o quadro do pedaço escolhido (muda junto com a faixa
                      de corte, porque o src muda) */}
                  <span className="pointer-events-none absolute inset-0">
                    {c &&
                      (c.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.url} alt="" className="size-full object-cover" />
                      ) : (
                        <video
                          src={`${c.url}#t=${((c.trecho ?? c.inSec) + 0.1).toFixed(2)}`}
                          muted
                          playsInline
                          preload="metadata"
                          className="size-full object-cover"
                        />
                      ))}
                  </span>
                  <span className="pointer-events-none absolute left-0.5 top-0.5 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[8px] font-semibold text-white">
                    {c?.kind === "image" ? (
                      <ImageIcon className="size-2.5" />
                    ) : (
                      <VideoIcon className="size-2.5" />
                    )}
                    {i + 1}
                  </span>
                  <span
                    {...alca("esq")}
                    className="absolute inset-y-0 left-0 w-2 cursor-ew-resize border-r border-background/50 bg-background/40"
                    title="Arraste pra mudar quando a cena começa (o fim fica no lugar)"
                  />
                  <span
                    {...alca("dir")}
                    className="absolute inset-y-0 right-0 w-2 cursor-ew-resize border-l border-background/50 bg-background/40"
                    title="Arraste pra mudar quanto tempo a cena fica na tela"
                  />
                </button>
              );
            })}
          </div>

          {/* linha 2: o VÍDEO BASE, um bloco só (dono, 11/08/2026: os nomes de
              arquivo eram ruído). SEM zoom ele esfrega a agulha; COM zoom ele
              vira a alça de arrastar a faixa (ver `panHandlers`), que é a única
              forma de andar pela linha do tempo no celular - o toque simples
              continua levando a prévia praquele ponto nos dois casos. */}
          <div
            {...(zoom > 1 ? panHandlers : scrubHandlers)}
            className={cn(
              "relative mt-1 flex h-8 touch-none select-none items-center justify-center gap-1 overflow-hidden rounded-md border border-primary/40 bg-primary/25",
              zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-col-resize",
            )}
            title={`Vídeo base: ${
              principais.length === 1
                ? "o seu vídeo com fala"
                : `${principais.length} vídeos com fala, emendados na ordem da etapa Mídias`
            }. ${
              zoom > 1
                ? "Arraste pros lados pra andar pela linha do tempo; toque pra levar a prévia praquele ponto"
                : "Toque ou arraste pra levar a prévia praquele ponto"
            }; cortar ou trocar a ordem é na etapa Mídias.`}
          >
            <span className="pointer-events-none flex items-center gap-1 text-[10px] font-semibold text-primary">
              {zoom > 1 && <ChevronLeft className="size-3" />}
              Vídeo base
              {zoom > 1 && <ChevronRight className="size-3" />}
            </span>
          </div>

          {/* a agulha: onde a prévia está, atravessando as duas linhas */}
          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-400"
            style={{ left: pct(tGlobal) }}
          >
            {/* A CABEÇA é o único pedaço PEGÁVEL da agulha (dono, 11/08/2026):
                alvo de 28px pro dedo, com a bolinha desenhada dentro. Antes só
                dava pra mover a agulha acertando a régua de segundos, que tem
                20px de altura e no celular é um alvo minúsculo. */}
            <span
              {...agulhaHandlers}
              className="pointer-events-auto absolute -left-3.5 top-0 flex h-7 w-7 cursor-col-resize touch-none items-start justify-center"
              title="Arraste a bolinha pra levar a prévia praquele ponto do vídeo."
            >
              <span className="mt-px size-3.5 rounded-full border-2 border-background bg-red-400 shadow-sm" />
            </span>
          </div>
        </div>
      </div>

      {/* ZOOM: no celular a linha do tempo inteira cabe em ~300px, então uma
          cena de 2s vira um risquinho de 10px que não dá pra pegar. Esticar a
          faixa é a única saída - encolher os blocos não é opção, eles TÊM que
          ficar no segundo certo.

          Os botões são de 48px (dono, 11/08/2026: em 32px o dedo errava). Não
          é enfeite: 48px é o alvo que a mão fecha sem mirar, e esta barra é
          justamente a que se usa DE DEDO, no meio do ajuste fino. */}
      <div className="flex items-stretch justify-center gap-2">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z / 2))}
          disabled={zoom <= 1}
          className="grid size-12 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors active:bg-muted disabled:opacity-40"
          title="Ver mais tempo de uma vez"
          aria-label="Diminuir o zoom da linha do tempo"
        >
          <ZoomOut className="size-5" />
        </button>
        <span className="grid h-12 w-14 place-items-center rounded-lg border border-border bg-muted/40 text-sm font-semibold tabular-nums">
          {zoom}×
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 2))}
          disabled={zoom >= ZOOM_MAX}
          className="grid size-12 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors active:bg-muted disabled:opacity-40"
          title="Esticar a linha do tempo pra acertar os segundos com o dedo"
          aria-label="Aumentar o zoom da linha do tempo"
        >
          <ZoomIn className="size-5" />
        </button>
        {zoom > 1 && (
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="h-12 rounded-lg border border-border bg-card px-3 text-xs font-medium text-primary transition-colors active:bg-muted"
            title="Volta a mostrar o vídeo inteiro de uma vez"
          >
            ver tudo
          </button>
        )}
      </div>

      {/* Painel da cena selecionada: os ajustes finos moram aqui.

          O `flex-wrap` com largura mínima na coluna de texto é por causa da
          prévia de 192px: num celular estreito não sobra espaço pros campos de
          segundo do lado dela, então eles descem pra linha de baixo em vez de
          virar uma coluna de 100px com tudo quebrado.

          O `justify-center` só aparece QUANDO quebra (dono, 12/08/2026): aí a
          prévia fica sozinha na primeira linha e, encostada na esquerda, deixava
          um vão morto do lado direito. Lado a lado ele não muda nada, porque a
          coluna de texto é `flex-1` e come a sobra toda. Fica assim em vez de um
          `sm:` porque a quebra depende da largura do PAINEL, não da da tela. */}
      {mSel && cSel && limSel ? (
        <div className="flex flex-wrap justify-center gap-3 rounded-lg border border-primary/40 bg-muted/30 p-3">
          {/* A PRÉVIA do pedaço, na ESQUERDA (dono, 11/08/2026): até aqui o
              pedaço se escolhia olhando uma barrinha e dois números, sem nunca
              ver o que ia aparecer na tela. */}
          {/* `key`: trocar de cena reinicia a prévia em vez de reaproveitar o
              <video> da anterior (que voltaria tocando o arquivo novo) */}
          <PreviaTrecho
            key={cSel.id}
            cena={cSel}
            ini={iniTrechoSel}
            dur={mSel.dur}
            entra={mSel.entra}
          />
          {/* Tudo aqui é de DEDO (dono, 11/08/2026): o painel nasceu em 10px,
              tamanho de rodapé, e é justamente onde se digita segundo e se
              acerta o pedaço no celular. Texto em 12-14px e alvos de 40px. */}
          <div className="min-w-[12rem] flex-1 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              {cSel.kind === "image" ? (
                <ImageIcon className="size-4 shrink-0 text-primary" />
              ) : (
                <VideoIcon className="size-4 shrink-0 text-primary" />
              )}
              <span
                className="min-w-0 flex-1 truncate font-semibold"
                title={cSel.descricao.trim() || cSel.file.name}
              >
                Cena {iSel + 1}
                <span className="ml-1 font-normal text-muted-foreground">
                  {cSel.descricao.trim() || cSel.file.name}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onIrParaCena(mSel.id)}
                className="-my-2 shrink-0 rounded-md px-2 py-2.5 text-xs font-medium text-primary hover:underline"
                title="Volta pra etapa Mídias com essa cena em destaque (descrição e corte)"
              >
                abrir nas mídias
              </button>
            </div>
            {/* os campos de segundo: `h-10` e 14px porque é o que o celular
                abre teclado numérico pra digitar - e em 10px a pessoa não lia
                o que tinha acabado de escrever */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs tabular-nums text-muted-foreground">
              <span className="flex items-center gap-1.5">
                entra em
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={Math.max(0, durBase - mSel.dur)}
                  value={mSel.entra.toFixed(1)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      onGeo(mSel.id, {
                        entra: Math.max(0, Math.min(v, Math.max(0, durBase - mSel.dur))),
                      });
                    }
                  }}
                  aria-label={`Segundo em que a cena ${iSel + 1} entra`}
                  className="h-10 w-20 rounded-md border border-border bg-background px-2 text-right text-sm font-medium tabular-nums text-foreground outline-none focus:border-primary"
                />
                s
              </span>
              <span className="flex items-center gap-1.5">
                fica
                <input
                  type="number"
                  step="0.1"
                  min={limSel.minDur}
                  max={tetoTamanhoSel}
                  value={mSel.dur.toFixed(1)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) {
                      onGeo(mSel.id, {
                        dura: Math.max(limSel.minDur, Math.min(v, tetoTamanhoSel)),
                      });
                    }
                  }}
                  aria-label={`Segundos que a cena ${iSel + 1} fica na tela`}
                  className="h-10 w-20 rounded-md border border-border bg-background px-2 text-right text-sm font-medium tabular-nums text-foreground outline-none focus:border-primary"
                />
                s na tela
                {cSel.dura != null && (
                  <button
                    type="button"
                    onClick={() => onGeo(mSel.id, { dura: null })}
                    className="h-10 rounded-md px-2 font-medium text-primary hover:underline"
                    title="Apaga o tamanho escolhido na mão e volta pra regra automática (foto 1-3s, vídeo 2-4s)"
                  >
                    auto
                  </button>
                )}
              </span>
              <span>
                ({mSel.entra.toFixed(1)}s a {fimSel.toFixed(1)}s)
              </span>
            </div>
            {/* a faixa de CORTE: só em vídeo com material sobrando no corte */}
            {cSel.kind === "video" && cSel.outSec - cSel.inSec - mSel.dur > 0.2 && (
              <FaixaTrecho cena={cSel} dur={mSel.dur} onTrecho={onTrecho} />
            )}
          </div>
        </div>
      ) : marcasApoio.length > 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Toque numa cena (os blocos com miniatura) pra ajustar o momento, o
          tamanho e o pedaço dela; arraste pra mover. As cenas não se sobrepõem:
          o bloco encosta na vizinha e para. Bloco pequeno demais pra pegar? Use
          o zoom aqui embaixo
          {zoom > 1 && (
            <>
              {" "}
              - e arraste a barra <b className="text-foreground">Vídeo base</b> pros
              lados pra andar pela linha do tempo
            </>
          )}
          .
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma cena de apoio entra: o vídeo é só o clipe principal.
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Total: <b className="text-foreground">{fmt(durBase)}</b>. As cenas de apoio
        substituem trechos da sua imagem, então elas não somam tempo.
      </p>
    </div>
  );
}

/**
 * A lista de clipes da etapa 3 (montar) - e, desde 06/08/2026, a ÚNICA lista de
 * cenas da tela: montar, descrever e escolher o momento acontecem tudo aqui.
 * Antes a etapa 5 repetia essa lista numa versão só de leitura (`RevisaoCenas`),
 * com o mesmo campo de descrição em outro lugar; a pessoa preenchia num e
 * estranhava o outro.
 */
function ListaClipes({
  clips,
  todos,
  sel,
  modoPrincipal,
  principais,
  apoios,
  cabemApoios,
  marcasApoio,
  escondeEstrela = false,
  pendentes,
  descreviveis,
  analisandoCena,
  ocupadoAnalise,
  destacado,
  refs,
  onSelecionar,
  onAlternarPrincipal,
  onMover,
  onRemover,
  onDescricao,
  onDescreverIA,
}: {
  clips: Clip[];
  /** a lista COMPLETA: os índices de seleção e de mover são dela */
  todos: Clip[];
  sel: number;
  modoPrincipal: boolean;
  principais: Clip[];
  apoios: Clip[];
  cabemApoios: number;
  /** só pra saber QUEM entrou no vídeo: o segundo de cada uma é da etapa 5 */
  marcasApoio: { id: string; entra: number; dur: number; auto: boolean }[];
  escondeEstrela?: boolean;
  /** ids das cenas que estão sem descrição e precisam de uma */
  pendentes: Set<string>;
  /** ids das cenas com direito ao botão de descrever com IA (uma por vez) */
  descreviveis: Set<string>;
  /** id da cena sendo descrita sozinha agora (mostra o spinner nela) */
  analisandoCena: string | null;
  /** alguma análise rodando (lote ou cena): desliga os botões de varinha */
  ocupadoAnalise: boolean;
  /** cena apontada pela régua da aprovação (destaque passageiro) */
  destacado: string | null;
  refs: React.RefObject<Record<string, HTMLLIElement | null>>;
  onSelecionar: (i: number) => void;
  onAlternarPrincipal: (id: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onRemover: (id: string) => void;
  onDescricao: (id: string, v: string) => void;
  onDescreverIA: (id: string) => void;
}) {
  if (!clips.length) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        Nenhuma mídia aqui ainda.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {clips.map((c) => {
        const i = todos.findIndex((x) => x.id === c.id);
        const pendente = pendentes.has(c.id);
        return (
          <li
            key={c.id}
            ref={(el) => {
              refs.current[c.id] = el;
            }}
            className={cn(
              "rounded-lg border bg-card p-1.5 transition-all duration-300",
              i === sel ? "border-primary" : "border-border",
              c.papel === "principal" && "border-primary/70 bg-primary/5",
              destacado === c.id &&
                "border-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-background",
            )}
          >
            <div className="flex items-center gap-2">
              {/* miniatura em size-20 (06/08/2026): em 48px não dava pra saber
                  qual cena era qual sem abrir o player */}
              <button
                type="button"
                onClick={() => onSelecionar(i)}
                className="relative size-20 shrink-0 overflow-hidden rounded-md bg-black"
              >
                {c.kind === "video" ? (
                  <video
                    src={`${c.url}#t=${(c.trecho ?? c.inSec) + 0.3}`}
                    muted
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.url} alt="" className="size-full object-cover" />
                )}
                <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
                  {i + 1}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{c.file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {c.kind === "video" ? "Vídeo" : "Imagem"} · {fmt(c.outSec - c.inSec)}
                  {c.papel === "principal" && (
                    <b className="ml-1 text-primary">
                      · principal{" "}
                      {principais.length > 1 &&
                        `${principais.findIndex((p) => p.id === c.id) + 1}º`}
                    </b>
                  )}
                  {modoPrincipal && c.papel === "apoio" && (
                    <span className="ml-1">
                      · fica{" "}
                      {duracaoApoio({ tipo: c.kind, in: c.inSec, out: c.outSec, dura: c.dura }).toFixed(1)}s
                      na tela
                    </span>
                  )}
                </p>
              </div>
              {c.kind === "video" && !escondeEstrela && (
                <button
                  type="button"
                  onClick={() => onAlternarPrincipal(c.id)}
                  className="shrink-0"
                  title={
                    c.papel === "principal"
                      ? "Deixar de ser o clipe principal"
                      : "Usar como clipe principal (roda por baixo, com o som dele)"
                  }
                  aria-label="Clipe principal"
                >
                  <Star
                    className={cn(
                      "size-4",
                      c.papel === "principal"
                        ? "fill-primary text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  />
                </button>
              )}
              {/* com principais, as setas ordenam a BASE (quem toca primeiro).
                  Nos apoios elas somem: neles o que manda é o momento. */}
              {(!modoPrincipal || c.papel === "principal") && (
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => onMover(i, -1)}
                    disabled={i === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Subir"
                  >
                    <ChevronLeft className="size-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMover(i, 1)}
                    disabled={
                      modoPrincipal ? i + 1 >= principais.length : i === todos.length - 1
                    }
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Descer"
                  >
                    <ChevronRight className="size-4 rotate-90" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemover(c.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            {/* Descrever a cena: é assim que a IA sabe O QUE tem nesse clipe, pra
                encaixar no trecho certo da fala e pra copy falar do que está na
                tela. O PRINCIPAL também tem (06/08/2026): a transcrição conta o
                que é falado, não o que está na imagem, então quem escreve "eu
                mostrando a etiqueta" dá uma pista que a fala não dá. Nele o
                campo é opcional e nunca é preenchido pela IA. */}
            <>
              {/* Textarea (era Input de linha única com 160): descrição boa tem
                  mais de uma frase, e sem quebra de linha ela virava um trem
                  ilegível. A varinha do lado descreve SÓ esta cena com IA. */}
              <div className="mt-1.5 flex items-start gap-1.5">
                <Textarea
                  value={c.descricao}
                  onChange={(e) => onDescricao(c.id, e.target.value)}
                  maxLength={640}
                  rows={2}
                  placeholder={
                    c.papel === "principal"
                      ? "O que aparece no vídeo (ex: ela mostrando o tênis na câmera)"
                      : "O que aparece aqui (ex: close no tecido da blusa)"
                  }
                  className={cn(
                    "min-h-0 flex-1 text-xs",
                    pendente && "border-amber-500/60",
                    c.descricaoIA && "border-primary/50",
                  )}
                />
                {descreviveis.has(c.id) && (
                  <button
                    type="button"
                    onClick={() => onDescreverIA(c.id)}
                    disabled={ocupadoAnalise}
                    title={`Descrever com IA (${CREDITOS_FIXO.analiseCena} crédito)`}
                    aria-label="Descrever esta cena com IA (1 crédito)"
                    className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-primary transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {analisandoCena === c.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                  </button>
                )}
              </div>
              {c.descricaoIA ? (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-primary">
                  <Wand2 className="size-3" />
                  escrito pela IA
                  {c.trecho !== null && ` · mostra a partir de ${c.trecho.toFixed(1)}s`}
                  . Pode corrigir.
                </p>
              ) : pendente ? (
                <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-500">
                  <Info className="size-3 shrink-0" />
                  Sem descrição: é disto que a IA precisa pra saber onde encaixar a cena.
                </p>
              ) : null}
            </>

            {modoPrincipal && c.papel === "apoio" && (
              <AvisoApoio
                clip={c}
                cabe={marcasApoio.some((m) => m.id === c.id)}
                excedente={apoios.findIndex((a) => a.id === c.id) >= cabemApoios}
                cabem={cabemApoios}
              />
            )}
          </li>
        );
      })}
    </ul>
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

/**
 * Velocidade da música. O tom é mantido nos dois lados (na prévia pelo
 * `preservesPitch` do navegador, no render pelo time-stretch do ffmpeg), então
 * mudar a velocidade só muda o andamento: não fica com cara de acelerado.
 */
function VelocidadeMusica({
  valor,
  onChange,
  temPreview,
}: {
  valor: number;
  onChange: (v: number) => void;
  temPreview: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Gauge className="size-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">Velocidade da música</p>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {VELOCIDADES_MUSICA.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "rounded-md border px-1 py-1.5 text-xs font-medium tabular-nums transition-colors",
              v === valor
                ? "border-primary bg-primary/12 text-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {v.toLocaleString("pt-BR")}x
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        O tom da música é mantido: só o andamento muda, sem ficar com voz de desenho.
        {temPreview
          ? " Dê o play na prévia pra ouvir."
          : " Suba a sua música pra ouvir na prévia."}
        {valor < 0.5 &&
          " Abaixo de 0,5x alguns navegadores não tocam a prévia, mas no vídeo final funciona."}
      </p>
    </div>
  );
}

/** Um controle de volume da mixagem (mexeu, ouve na hora na prévia). */
function ControleVolume({
  icon: Icon,
  label,
  valor,
  dica,
  max = 100,
  onChange,
}: {
  icon: typeof Volume2;
  label: string;
  valor: number;
  dica: string;
  /** 150 nas faixas que aceitam amplificar (som do vídeo e narração). */
  max?: number;
  onChange: (v: number) => void;
}) {
  const amplificando = valor > 100;
  return (
    <div>
      <div className="flex items-center gap-3">
        <Icon className="size-4 shrink-0 text-primary" />
        <input
          type="range"
          min={0}
          max={max}
          value={valor}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-primary"
          aria-label={label}
        />
        <span
          className={cn(
            "w-11 text-right text-xs tabular-nums",
            amplificando ? "font-semibold text-primary" : "text-muted-foreground",
          )}
        >
          {valor}%
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {dica}
        {max > 100 &&
          (amplificando
            ? " Acima de 100% a gente amplifica o som, com proteção pra não estourar."
            : " Dá pra passar de 100% se a gravação ficou baixa.")}
      </p>
    </div>
  );
}

/**
 * O que há de errado com esse clipe de apoio: ele passou do limite de cenas,
 * ficou longo demais ou não cabe no tempo do principal. Sem nada disso, não
 * desenha nada.
 *
 * O controle de MOMENTO saiu daqui (dono, 06/08/2026). Nesta etapa a IA ainda
 * não ouviu a fala, então o segundo mostrado era de reserva e a barrinha
 * desenhava um lugar que o render ia trocar sozinho. Quem escolhe o segundo
 * agora é a etapa Aprovar cenas, onde os tempos já são os finais e cada cena
 * tem a régua dela.
 */
function AvisoApoio({
  clip,
  cabe,
  excedente,
  cabem,
}: {
  clip: Clip;
  /** essa cena entrou na linha do tempo da base? (ver `planejarApoios`) */
  cabe: boolean;
  /** passou da conta de 1 cena a cada `SEG_POR_APOIO` segundos do principal */
  excedente: boolean;
  cabem: number;
}) {
  const longo = clip.outSec - clip.inSec > MAX_APOIO_SEG;

  if (excedente) {
    return (
      <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] text-amber-500">
        Passou do limite de {cabem} {cabem === 1 ? "cena" : "cenas"} de apoio (1 a cada{" "}
        {SEG_POR_APOIO}s do principal). Esse clipe fica de fora: apague ele ou use um
        principal mais longo.
      </p>
    );
  }
  if (!longo && cabe) return null;

  return (
    <div className="mt-1.5 space-y-1 border-t border-border/60 pt-1.5">
      {longo && (
        <p className="text-[11px] text-amber-500">
          Cena de apoio aceita no máximo {MAX_APOIO_SEG / 60} minuto. Corte esse clipe
          com as alças verdes, embaixo da prévia, pra poder gerar.
        </p>
      )}
      {!cabe && (
        <p className="text-[11px] text-amber-500">
          Não cabe no tempo do principal: esse clipe ficaria de fora do vídeo.
        </p>
      )}
    </div>
  );
}

function AddMidia({
  onPick,
  label = "Adicionar",
}: {
  onPick: (l: FileList | null) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()}>
        <Plus className="size-4" />
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** Bloco de um texto: conteúdo + posição + tempo (in/out na linha geral). */
function TextoBloco({
  texto,
  posicoes,
  totalDur,
  tGlobal,
  onUpd,
  onTempo,
  onRemover,
}: {
  texto: Texto;
  /** já vêm renomeadas conforme a posição da legenda (ver `posicoesTexto`) */
  posicoes: readonly SegOption<Posicao>[];
  totalDur: number;
  tGlobal: number;
  onUpd: (patch: Partial<Texto>) => void;
  onTempo: (qual: "in" | "out", valor: number) => void;
  onRemover: () => void;
}) {
  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <Textarea
          rows={2}
          placeholder="Texto que aparece no vídeo..."
          value={texto.conteudo}
          onChange={(e) => onUpd({ conteudo: e.target.value })}
          className="flex-1"
        />
        <button
          type="button"
          onClick={onRemover}
          className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Remover texto"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <Segmented
        options={posicoes}
        value={texto.pos}
        onChange={(v) => onUpd({ pos: v as Posicao })}
      />

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3.5 text-primary" />
        aparece de <b className="text-foreground">{texto.inSec.toFixed(1)}s</b> a{" "}
        <b className="text-foreground">{texto.outSec.toFixed(1)}s</b>
      </div>
      <TrilhaCorte
        dur={Math.max(totalDur, 0.1)}
        inSec={texto.inSec}
        outSec={Math.min(texto.outSec, Math.max(totalDur, 0.1))}
        tempo={tGlobal}
        onChange={onTempo}
      />
    </div>
  );
}

/** Trilha com 2 alças (in/out) + playhead. Reaproveitada pra corte e pra tempo de texto. */
function TrilhaCorte({
  dur,
  inSec,
  outSec,
  tempo,
  onChange,
  onScrub,
}: {
  dur: number;
  inSec: number;
  outSec: number;
  tempo?: number;
  onChange: (qual: "in" | "out", valor: number) => void;
  onScrub?: (t: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<null | "in" | "out">(null);

  const pct = (s: number) => `${Math.max(0, Math.min(100, (s / dur) * 100))}%`;

  function posDoEvento(clientX: number) {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return x * dur;
  }

  function onDown(qual: "in" | "out", e: React.PointerEvent) {
    e.preventDefault();
    arrasto.current = qual;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!arrasto.current) return;
    onChange(arrasto.current, posDoEvento(e.clientX));
  }
  function onUp() {
    arrasto.current = null;
  }

  return (
    <div
      ref={trackRef}
      className="relative h-9 select-none rounded-lg bg-muted"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onClick={(e) => {
        if (!arrasto.current && onScrub) onScrub(posDoEvento(e.clientX));
      }}
    >
      <div
        className="absolute inset-y-0 rounded-lg bg-primary/20"
        style={{ left: pct(inSec), right: `calc(100% - ${pct(outSec)})` }}
      />
      {tempo !== undefined && (
        <div
          className="absolute inset-y-1 w-0.5 bg-white/80"
          style={{ left: pct(tempo) }}
        />
      )}
      {/* as alças têm 20px e são centradas no ponto, então nas pontas do clipe
          elas sobrariam 10px pra fora da trilha - e o que sobra pra fora vira
          rolagem lateral da PÁGINA no celular. O `clamp` estaciona a alça
          rente à borda em vez de deixar ela vazar. */}
      <button
        type="button"
        onPointerDown={(e) => onDown("in", e)}
        className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded bg-primary text-primary-foreground shadow"
        style={{ left: `clamp(10px, ${pct(inSec)}, calc(100% - 10px))` }}
        aria-label="Início"
      >
        <ChevronRight className="size-3" />
      </button>
      <button
        type="button"
        onPointerDown={(e) => onDown("out", e)}
        className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded bg-primary text-primary-foreground shadow"
        style={{ left: `clamp(10px, ${pct(outSec)}, calc(100% - 10px))` }}
        aria-label="Fim"
      >
        <ChevronLeft className="size-3" />
      </button>
    </div>
  );
}
