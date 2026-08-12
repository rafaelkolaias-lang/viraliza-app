"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Film,
  Loader2,
  Lock,
  Pause,
  Play,
  Plus,
  Scissors,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CREDITOS_FIXO } from "@/lib/precos";
import {
  MAX_ARQUIVO_MB,
  MAX_VIDEO_SEG,
  SILENCIOS,
  VOLUMES_PADRAO,
  tamanhoEmMB,
} from "@/lib/montagem";

/**
 * CRIAR UM CORTE: o vídeo que a pessoa JÁ TEM no computador, sem IA nenhuma.
 *
 * Ela sobe o arquivo, tira os pedaços ruins (as partes que ficam no vermelho
 * somem) e pode mandar tirar também o silêncio entre as falas. Sai um vídeo só,
 * com o áudio original, no formato de celular.
 *
 * Por que é uma tela separada do Editor automático: aqui NÃO existe "é um
 * produto?", copy da IA, voz do ElevenLabs nem cena de apoio. Quem quer só
 * limpar a própria gravação não precisa passar por cinco etapas de montagem, e
 * quem quer montar não fica achando que este é o caminho.
 *
 * O render é o MESMO de sempre: cada pedaço que fica vira um clipe principal do
 * roteiro, apontando pro mesmo arquivo com um corte diferente, e a fábrica emenda
 * eles na ordem (`_montar_com_principal` em `bot shopee/fabrica.py`). Nada de
 * caminho novo no worker.
 */

/** Aceita arquivo maior que o Editor: aqui a pessoa vem justamente PRA cortar
 *  uma gravação longa. O que sai é que tem o teto de 2 minutos. */
const MAX_ENTRADA_SEG = 600;
/** Pedaço menor que isso vira piscada de dois quadros: não vale manter. */
const MIN_PEDACO = 0.4;

type Corte = { id: string; ini: number; fim: number };
type Pedaco = { ini: number; fim: number };

let _seq = 0;
function novoId() {
  _seq += 1;
  return `c${_seq}`;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  const d = Math.floor((s % 1) * 10);
  return `${m}:${r.toString().padStart(2, "0")}.${d}`;
}

/** O que SOBRA depois de tirar os trechos marcados (o complemento, em ordem). */
function pedacosQueFicam(cortes: Corte[], dur: number): Pedaco[] {
  if (dur <= 0) return [];
  // junta os cortes que se encostam, senão o complemento sai picotado à toa
  const unidos: Pedaco[] = [];
  for (const c of [...cortes].sort((a, b) => a.ini - b.ini)) {
    const ini = Math.max(0, Math.min(c.ini, dur));
    const fim = Math.max(ini, Math.min(c.fim, dur));
    if (fim - ini < 0.05) continue;
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && ini <= ultimo.fim + 0.05) ultimo.fim = Math.max(ultimo.fim, fim);
    else unidos.push({ ini, fim });
  }
  const ficam: Pedaco[] = [];
  let cursor = 0;
  for (const c of unidos) {
    if (c.ini - cursor >= MIN_PEDACO) ficam.push({ ini: cursor, fim: c.ini });
    cursor = Math.max(cursor, c.fim);
  }
  if (dur - cursor >= MIN_PEDACO) ficam.push({ ini: cursor, fim: dur });
  return ficam;
}

/**
 * Vídeo que a pessoa JÁ gerou aqui e mandou cortar (ação "Cortar" em Meus
 * vídeos). Não existe `File` nenhum: o arquivo está no servidor, a timeline toca
 * ele pela URL e o corte é enviado só com o id do job de origem.
 */
export type VideoParaCortar = {
  jobId: string;
  nome: string;
  url: string;
  duracaoSeg: number;
};

