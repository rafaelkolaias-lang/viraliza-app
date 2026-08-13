"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Plus,
  Film,
  Trash2,
  Scissors,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Lock,
  Volume2,
  VolumeX,
  Music,
  Type,
  Layers,
  Package,
  Info,
  Clock,
  Star,
  Mic,
  Wand2,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/app/segmented";
import { MediaPicker } from "@/components/app/media-picker";
import { cn } from "@/lib/utils";
import { estimarCreditos, CREDITOS_FIXO } from "@/lib/precos";
import {
  MAX_VIDEO_SEG,
  MAX_APOIO_SEG,
  MAX_ARQUIVO_MB,
  MAX_VOLUME_BOOST,
  SEG_POR_APOIO,
  SILENCIOS,
  VOLUMES_PADRAO,
  VELOCIDADES_MUSICA,
  VELOCIDADE_PADRAO,
  maxApoios,
  tamanhoEmMB,
} from "@/lib/montagem";
import { VOZES, VOZ_PADRAO, type VozOpcao } from "@/lib/vozes";
import { SeletorVoz } from "@/components/app/seletor-voz";

const FORMATOS = [
  { value: "legenda", label: "Legenda" },
  { value: "voz", label: "Voz narrada" },
  { value: "transcrever", label: "Transcrever fala" },
  { value: "nenhum", label: "Nenhum" },
] as const;

/**
 * O que a tela OFERECE quando "É um produto?" está no Sim (12/08/2026, pedido do
 * dono): o "Transcrever fala" saiu da lista.
 *
 * Este seletor só aparece no fluxo de produto, então na prática o formato deixou
 * de existir na tela. `FORMATOS` continua inteiro de propósito: o "Reutilizar"
 * pode trazer um vídeo ANTIGO que foi feito com "transcrever", e o tipo
 * `Formato` precisa continuar aceitando esse valor pra receber a config (o
 * efeito do `configInicial` converte pra "nenhum" na hora de abrir).
 *
 * O valor continua valendo no backend e no PRO: quem some é a opção aqui, não o
 * formato.
 */
const FORMATOS_PRODUTO = FORMATOS.filter((f) => f.value !== "transcrever");

// o que cada formato faz (aparece embaixo do seletor)
const FORMATO_NOTA: Record<string, string> = {
  legenda: "A IA escreve a copy e queima a legenda no vídeo.",
  voz: "A IA escreve a copy e narra com voz de IA.",
  transcrever:
    "Seu vídeo já tem fala? A gente transcreve o áudio e coloca a legenda no tempo certo da fala. O som original fica ligado.",
  nenhum: "Sem legenda e sem voz de IA: sai só a sua montagem, com o áudio e a música que você escolher.",
};
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

type Formato = (typeof FORMATOS)[number]["value"];
type Tom = (typeof TONS)[number]["value"];
type Plataforma = (typeof PLATAFORMAS)[number]["value"];
type Posicao = (typeof POSICOES)[number]["value"];

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
   * (é a pessoa falando). Só pode existir um, e só vídeo pode ser.
   * "apoio" = entra por cima, mudo, em tela cheia, e volta pro principal.
   */
  papel: "principal" | "apoio";
  /**
   * Apoio: em que segundo do principal ele entra. `null` = a IA escolhe olhando
   * a fala do principal (a tela mostra a distribuição de reserva enquanto isso).
   */
  entra: number | null;
  /** o que aparece nesse clipe, escrito pela pessoa (ex.: "close no tecido") */
  descricao: string;
};

type Texto = {
  id: string;
  conteudo: string;
  pos: Posicao;
  inSec: number; // na linha do tempo GERAL do vídeo
  outSec: number;
};

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
/** Quanto tempo um clipe de apoio pode ficar na tela (o render usa os mesmos limites). */
const APOIO_MIN = 0.8;
const APOIO_MAX = 6;

/** Quanto tempo esse apoio fica na tela, respeitando o corte que a pessoa fez. */
function durApoio(c: Clip) {
  return Math.max(APOIO_MIN, Math.min(APOIO_MAX, c.outSec - c.inSec));
}

/**
 * Onde cada apoio entra na linha do principal. Quem a pessoa arrastou manda; o
 * resto ganha a MESMA distribuição em intervalos iguais que o render usa quando
 * a IA não responde, pra prévia não mentir. Depois empurra pra frente o que
 * estiver sobreposto e derruba o que não couber, igual à fábrica.
 *
 * Só entram os primeiros apoios que cabem na regra de 1 cena a cada 10 segundos.
 */
