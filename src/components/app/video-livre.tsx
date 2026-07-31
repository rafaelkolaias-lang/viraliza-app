"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ImagePlus,
  Loader2,
  Plus,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DURACOES, ESTILOS_VIDEO, IDIOMAS_FALA, custoVideoAvatar } from "@/lib/avatar-modelo";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";

type MeuAvatar = { id: string; nome: string; imagemUrl: string; origem?: string };
type Midia = { src: string; nome?: string };

/**
 * VÍDEO LIVRE: um "chat" simples (cara de Grok). A pessoa anexa as imagens em
 * cima (dos avatares da plataforma ou do celular), escreve o prompt do jeito
 * dela e escolhe 6s/10s/15s. O texto vai EXATAMENTE como foi escrito pro Grok
 * (só entra a abertura UGC na frente). Regras iguais ao guiado: 15s aceita SÓ
 * 1 imagem; 6s/10s até 3.
 */
export function VideoLivre({
  meusAvatares = [],
  prontos = [],
  textoInicial = "",
  midiasIniciais = [],
}: {
  meusAvatares?: MeuAvatar[];
  prontos?: { id: string; nome: string; src: string }[];
  // pré-preenche o composer (ex: prompt vindo do Gerador de prompt)
  textoInicial?: string;
  midiasIniciais?: string[];
}) {
  const [midias, setMidias] = useState<Midia[]>(midiasIniciais.map((src) => ({ src })));
  const [texto, setTexto] = useState(textoInicial);
  const [duracao, setDuracao] = useState<number>(6);
  const [comFala, setComFala] = useState(true);
  const [idioma, setIdioma] = useState("pt"); // idioma da fala (pt padrão)
  const [estilo, setEstilo] = useState("ugc"); // estilo do vídeo (ugc padrão)
  const [pickerAberto, setPickerAberto] = useState(false);
  const [gerando, setGerando] = useState(false);

  const router = useRouter();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const maxMidias = duracao === 15 ? 1 : 3;

  function adicionarMidia(m: Midia) {
    setMidias((prev) => {
      if (prev.some((x) => x.src === m.src)) return prev;
      if (prev.length >= maxMidias) {
        toast.info(
          duracao === 15 ? "Vídeo de 15s aceita só 1 imagem." : "No máximo 3 imagens.",
        );
        return prev;
      }
      return [...prev, m];
    });
  }

  async function subirDoCelular(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!arquivos.length) return;
    const lidos = await Promise.all(arquivos.map(normalizarImagem));
    const ok = lidos.filter((x): x is string => !!x);
    if (ok.length < lidos.length) toast.error(ERRO_IMAGEM);
    for (const src of ok) adicionarMidia({ src });
    setPickerAberto(false);
  }

  function escolherDuracao(s: number) {
    setDuracao(s);
    // 15s = 1 imagem só: se já tinha mais, fica só a primeira
    if (s === 15) {
      setMidias((prev) => {
        if (prev.length > 1) {
          toast.info("Vídeo de 15s aceita só 1 imagem: mantive a primeira.");
          return prev.slice(0, 1);
        }
        return prev;
      });
    }
  }

  const pronto = texto.trim().length > 0 && midias.length > 0;

  async function gerar() {
    if (!pronto || gerando) {
      if (!gerando) toast.info("Anexe ao menos 1 imagem e escreva o que você quer. 🙂");
      return;
    }
    setGerando(true);
    try {
      const r = await fetch("/api/avatar/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          livre: true,
          promptLivre: texto.trim(),
          imagens: midias.map((m) => m.src),
          duracao,
          comFala,
          idioma,
          estilo,
          qualidade: "720p",
        }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        erro?: string;
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
      toast.success("Vídeo em produção! 🎬 Ele aparece em Meus vídeos em 3 a 5 minutos.");
      router.push("/painel");
    } catch {
      toast.error("Sem conexão. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  // avatares da plataforma (meus + prontos) pro picker
  const daPlataforma: Midia[] = [
    ...meusAvatares.map((a) => ({ src: a.imagemUrl, nome: a.nome })),
    ...prontos.map((a) => ({ src: a.src, nome: a.nome })),
  ];

  return (
    <div className="space-y-3">
      <input
        ref={inputArquivo}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={subirDoCelular}
      />

      {/* ===== COMPOSER (cara de chat) ===== */}
      <div className="rounded-3xl border border-border bg-card p-3.5 shadow-sm sm:p-4">
        {/* mídias anexadas em cima */}
        {midias.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {midias.map((m, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.src}
                  alt={m.nome ?? `Imagem ${i + 1}`}
                  className="size-16 rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setMidias((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-black"
                  aria-label="Remover imagem"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Descreva o vídeo do seu jeito. Ex: ela mostra o sérum pra câmera, passa no dorso da mão e sorri..."
          maxLength={4000}
          rows={3}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {/* barra de baixo: anexar + duração + fala + enviar */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerAberto((v) => !v)}
            className={cn(
              "grid size-9 place-items-center rounded-full border transition-colors",
              pickerAberto
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary",
            )}
            aria-label="Anexar imagens"
          >
            <Plus className={cn("size-4.5 transition-transform", pickerAberto && "rotate-45")} />
          </button>

          <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
            {DURACOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => escolherDuracao(s)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  duracao === s
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s}s
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setComFala((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              comFala
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            aria-label={comFala ? "Vídeo com fala (toque pra tirar)" : "Vídeo sem fala (toque pra ativar)"}
          >
            {comFala ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            {comFala ? "Com fala" : "Sem fala"}
          </button>

          {/* estilo do vídeo */}
          <select
            value={estilo}
            onChange={(e) => setEstilo(e.target.value)}
            className="rounded-full border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus:border-primary"
            aria-label="Estilo do vídeo"
          >
            {ESTILOS_VIDEO.map((es) => (
              <option key={es.chave} value={es.chave}>
                {es.label}
              </option>
            ))}
          </select>

          {/* idioma da fala (só faz sentido com fala) */}
          {comFala && (
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="rounded-full border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus:border-primary"
              aria-label="Idioma da fala"
            >
              {IDIOMAS_FALA.map((i) => (
                <option key={i.chave} value={i.chave}>
                  {i.label}
                </option>
              ))}
            </select>
          )}

          <span className="ml-auto text-xs font-bold text-primary">
            {custoVideoAvatar(duracao, comFala)} créditos
          </span>

          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
            className={cn(
              "grid size-10 place-items-center rounded-full transition-all",
              pronto && !gerando
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
            aria-label="Gerar vídeo"
          >
            {gerando ? <Loader2 className="size-4.5 animate-spin" /> : <ArrowUp className="size-4.5" strokeWidth={2.5} />}
          </button>
        </div>

        {/* picker de mídias: do celular ou da plataforma */}
        {pickerAberto && (
          <div className="mt-3 rounded-2xl border border-border bg-background p-3">
            <button
              type="button"
              onClick={() => inputArquivo.current?.click()}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-3.5 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              <ImagePlus className="size-4.5" />
              Enviar do celular / computador
            </button>

            {daPlataforma.length > 0 && (
              <>
                <p className="mt-3 px-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Seus avatares da plataforma
                </p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {daPlataforma.map((a, i) => {
                    const sel = midias.some((m) => m.src === a.src);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          sel
                            ? setMidias((prev) => prev.filter((m) => m.src !== a.src))
                            : adicionarMidia(a)
                        }
                        className={cn(
                          "relative shrink-0 overflow-hidden rounded-xl border transition-all",
                          sel ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50",
                        )}
                        title={a.nome}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.src} alt={a.nome ?? "Avatar"} className="h-20 w-16 object-cover" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* dicas curtas embaixo (sem poluir o chat) */}
      <div className="space-y-1 px-1">
        <p className="text-[11px] text-muted-foreground">
          O que você escrever vai direto pra IA, do seu jeito. Vídeo de 15s aceita só 1 imagem
          de referência; 6s e 10s aceitam até 3.
        </p>
        {comFala && duracao !== 15 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            Em vídeos de 6s e 10s a voz às vezes não sai tão boa. Pra fala mais caprichada, o
            de 15s acerta mais.
          </p>
        )}
      </div>
    </div>
  );
}
