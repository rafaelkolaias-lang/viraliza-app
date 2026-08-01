"use client";

import Image from "next/image";
import {
  Eye,
  Clock,
  Mic,
  MicOff,
  MessageSquare,
  Move,
  Pencil,
  Sparkles,
} from "lucide-react";
import { duracaoPorChave, TONS_LAB, VOZES_LAB, TONALIDADES_LAB } from "@/lib/lab-video";
import { movimentoPorChave } from "@/lib/movimentos";
import type { ConfigVideoLab } from "@/components/app/lab-video";

/**
 * Revisão final antes de gerar o vídeo: duração, voz, movimento e a fala de cada
 * take, com atalho pra voltar e corrigir. Última parada antes de gastar crédito.
 */

export function LabResumoVideo({
  config,
  imagem,
  onEditar,
}: {
  config: ConfigVideoLab;
  imagem: string;
  onEditar: (destino: "config" | "movimento") => void;
}) {
  const dur = duracaoPorChave(config.duracao);
  const mov = movimentoPorChave(config.movimento);
  const tom = TONS_LAB.find((t) => t.chave === config.tom);
  const voz = VOZES_LAB.find((v) => v.chave === config.voz);
  const tonal = TONALIDADES_LAB.find((t) => t.chave === config.tonalidade);
  const comFala = !!dur?.comFala;
  const falasEscritas = config.falas.filter((f) => f?.trim()).length;

  const linhas = [
    {
      chave: "duracao",
      Icone: Clock,
      rotulo: "Duração",
      valor: dur
        ? `${dur.total} segundos${dur.takes > 1 ? ` (${dur.takes} takes de ${dur.segundos}s)` : ""}`
        : "",
      destino: "config" as const,
    },
    {
      chave: "voz",
      Icone: comFala ? Mic : MicOff,
      rotulo: "Voz",
      valor: comFala
        ? `${voz?.label ?? ""}, ${tonal?.label?.toLowerCase() ?? ""}, tom ${tom?.label?.toLowerCase() ?? ""}`
        : "Vídeo sem fala",
      destino: "config" as const,
    },
    {
      chave: "fala",
      Icone: MessageSquare,
      rotulo: "Fala",
      valor: !comFala
        ? "Não se aplica"
        : falasEscritas === 0
          ? "A IA improvisa na hora"
          : `${falasEscritas} de ${config.falas.length} take${config.falas.length > 1 ? "s" : ""} com texto seu`,
      destino: "config" as const,
    },
    {
      chave: "movimento",
      Icone: Move,
      rotulo: "Movimento",
      valor: mov ? mov.label : "Livre (a IA decide)",
      destino: "movimento" as const,
      video: mov ? `/movimentos/${mov.chave}.mp4` : undefined,
      poster: mov ? `/movimentos/${mov.chave}.jpg` : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-primary" />
        <h2 className="font-semibold">Revise suas configurações</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Confira tudo antes de gerar. Depois de gerar, a gente ainda deixa você fazer
        de novo se não gostar.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        {/* a imagem que vai virar vídeo */}
        <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-2xl border border-primary/50 bg-black/30 shadow-[0_0_30px_-14px_var(--color-primary)] sm:w-44">
          <Image
            src={imagem}
            alt="Imagem base do vídeo"
            fill
            unoptimized
            sizes="(max-width: 640px) 90vw, 176px"
            className="object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5 text-center text-[10px] font-medium text-white">
            Essa imagem vira o vídeo
          </span>
        </div>

        <div className="flex-1 space-y-2">
          {linhas.map((l) => (
            <div
              key={l.chave}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-2.5 transition-colors hover:border-primary/30"
            >
              <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/30 text-primary">
                {l.video ? (
                  <video
                    src={l.video}
                    poster={l.poster}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    className="size-full object-cover"
                  />
                ) : (
                  <l.Icone className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {l.rotulo}
                </p>
                <p className="truncate text-sm font-medium">{l.valor}</p>
              </div>
              <button
                type="button"
                onClick={() => onEditar(l.destino)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Pencil className="size-3" />
                Editar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* as falas, quando a pessoa escreveu */}
      {comFala && falasEscritas > 0 && (
        <div className="space-y-2 rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="size-3" />O que ela fala
          </p>
          {config.falas.map((f, i) =>
            f?.trim() ? (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {config.falas.length > 1 && (
                  <span className="mr-1.5 font-semibold text-primary">Take {i + 1}:</span>
                )}
                {f}
              </p>
            ) : null,
          )}
        </div>
      )}

      {config.instrucoes.trim() && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3" />
            Pedido especial
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{config.instrucoes}</p>
        </div>
      )}
    </div>
  );
}