function momentosApoios(todos: Clip[], durBase: number) {
  const apoios = todos.slice(0, maxApoios(durBase));
  const marcas = apoios.map((c, i) => ({
    id: c.id,
    dur: durApoio(c),
    entra: c.entra ?? (durBase * (i + 1)) / (apoios.length + 1),
    auto: c.entra === null,
  }));
  marcas.sort((a, b) => a.entra - b.entra);
  const saida: { id: string; entra: number; dur: number; auto: boolean }[] = [];
  let cursor = 0;
  for (const m of marcas) {
    const entra = Math.max(cursor, Math.min(m.entra, durBase));
    const dur = Math.min(m.dur, durBase - entra);
    if (dur < APOIO_MIN) continue;
    saida.push({ id: m.id, entra, dur, auto: m.auto });
    cursor = entra + dur;
  }
  return saida;
}

/**
 * EDITOR AUTOMÁTICO BASIC (trazido do branch `v3` do Lucas em 12/08/2026).
 *
 * No menu ele aparece ACIMA do PRO, escrito "Editor automático BASIC".
 *
 * É a tela ANTIGA do editor: tudo numa página só, palco de prévia à esquerda e
 * o painel de ajustes à direita, sem funil de etapas. Ela voltou a existir
 * porque o PRO (`editor-estudio.tsx`, funil de 5 etapas) pede que a pessoa
 * responda uma sequência de perguntas antes de ver a tela; quem já sabe o que
 * quer prefere o formulário inteiro de uma vez.
 *
 * As duas telas são DE PROPÓSITO arquivos separados, e não um componente com
 * uma prop `modo`: elas divergem no fluxo inteiro (o PRO tem descrição de cena,
 * análise por IA, posicionamento na linha do tempo e edição avançada, que aqui
 * não existem). Juntar as duas seria um `if` a cada dez linhas.
 *
 * O BACKEND É O MESMO: o `gerar()` daqui monta o mesmo `FormData` do PRO e
 * posta em `/api/jobs`. Os campos que o Basic não manda (`legendaEstilo`,
 * `edicao`, `roteiroFala`, `musicaNome`) têm padrão na rota, então nada quebra.
 * Se mexer no contrato de `/api/jobs`, conferir os DOIS editores.
 *
 * O que o Basic NÃO tem, e é decisão, não esquecimento:
 * - música da biblioteca da plataforma (só sobe a sua);
 * - IA descrever/posicionar as cenas de apoio (`/api/editor/*`);
 * - edição avançada (zoom, transição, melhor pedaço do apoio).
 */