export function CorteEstudio({
  bloqueado = false,
  videoInicial,
}: {
  bloqueado?: boolean;
  videoInicial?: VideoParaCortar;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  /** vídeo do servidor (veio de "Cortar"); some assim que a pessoa troca o arquivo */
  const [remoto, setRemoto] = useState<VideoParaCortar | null>(videoInicial ?? null);
  const [url, setUrl] = useState(videoInicial?.url ?? "");
  const [dur, setDur] = useState(videoInicial?.duracaoSeg ?? 0);
  const [nome, setNome] = useState(videoInicial?.nome ?? "");

  const [cortes, setCortes] = useState<Corte[]>([]);
  const [marcandoEm, setMarcandoEm] = useState<number | null>(null);
  const [cortarSilencio, setCortarSilencio] = useState(0);
  const [comSom, setComSom] = useState(true);

  const [tempo, setTempo] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const ficam = useMemo(() => pedacosQueFicam(cortes, dur), [cortes, dur]);
  const durFinal = ficam.reduce((s, p) => s + (p.fim - p.ini), 0);
  const passouDoTeto = durFinal > MAX_VIDEO_SEG;
  const tirado = Math.max(0, dur - durFinal);
  /** tem vídeo carregado? pode ser do computador (`file`) ou do servidor (`remoto`) */
  const temVideo = !!file || !!remoto;
  /** nome do arquivo no servidor: é por ele que o roteiro aponta cada pedaço */
  const arquivoNoServidor = file
    ? file.name
    : (remoto?.url.split("?")[0].split("/").pop() ?? "video.mp4");

  useEffect(() => {
    return () => {
      // só o arquivo do computador vira blob; o do servidor é URL de verdade
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [url]);

  const carregar = useCallback(
    async (escolhido: File | null) => {
      if (!escolhido) return;
      if (!escolhido.type.startsWith("video")) {
        toast.error("Escolha um arquivo de vídeo.");
        return;
      }
      if (escolhido.size > MAX_ARQUIVO_MB * 1024 * 1024) {
        toast.error(
          `"${escolhido.name}" tem ${tamanhoEmMB(escolhido.size)} e o limite é ${MAX_ARQUIVO_MB} MB. Comprima o arquivo antes de subir.`,
        );
        return;
      }
      const novaUrl = URL.createObjectURL(escolhido);
      const duracao = await new Promise<number>((res) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => res(v.duration || 0);
        v.onerror = () => res(0);
        v.src = novaUrl;
      });
      if (!duracao) {
        URL.revokeObjectURL(novaUrl);
        toast.error("Não consegui ler esse vídeo. Tente outro arquivo.");
        return;
      }
      if (duracao > MAX_ENTRADA_SEG) {
        URL.revokeObjectURL(novaUrl);
        toast.error(
          `Esse vídeo tem ${fmt(duracao)} e o limite de entrada é ${MAX_ENTRADA_SEG / 60} minutos.`,
        );
        return;
      }
      setUrl((antiga) => {
        if (antiga.startsWith("blob:")) URL.revokeObjectURL(antiga);
        return novaUrl;
      });
      setFile(escolhido);
      // trocou pelo arquivo do computador: o vídeo do servidor sai de cena, e
      // com ele o atalho de cortar sem upload
      setRemoto(null);
      setDur(duracao);
      setCortes([]);
      setMarcandoEm(null);
      setTempo(0);
      setTocando(false);
      setNome((n) => n || escolhido.name.replace(/\.[^.]+$/, "").slice(0, 60));
    },
    [],
  );

  function irPara(t: number) {
    const v = videoRef.current;
    const alvo = Math.max(0, Math.min(t, dur));
    setTempo(alvo);
    if (v) v.currentTime = alvo;
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (tocando) {
      v.pause();
      setTocando(false);
      return;
    }
    // parado em cima de um trecho cortado: começa do próximo pedaço que fica
    const dentro = cortes.find((c) => v.currentTime >= c.ini && v.currentTime < c.fim);
    if (dentro) v.currentTime = Math.min(dentro.fim + 0.02, dur);
    v.play().catch(() => {});
    setTocando(true);
  }

  /** A prévia PULA os trechos marcados: é assim que o vídeo vai sair. */
  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    const dentro = cortes.find((c) => v.currentTime >= c.ini && v.currentTime < c.fim - 0.02);
    if (dentro) {
      const proximo = Math.min(dentro.fim + 0.02, dur);
      if (proximo >= dur - 0.05) {
        v.pause();
        setTocando(false);
        v.currentTime = ficam[0]?.ini ?? 0;
        setTempo(ficam[0]?.ini ?? 0);
        return;
      }
      v.currentTime = proximo;
      setTempo(proximo);
      return;
    }
    setTempo(v.currentTime);
  }

  // ---- marcar trecho pra tirar ----
  function marcar() {
    if (marcandoEm === null) {
      setMarcandoEm(tempo);
      return;
    }
    const ini = Math.min(marcandoEm, tempo);
    const fim = Math.max(marcandoEm, tempo);
    setMarcandoEm(null);
    if (fim - ini < 0.2) {
      toast.info("Esse trecho ficou curto demais pra cortar. Ande um pouco no vídeo antes de fechar a marca.");
      return;
    }
    setCortes((prev) => [...prev, { id: novoId(), ini, fim }]);
  }

  function ajustar(id: string, qual: "ini" | "fim", valor: number) {
    setCortes((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const v = Math.max(0, Math.min(valor, dur));
        return qual === "ini"
          ? { ...c, ini: Math.min(v, c.fim - 0.1) }
          : { ...c, fim: Math.max(v, c.ini + 0.1) };
      }),
    );
  }

  async function gerar() {
    if (bloqueado) {
      toast.info("Conta de demonstração não gera vídeos. 🙂");
      return;
    }
    if (!temVideo) return toast.error("Suba um vídeo primeiro.");
    if (!ficam.length)
      return toast.error("Você cortou o vídeo inteiro. Tire alguma marca vermelha pra sobrar conteúdo.");
    if (passouDoTeto)
      return toast.error(
        `O corte final está com ${fmt(durFinal)} e o limite é ${MAX_VIDEO_SEG / 60} minutos. Tire mais alguns trechos.`,
      );

    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("produto", nome.trim() || "Corte");
      // sem IA nenhuma: nada de copy, nada de legenda inventada, nada de voz
      fd.set("ehProduto", "0");
      fd.set("formato", "nenhum");
      fd.set("variantes", "1");
      fd.set("audioVideo", comSom ? "manter" : "remover");
      fd.set("comMusica", "0");
      fd.set("cortarSilencio", String(cortarSilencio));
      fd.set(
        "volumes",
        JSON.stringify({ original: 100, musica: 0, voz: VOLUMES_PADRAO.voz }),
      );
      fd.set("textos", "[]");
      // cada pedaço que sobrou vira um clipe PRINCIPAL apontando pro mesmo
      // arquivo: a fábrica emenda eles na ordem, com o som original correndo
      fd.set(
        "roteiro",
        JSON.stringify(
          ficam.map((p, ordem) => ({
            nome: arquivoNoServidor,
            tipo: "video",
            ordem,
            in: Number(p.ini.toFixed(2)),
            out: Number(p.fim.toFixed(2)),
            papel: "principal",
          })),
        ),
      );
      if (file) {
        fd.append("videos", file);
      } else if (remoto) {
        // vídeo que já está no servidor: em vez de baixar e subir 300 MB de novo,
        // manda só o id do job de origem e o próprio servidor copia o arquivo
        // pra pasta de entrada do corte novo
        fd.set("origemJobId", remoto.jobId);
      }

      const res = await fetch("/api/jobs", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { erro?: string };
      if (!res.ok) {
        toast.error(data.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      toast.success("Corte enviado pra fila! ✂️");
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
      {/* ===== PAINEL ===== */}
      <div className="space-y-5">
        {bloqueado && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-amber-500">Demo:</span> você corta e
              pré-visualiza à vontade; gerar fica na conta completa.
            </p>
          </div>
        )}

        {/* 1. arquivo */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Seu vídeo</h3>
          </div>
          {temVideo ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <Film className="size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {file ? file.name : remoto!.nome}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fmt(dur)}
                  {file
                    ? ` · ${tamanhoEmMB(file.size)}`
                    : " · vídeo que você já gerou aqui (sem upload)"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <Upload className="size-6 text-primary" />
              <span className="text-sm font-medium">Escolher um vídeo do computador</span>
              <span className="text-[11px] text-muted-foreground">
                Até {MAX_ENTRADA_SEG / 60} minutos e {MAX_ARQUIVO_MB} MB. O corte final sai
                com no máximo {MAX_VIDEO_SEG / 60} minutos.
              </span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              carregar(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {temVideo && (
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do corte</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={60}
                placeholder="Como você quer achar esse vídeo depois"
              />
            </div>
          )}
        </section>

        {temVideo && (
          <>
            {/* 2. cortes manuais */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    Trechos que saem ({cortes.length})
                  </h3>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={marcandoEm === null ? "outline" : "default"}
                  onClick={marcar}
                >
                  {marcandoEm === null ? (
                    <>
                      <Plus className="size-4" />
                      Começar a cortar aqui
                    </>
                  ) : (
                    <>
                      <Scissors className="size-4" />
                      Fechar corte em {fmt(tempo)}
                    </>
                  )}
                </Button>
              </div>

              <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                Ande na barra do vídeo até onde o trecho ruim <b className="text-foreground">começa</b>,
                toque em <b className="text-foreground">Começar a cortar aqui</b>, ande até onde ele{" "}
                <b className="text-foreground">acaba</b> e feche o corte. O que fica vermelho na barra
                some do vídeo, e a prévia já pula esses trechos.
              </p>

              {marcandoEm !== null && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200/90">
                  Corte aberto em <b>{fmt(marcandoEm)}</b>. Ande até o fim do trecho e feche.
                </p>
              )}

              {cortes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhum trecho marcado ainda: o vídeo sai inteiro.
                </p>
              ) : (
                <ul className="space-y-2">
                  {[...cortes]
                    .sort((a, b) => a.ini - b.ini)
                    .map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5"
                      >
                        <span className="text-xs font-medium text-destructive">sai</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          max={dur}
                          value={Number(c.ini.toFixed(1))}
                          onChange={(e) => ajustar(c.id, "ini", Number(e.target.value))}
                          className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs tabular-nums"
                          aria-label="Segundo em que o corte começa"
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          max={dur}
                          value={Number(c.fim.toFixed(1))}
                          onChange={(e) => ajustar(c.id, "fim", Number(e.target.value))}
                          className="h-8 w-20 rounded-md border border-border bg-background px-2 text-xs tabular-nums"
                          aria-label="Segundo em que o corte acaba"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          ({fmt(c.fim - c.ini)})
                        </span>
                        <button
                          type="button"
                          onClick={() => irPara(Math.max(0, c.ini - 1))}
                          className="ml-auto text-muted-foreground hover:text-foreground"
                          aria-label="Ver esse ponto"
                        >
                          <SkipForward className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCortes((p) => p.filter((x) => x.id !== c.id))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Desfazer esse corte"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            {/* 3. cortar silêncio */}
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Scissors className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Cortar partes sem fala</h3>
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
              <p className="text-[10px] text-muted-foreground">
                {cortarSilencio === 0
                  ? "Sem corte: o vídeo sai do jeito que você gravou (fora os trechos marcados acima)."
                  : `Todo trecho calado por mais de ${cortarSilencio.toLocaleString("pt-BR")}s sai fora, imagem e som juntos, com uma folga pra não engolir a respiração. Isso acontece no render: a prévia aqui toca o vídeo inteiro.`}
              </p>
            </section>

            {/* 4. som */}
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Volume2 className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Som do vídeo</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { ativo: comSom, on: () => setComSom(true), Icone: Volume2, label: "Manter" },
                  { ativo: !comSom, on: () => setComSom(false), Icone: VolumeX, label: "Mudo" },
                ].map(({ ativo, on, Icone, label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={on}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      ativo
                        ? "border-primary bg-primary/12 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <Icone className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
              {!comSom && cortarSilencio > 0 && (
                <p className="text-[11px] text-amber-500">
                  No mudo o corte de silêncio ainda vale: ele usa o som pra saber onde
                  ninguém fala, e depois o áudio sai do vídeo final.
                </p>
              )}
            </section>

            {!bloqueado && (
              <p className="text-center text-xs text-muted-foreground">
                Usará{" "}
                <span className="font-semibold text-primary">
                  {CREDITOS_FIXO.editorManual} créditos
                </span>{" "}
                (valor fixo: aqui não entra IA nenhuma)
              </p>
            )}

            {passouDoTeto && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200/90">
                O corte final está com {fmt(durFinal)} e o limite é {MAX_VIDEO_SEG / 60}{" "}
                minutos. Marque mais alguns trechos pra sair.
              </p>
            )}

            <Button
              type="button"
              size="lg"
              className="h-11 w-full"
              disabled={enviando || bloqueado || passouDoTeto || !ficam.length}
              onClick={gerar}
            >
              {bloqueado ? (
                <Lock className="size-4" />
              ) : enviando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Scissors className="size-4" />
              )}
              {bloqueado ? "Indisponível na demo" : "Gerar corte"}
            </Button>
          </>
        )}
      </div>

      {/* ===== PRÉVIA (fixa no desktop) ===== */}
      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-black">
          {url ? (
            <video
              ref={videoRef}
              src={url}
              playsInline
              muted={!comSom}
              // vídeo do servidor: a duração salva no job pode estar zerada (ou
              // arredondada), então quem manda é a do arquivo de verdade. Sem
              // isso a régua de corte abriria com tamanho zero.
              onLoadedMetadata={(e) => {
                if (!remoto) return;
                const d = e.currentTarget.duration;
                if (isFinite(d) && d > 0 && Math.abs(d - dur) > 0.05) setDur(d);
              }}
              onTimeUpdate={onTimeUpdate}
              onEnded={() => setTocando(false)}
              onClick={togglePlay}
              className="size-full object-contain"
            />
          ) : (
            <div className="grid size-full place-items-center p-6 text-center text-sm text-muted-foreground">
              <span>
                <Film className="mx-auto mb-2 size-8 opacity-60" />
                Suba um vídeo
                <br />
                pra começar a cortar
              </span>
            </div>
          )}
          {url && !tocando && (
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

        {url && (
          <div className="mx-auto w-full max-w-[340px] space-y-2">
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="secondary" onClick={togglePlay}>
                {tocando ? <Pause className="size-4" /> : <Play className="size-4" />}
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fmt(tempo)} / {fmt(dur)}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                <Scissors className="size-3.5" />
                sai {fmt(durFinal)}
              </span>
            </div>

            <TrilhaCortes
              dur={dur}
              cortes={cortes}
              tempo={tempo}
              marcandoEm={marcandoEm}
              onScrub={irPara}
            />

            <p className="text-center text-[11px] text-muted-foreground">
              {tirado > 0.05
                ? `Você tirou ${fmt(tirado)} de ${fmt(dur)}.`
                : "Toque na barra pra andar no vídeo."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** A linha do vídeo inteiro, com os trechos que SAEM pintados de vermelho. */
function TrilhaCortes({
  dur,
  cortes,
  tempo,
  marcandoEm,
  onScrub,
}: {
  dur: number;
  cortes: Corte[];
  tempo: number;
  marcandoEm: number | null;
  onScrub: (t: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (s: number) => `${Math.max(0, Math.min(100, (s / (dur || 1)) * 100))}%`;

  function posDoEvento(clientX: number) {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * dur;
  }

  return (
    <div
      ref={ref}
      className="relative h-10 cursor-pointer select-none overflow-hidden rounded-lg bg-primary/20"
      onPointerDown={(e) => onScrub(posDoEvento(e.clientX))}
      onPointerMove={(e) => {
        if (e.buttons === 1) onScrub(posDoEvento(e.clientX));
      }}
    >
      {cortes.map((c) => (
        <div
          key={c.id}
          className="absolute inset-y-0 bg-destructive/70"
          style={{ left: pct(c.ini), right: `calc(100% - ${pct(c.fim)})` }}
        />
      ))}
      {marcandoEm !== null && (
        <div
          className="absolute inset-y-0 w-0.5 bg-amber-400"
          style={{ left: pct(marcandoEm) }}
        />
      )}
      <div className="absolute inset-y-1 w-0.5 bg-white/90" style={{ left: pct(tempo) }} />
    </div>
  );
}