export function EditorBasico({
  bloqueado = false,
  videoInicial,
  configInicial,
}: {
  bloqueado?: boolean;
  /** Vídeo já pronto que veio do "Editar esse vídeo" - carregado como 1º clipe. */
  videoInicial?: { url: string; nome: string };
  /** Ajustes de um vídeo anterior ("Reutilizar") - pré-preenche o formulário. */
  configInicial?: {
    nome: string;
    descricao: string;
    preco: string;
    formato: "legenda" | "voz" | "transcrever" | "nenhum";
    tom: string;
    legendaPos: string;
    voz?: string;
  };
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imgTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [clips, setClips] = useState<Clip[]>([]);
  const [sel, setSel] = useState(0);
  /** qual dos clipes principais está tocando na prévia (a base é a sequência deles) */
  const [idxBase, setIdxBase] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(0); // tempo dentro do clipe atual

  const [textos, setTextos] = useState<Texto[]>([]);

  // produto / IA (opcional)
  const [ehProduto, setEhProduto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [formato, setFormato] = useState<Formato>("legenda");
  // "Equilibrado" é o padrão (12/08/2026, pedido do dono): era "agressivo", que
  // é o tom mais forte dos três e saía escolhido pra quem nem olhou o seletor.
  const [tom, setTom] = useState<Tom>("equilibrado");
  const [plataforma, setPlataforma] = useState<Plataforma>("shopee");
  const [voz, setVoz] = useState<string>(VOZ_PADRAO);
  const [vozes, setVozes] = useState<VozOpcao[]>(VOZES);

  // áudio
  const [comMusica, setComMusica] = useState(true);
  const [musica, setMusica] = useState<File[]>([]);
  const [musicaUrl, setMusicaUrl] = useState("");
  const [volumeMusica, setVolumeMusica] = useState(VOLUMES_PADRAO.musica);
  const [velocidadeMusica, setVelocidadeMusica] = useState<number>(VELOCIDADE_PADRAO);
  /** cortar trechos sem fala maiores que X segundos (0 = não cortar) */
  const [cortarSilencio, setCortarSilencio] = useState(0);
  const [audioVideo, setAudioVideo] = useState<"manter" | "remover">("manter");
  // mixagem: dá pra ouvir o resultado de cada controle na hora, antes de gerar
  const [volumeOriginal, setVolumeOriginal] = useState(100);
  const [volumeVoz, setVolumeVoz] = useState(100);

  const [enviando, setEnviando] = useState(false);

  const atual = clips[sel];
  const mudo = audioVideo === "remover";
  const conflitoAudio = ehProduto && formato === "voz" && audioVideo === "manter";
  // formatos que usam a copy da IA (tom/plataforma/descrição só importam nesses)
  const usaCopy = formato === "legenda" || formato === "voz";

  // ---- principais (a base do vídeo, em sequência) e apoios (entram por cima) ----
  const principais = clips.filter((c) => c.papel === "principal");
  const modoPrincipal = principais.length > 0;
  const durBase = principais.reduce((s, c) => s + (c.outSec - c.inSec), 0);
  const apoios = modoPrincipal ? clips.filter((c) => c.papel !== "principal") : [];
  /** Em que segundo da base esse principal começa. */
  const inicioDoBase = (i: number) =>
    principais.slice(0, i).reduce((s, c) => s + (c.outSec - c.inSec), 0);
  const marcasApoio = modoPrincipal ? momentosApoios(apoios, durBase) : [];
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
  const marcaAtiva =
    modoPrincipal && tocando
      ? marcasApoio.find((m) => tGlobal >= m.entra && tGlobal < m.entra + m.dur)
      : undefined;
  const apoioNaTela = marcaAtiva ? clips.find((c) => c.id === marcaAtiva.id) : undefined;
  const textosAtivos = textos.filter(
    (t) => t.conteudo.trim() && tGlobal >= t.inSec && tGlobal <= t.outSec,
  );

  function pararTimer() {
    if (imgTimer.current) {
      clearInterval(imgTimer.current);
      imgTimer.current = null;
    }
  }

  // object URL da música
  useEffect(() => {
    if (!musica[0]) {
      setMusicaUrl("");
      return;
    }
    const u = URL.createObjectURL(musica[0]);
    setMusicaUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [musica]);

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
  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const novos: Clip[] = [];
    const recusados: string[] = [];
    const pesados: string[] = [];
    for (const file of files) {
      // barra aqui o que o servidor recusaria depois: sem isso a pessoa espera o
      // upload inteiro pra receber um erro no fim
      if (file.size > MAX_ARQUIVO_MB * 1024 * 1024) {
        pesados.push(`${file.name} (${tamanhoEmMB(file.size)})`);
        continue;
      }
      const url = URL.createObjectURL(file);
      const ehVideo = file.type.startsWith("video");
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
      novos.push({
        id: novoId(),
        file,
        url,
        kind: ehVideo ? "video" : "image",
        dur,
        inSec: 0,
        outSec: dur,
        papel: "apoio",
        entra: null,
        descricao: "",
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
    if (novos.length) setClips((prev) => [...prev, ...novos]);
  }, []);

  const addArquivos = useCallback(
    (lista: FileList | null) => {
      if (lista?.length) addFiles(Array.from(lista));
    },
    [addFiles],
  );

  // "Editar esse vídeo": baixa o vídeo pronto e injeta como 1º clipe.
  // Ao gerar, sai um job NOVO (cópia) - o vídeo original nunca é alterado.
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
        await addFiles([file]);
        toast.success("Vídeo carregado. Suas alterações geram uma cópia nova. 🎬");
      } catch {
        toast.error("Não consegui carregar esse vídeo pra edição.");
      }
    })();
  }, [videoInicial, addFiles]);

  // "Reutilizar": pré-preenche os ajustes de um vídeo anterior (mídia o usuário re-sobe).
  const aplicouConfig = useRef(false);
  useEffect(() => {
    if (aplicouConfig.current || !configInicial) return;
    aplicouConfig.current = true;
    setEhProduto(true);
    setNome(configInicial.nome);
    setDescricao(configInicial.descricao);
    setPreco(configInicial.preco);
    // Vídeo reaproveitado pode ser ANTERIOR a 12/08/2026 e ter vindo com
    // "transcrever", que não é mais oferecido no fluxo de produto. Sem esta
    // conversão o seletor abriria sem nenhum botão aceso, mostrando um formato
    // que a pessoa não consegue mais escolher de volta. "Nenhum" é o vizinho
    // mais próximo: mantém o áudio original e não queima copy nenhuma por cima.
    setFormato(configInicial.formato === "transcrever" ? "nenhum" : configInicial.formato);
    setTom(configInicial.tom as Tom);
    if (configInicial.voz) setVoz(configInicial.voz);
    // (posição da legenda no editor é por-texto, não tem estado global)
    toast.info("Ajustes reaproveitados. Adicione as mídias e gere de novo. 🔁");
  }, [configInicial]);

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
        if (qual === "in") return { ...c, inSec: Math.min(valor, c.outSec - 0.3) };
        return { ...c, outSec: Math.max(valor, c.inSec + 0.3) };
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

  function togglePlay() {
    if (!clips.length) return;
    if (tocando) {
      setTocando(false);
      videoRef.current?.pause();
      audioRef.current?.pause();
      pararTimer();
      return;
    }
    setTocando(true);
    if (audioRef.current && musicaUrl && comMusica) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = volumeMusica / 100;
      audioRef.current.play().catch(() => {});
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
      v.currentTime = palco.inSec;
      v.volume = volumeOriginal / 100;
      if (tocando && modoPrincipal) v.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palco?.id]);

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
              // o principal não descreve cena: quem conta a história é a fala dele
              descricao: virandoPrincipal ? "" : c.descricao,
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
    // quem narra passa a ser a pessoa: a voz da IA por cima brigaria com a fala
    // dela. Cai em "Nenhum", e não em "Legenda": a legenda do fluxo de produto é
    // copy escrita pela IA, que ficaria queimada por cima do que a pessoa está
    // dizendo. (Era "Transcrever fala" até 12/08/2026, quando esse formato saiu
    // da lista de produto - ver `FORMATOS_PRODUTO`.)
    if (virandoPrincipal && formato === "voz") {
      setFormato("nenhum");
      if (audioVideo === "remover") setAudioVideo("manter");
      toast.info("Com clipe principal quem narra é você: tirei a voz da IA. 🙂");
    }
  }

  function setEntraApoio(id: string, valor: number | null) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, entra: valor } : c)));
  }

  function setDescricaoClip(id: string, valor: string) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, descricao: valor } : c)));
  }

  // ---- enviar ----
  async function gerar() {
    if (bloqueado) {
      toast.info("Conta de demonstração não gera vídeos. 🙂");
      return;
    }
    if (clips.length === 0)
      return toast.error("Adicione pelo menos um clipe ou imagem.");
    if (ehProduto && nome.trim().length < 2)
      return toast.error("Dê um nome ao produto (ou desative 'É um produto?').");
    if (modoPrincipal && ehProduto && formato === "voz")
      return toast.error(
        "Com clipe principal quem narra é você. Escolha Legenda ou Nenhum.",
      );
    if (passouDoTeto)
      return toast.error(
        `O editor faz vídeo de até ${MAX_VIDEO_SEG / 60} minutos. Corte alguns clipes (agora está em ${fmt(totalDur)}).`,
      );
    if (apoioLongo)
      return toast.error(
        `Tem cena de apoio com mais de ${MAX_APOIO_SEG / 60} minuto. Corte ela com as alças verdes.`,
      );

    const titulo = ehProduto
      ? nome.trim()
      : textos.find((t) => t.conteudo.trim())?.conteudo.trim().slice(0, 60) ||
        "Vídeo livre";

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("produto", titulo);
      fd.set("ehProduto", ehProduto ? "1" : "0");
      if (ehProduto) {
        fd.set("descricao", descricao.trim());
        fd.set("preco", preco.trim());
        fd.set("formato", formato);
        fd.set("tom", tom);
        fd.set("plataforma", plataforma);
        if (formato === "voz") fd.set("vozId", voz);
      }
      fd.set("variantes", "1");
      fd.set("audioVideo", audioVideo);
      fd.set("comMusica", comMusica ? "1" : "0");
      fd.set("volumeMusica", String(volumeMusica));
      fd.set("velocidadeMusica", String(velocidadeMusica));
      fd.set("cortarSilencio", String(cortarSilencio));
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
      // compat com o worker atual (uma legenda + posição)
      fd.set("legendaPos", textosLimpos[0]?.pos ?? "baixo");
      if (textosLimpos[0]) fd.set("legenda", textosLimpos[0].texto);

      // roteiro: ordem, cortes, quem é o principal e quando cada apoio entra
      fd.set(
        "roteiro",
        JSON.stringify(
          clips.map((c, ordem) => ({
            nome: c.file.name,
            tipo: c.kind,
            ordem,
            in: Number(c.inSec.toFixed(2)),
            out: Number(c.outSec.toFixed(2)),
            papel: c.papel,
            ...(c.papel === "apoio"
              ? { entra: c.entra === null ? null : Number(c.entra.toFixed(2)) }
              : {}),
            ...(c.descricao.trim() ? { descricao: c.descricao.trim() } : {}),
          })),
        ),
      );

      clips.forEach((c) => {
        if (c.kind === "video") fd.append("videos", c.file);
        else fd.append("imagens", c.file);
      });
      if (comMusica) musica.forEach((f) => fd.append("musica", f));

      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { erro?: string };
      if (!res.ok) {
        toast.error(data.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      toast.success("Vídeo enviado pra fila! 🎬");
      router.push("/painel");
      router.refresh();
    } catch {
      toast.error("Sem conexão com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <audio ref={audioRef} src={musicaUrl || undefined} className="hidden" />

      {/* ===== PALCO =====
          gruda no topo ao rolar: com muitos clipes a lista fica longa e a prévia
          sumia lá em cima. Só no desktop: no celular ela ocuparia a tela toda. */}
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
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
                Adicione clipes e imagens
                <br />
                pra montar seu vídeo
              </span>
            </div>
          )}

          {/* apoio por cima do principal: tela cheia, mudo, e sai sozinho.
              A key força remontar a cada troca, pra o clipe começar do início. */}
          {apoioNaTela &&
            (apoioNaTela.kind === "video" ? (
              <video
                key={apoioNaTela.id}
                src={`${apoioNaTela.url}#t=${apoioNaTela.inSec}`}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 size-full bg-black object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={apoioNaTela.id}
                src={apoioNaTela.url}
                alt=""
                className="absolute inset-0 size-full bg-black object-contain"
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
        </div>

        {/* controles + trim do clipe */}
        {atual && (
          <div className="mx-auto w-full max-w-[340px] space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={togglePlay}
              >
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

      {/* ===== PAINEL ===== */}
      <div className="space-y-5">
        {bloqueado && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-amber-500">Demo:</span> você
              edita e pré-visualiza à vontade; gerar fica na conta completa.
            </p>
          </div>
        )}

        {/* clipes */}
        <Secao
          icon={Layers}
          titulo={`Clipes (${clips.length})`}
          acao={<AddMidia onPick={addArquivos} />}
        >
          {clips.length > 1 && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
              <Star className="mt-0.5 size-3.5 shrink-0 text-primary" />
              {modoPrincipal ? (
                <span>
                  <b className="text-foreground">
                    {principais.length === 1
                      ? "Clipe principal ligado."
                      : `${principais.length} clipes principais ligados.`}
                  </b>{" "}
                  A narração é a sua fala {principais.length === 1 ? "nele" : "neles"},
                  então a voz da IA fica desligada.{" "}
                  {principais.length > 1 &&
                    "Eles tocam em sequência, na ordem da lista (use as setinhas pra trocar). "}
                  Os outros clipes entram por cima, mudos, em tela cheia, voltando pra você
                  depois. O vídeo vai durar {fmt(durBase)} e cabem{" "}
                  <b className="text-foreground">
                    {cabemApoios} {cabemApoios === 1 ? "cena" : "cenas"} de apoio
                  </b>{" "}
                  (1 a cada {SEG_POR_APOIO}s).
                </span>
              ) : (
                <span>
                  Tem vídeo em que você aparece <b className="text-foreground">narrando</b>?
                  Toque na <b className="text-foreground">estrela</b> dele. Pode marcar
                  mais de um: eles tocam em sequência formando a base, e os outros clipes
                  entram por cima mostrando o produto.
                </span>
              )}
            </div>
          )}

          {modoPrincipal && (
            <div className="rounded-lg border border-border bg-card p-2.5">
              <div className="mb-1.5 flex items-center gap-2">
                <Scissors className="size-4 shrink-0 text-primary" />
                <p className="text-xs font-medium">Cortar partes sem fala</p>
              </div>
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
              <p className="mt-1 text-[10px] text-muted-foreground">
                {cortarSilencio === 0
                  ? "Sem corte: a base sai do jeito que você gravou."
                  : `Todo trecho calado por mais de ${cortarSilencio.toLocaleString("pt-BR")}s sai fora, imagem e som juntos, com uma folga pra não engolir a respiração. O vídeo fica mais curto, então pode caber menos cena de apoio. O corte acontece no render: a prévia aqui toca o clipe inteiro.`}
              </p>
            </div>
          )}

          {clips.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhum clipe ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {clips.map((c, i) => (
                <li
                  key={c.id}
                  className={cn(
                    "rounded-lg border bg-card p-1.5",
                    i === sel ? "border-primary" : "border-border",
                    c.papel === "principal" && "border-primary/70 bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTocando(false);
                        pararTimer();
                        irPara(i, false);
                      }}
                      className="relative size-12 shrink-0 overflow-hidden rounded-md bg-black"
                    >
                      {c.kind === "video" ? (
                        <video
                          src={`${c.url}#t=0.3`}
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
                        {c.kind === "video" ? "Vídeo" : "Imagem"} ·{" "}
                        {fmt(c.outSec - c.inSec)}
                        {c.papel === "principal" && (
                          <b className="ml-1 text-primary">
                            · principal{" "}
                            {principais.length > 1 &&
                              `${principais.findIndex((p) => p.id === c.id) + 1}º`}
                          </b>
                        )}
                        {modoPrincipal && c.papel === "apoio" && (
                          <span className="ml-1">· apoio (mudo)</span>
                        )}
                      </p>
                    </div>
                    {c.kind === "video" && (
                      <button
                        type="button"
                        onClick={() => alternarPrincipal(c.id)}
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
                          onClick={() => mover(i, -1)}
                          disabled={i === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Subir"
                        >
                          <ChevronLeft className="size-4 rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={() => mover(i, 1)}
                          disabled={
                            modoPrincipal
                              ? i + 1 >= principais.length
                              : i === clips.length - 1
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
                      onClick={() => removerClip(c.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {/* Descrever a cena: é assim que a IA sabe O QUE tem nesse
                      clipe, pra encaixar no trecho certo da fala e pra copy
                      falar do que está na tela. O principal não tem: a fala DELE
                      é que é a narração, e a IA lê essa fala transcrevendo. */}
                  {c.papel !== "principal" && (
                    <Input
                      value={c.descricao}
                      onChange={(e) => setDescricaoClip(c.id, e.target.value)}
                      maxLength={160}
                      placeholder="O que aparece aqui (ex: close no tecido da blusa)"
                      className="mt-1.5 h-8 text-xs"
                    />
                  )}

                  {modoPrincipal && c.papel === "apoio" && (
                    <MomentoApoio
                      clip={c}
                      durBase={durBase}
                      marca={marcasApoio.find((m) => m.id === c.id)}
                      excedente={
                        apoios.findIndex((a) => a.id === c.id) >= cabemApoios
                      }
                      cabem={cabemApoios}
                      onChange={(v) => setEntraApoio(c.id, v)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          {clips.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              <b className="text-foreground">Descrever a cena é opcional</b>, mas ajuda
              muito:{" "}
              {modoPrincipal
                ? "é assim que a IA sabe em que ponto da sua fala cada apoio encaixa. O principal não precisa: ela lê a fala dele."
                : "a IA usa isso pra escrever uma copy que combina com o que está na tela."}
            </p>
          )}
        </Secao>

        {/* textos */}
        <Secao
          icon={Type}
          titulo={`Textos (${textos.length})`}
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
                ? "Adicione clipes primeiro."
                : "Nenhum texto. Adicione e escolha posição e tempo."}
            </p>
          ) : (
            textos.map((t) => (
              <TextoBloco
                key={t.id}
                texto={t}
                totalDur={totalDur}
                tGlobal={tGlobal}
                onUpd={(patch) => updTexto(t.id, patch)}
                onTempo={(qual, v) => setTextoTempo(t.id, qual, v)}
                onRemover={() => removerTexto(t.id)}
              />
            ))
          )}
        </Secao>

        {/* áudio */}
        <Secao icon={Volume2} titulo="Áudio">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Som original do vídeo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <BotaoOpcao
                ativo={!mudo}
                onClick={() => setAudioVideo("manter")}
                icon={Volume2}
                label="Manter"
              />
              {/* Aqui havia uma trava pro formato "Transcrever fala", que não
                  deixava mutar o vídeo porque o som original era a fonte da
                  legenda. Ela saiu junto com o formato, em 12/08/2026: no fluxo
                  de produto ele não é mais oferecido, então a trava nunca mais
                  dispararia. */}
              <BotaoOpcao
                ativo={mudo}
                onClick={() => setAudioVideo("remover")}
                icon={VolumeX}
                label="Mudo"
              />
            </div>
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
                      ? "Sua voz no clipe principal. Dê o play na prévia e ajuste ouvindo."
                      : "Som que já vem nos seus vídeos. Dê o play na prévia e ajuste ouvindo."
                  }
                />
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Música de fundo
            </p>
            <div className="grid grid-cols-2 gap-2">
              <BotaoOpcao
                ativo={comMusica}
                onClick={() => setComMusica(true)}
                icon={Music}
                label="Com música"
              />
              <BotaoOpcao
                ativo={!comMusica}
                onClick={() => setComMusica(false)}
                icon={VolumeX}
                label="Sem música"
              />
            </div>

            {comMusica && (
              <div className="mt-3 space-y-3">
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
                  // o player aqui já toca no volume e na velocidade escolhidos
                  volume={volumeMusica / 100}
                  velocidade={velocidadeMusica}
                  hint="Suba um áudio ou um vídeo (usamos só o som dele), ou deixe vazio que a IA escolhe uma pra você"
                />

                {/* volume: controla tanto a sua música quanto a automática */}
                <ControleVolume
                  icon={Music}
                  label="Volume da música"
                  valor={volumeMusica}
                  onChange={setVolumeMusica}
                  dica="Vale pra sua música e pra automática. Deixe baixo pra não abafar a voz."
                />

                <VelocidadeMusica
                  valor={velocidadeMusica}
                  onChange={setVelocidadeMusica}
                  temPreview={!!musicaUrl}
                />
              </div>
            )}
          </div>

          {ehProduto && formato === "voz" && (
            <div>
              <ControleVolume
                icon={Mic}
                label="Volume da narração"
                valor={volumeVoz}
                max={MAX_VOLUME_BOOST}
                onChange={setVolumeVoz}
                dica="Voz da IA. Ela só existe depois do render, então não dá pra ouvir aqui: no vídeo pronto tem o botão Reajustar áudio pra acertar ouvindo, sem gastar crédito."
              />
            </div>
          )}
        </Secao>

        {/* produto (opcional) */}
        <Secao
          icon={Package}
          titulo="É um produto?"
          acao={
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setEhProduto(false)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  !ehProduto ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => setEhProduto(true)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  ehProduto ? "bg-primary/15 text-primary" : "text-muted-foreground",
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
              {usaCopy && (
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
              <div className="space-y-1.5">
                <Label className="text-xs">Formato</Label>
                <Segmented
                  // com clipe principal a voz da IA sairia por cima da sua fala
                  options={
                    modoPrincipal
                      ? FORMATOS_PRODUTO.filter((f) => f.value !== "voz")
                      : FORMATOS_PRODUTO
                  }
                  value={formato}
                  onChange={setFormato}
                />
                <p className="text-[11px] text-muted-foreground">{FORMATO_NOTA[formato]}</p>
                {modoPrincipal && (
                  <p className="text-[11px] text-muted-foreground">
                    <b className="text-foreground">Voz narrada</b> fica de fora aqui: quem
                    narra é você, no clipe principal.
                  </p>
                )}
              </div>
              {usaCopy && (
                <>
              <div className="space-y-1.5">
                <Label className="text-xs">Tom</Label>
                <Segmented options={TONS} value={tom} onChange={setTom} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Onde vai vender</Label>
                <Segmented options={PLATAFORMAS} value={plataforma} onChange={setPlataforma} />
                <p className="text-[11px] text-muted-foreground">
                  {plataforma === "shopee"
                    ? "A copy usa o CTA e as hashtags da Shopee (sacolinha laranja, #AchadinhosShopee)."
                    : "A copy usa um CTA neutro (corre no link) e hashtags do nicho - sem citar a Shopee."}
                </p>
              </div>
                </>
              )}
              {formato === "voz" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Voz da narração</Label>
                  <SeletorVoz vozes={vozes} value={voz} onChange={setVoz} />
                  <p className="text-[11px] text-muted-foreground">
                    Toque no play pra ouvir uma prévia antes de gerar.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ative se for divulgar um produto - a IA escreve a copy e as
              hashtags pra você. Pra um corte/meme comum, deixe no{" "}
              <b className="text-foreground">Não</b>.
            </p>
          )}
        </Secao>

        {/* No modo "Nenhum" a IA não entra, então não há consumo a estimar: o
            preço é o fixo de processamento e a tela mostra o valor EXATO. Com a
            estimativa por segundo aqui, vídeo curto sem IA prometia menos do que
            seria cobrado de verdade. */}
        {clips.length > 0 && !bloqueado && (
          <p className="text-center text-xs text-muted-foreground">
            Usará{" "}
            <span className="font-semibold text-primary">
              {formato === "nenhum" ? (
                <>{CREDITOS_FIXO.editorManual} créditos</>
              ) : (
                <>
                  no máximo{" "}
                  {estimarCreditos(
                    ehProduto && formato === "voz" ? "voz" : "legenda",
                    totalDur,
                  ).toLocaleString("pt-BR")}{" "}
                  créditos
                </>
              )}
            </span>
          </p>
        )}

        {(passouDoTeto || apoioLongo) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200/90">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
            <span>
              {passouDoTeto
                ? `Seu vídeo está com ${fmt(totalDur)}. O editor faz até ${MAX_VIDEO_SEG / 60} minutos: corte ou tire alguns clipes.`
                : `Tem cena de apoio com mais de ${MAX_APOIO_SEG / 60} minuto. Corte ela com as alças verdes.`}
            </span>
          </div>
        )}

        <Button
          type="button"
          size="lg"
          className="h-11 w-full"
          disabled={enviando || bloqueado || passouDoTeto || apoioLongo}
          onClick={gerar}
        >
          {bloqueado ? (
            <Lock className="size-4" />
          ) : enviando ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {bloqueado ? "Indisponível na demo" : "Gerar vídeo"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- componentes auxiliares ---------------- */

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
 * Quando esse clipe de apoio entra por cima do principal. Por padrão quem decide
 * é a IA (ela lê a fala do principal na hora do render); arrastando aqui a
 * pessoa fixa o momento e a IA não mexe mais nesse clipe.
 */
function MomentoApoio({
  clip,
  durBase,
  marca,
  excedente,
  cabem,
  onChange,
}: {
  clip: Clip;
  durBase: number;
  marca?: { entra: number; dur: number; auto: boolean };
  /** passou da conta de 1 cena a cada 10 segundos do principal */
  excedente: boolean;
  cabem: number;
  onChange: (v: number | null) => void;
}) {
  const dur = durApoio(clip);
  const max = Math.max(0, durBase - dur);
  const sugerido = marca?.entra ?? 0;
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

  return (
    <div className="mt-1.5 space-y-1.5 border-t border-border/60 pt-1.5">
      {longo && (
        <p className="text-[11px] text-amber-500">
          Cena de apoio aceita no máximo {MAX_APOIO_SEG / 60} minuto. Corte esse clipe
          com as alças verdes pra poder gerar.
        </p>
      )}
      {clip.entra === null ? (
        <div className="flex items-center gap-1.5 text-[11px]">
          <Wand2 className="size-3.5 shrink-0 text-primary" />
          <span className="flex-1 text-muted-foreground">
            A IA escolhe o momento
            {marca ? ` (por volta de ${sugerido.toFixed(1)}s)` : ""}
          </span>
          <button
            type="button"
            onClick={() => onChange(Number(sugerido.toFixed(1)))}
            className="font-medium text-primary hover:underline"
          >
            escolher eu
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="size-3.5 shrink-0 text-primary" />
            <span className="flex-1">
              entra em <b className="text-foreground">{clip.entra.toFixed(1)}s</b> e fica{" "}
              {dur.toFixed(1)}s
            </span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="font-medium text-primary hover:underline"
            >
              IA escolhe
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={0.1}
            value={Math.min(clip.entra, max)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-primary"
            aria-label="Momento em que esse clipe entra"
          />
        </>
      )}
      {!marca && (
        <p className="text-[11px] text-amber-500">
          Não cabe no tempo do principal: esse clipe ficaria de fora do vídeo.
        </p>
      )}
    </div>
  );
}

function AddMidia({ onPick }: { onPick: (l: FileList | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => ref.current?.click()}
      >
        <Plus className="size-4" />
        Adicionar
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
  totalDur,
  tGlobal,
  onUpd,
  onTempo,
  onRemover,
}: {
  texto: Texto;
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
        options={POSICOES}
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
      <button
        type="button"
        onPointerDown={(e) => onDown("in", e)}
        className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded bg-primary text-primary-foreground shadow"
        style={{ left: pct(inSec) }}
        aria-label="Início"
      >
        <ChevronRight className="size-3" />
      </button>
      <button
        type="button"
        onPointerDown={(e) => onDown("out", e)}
        className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded bg-primary text-primary-foreground shadow"
        style={{ left: pct(outSec) }}
        aria-label="Fim"
      >
        <ChevronLeft className="size-3" />
      </button>
    </div>
  );
}
