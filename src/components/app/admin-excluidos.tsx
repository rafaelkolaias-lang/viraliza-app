"use client";

import { useMemo, useState } from "react";
import { Coins, Play, Search, Trash2 } from "lucide-react";

export type ExcluidoDTO = {
  id: string;
  produto: string;
  tipo: string;
  duracao?: number;
  videoUrl?: string;
  thumb?: string;
  criadoEm: string;
  excluidoEm: string | null;
  excluidoPor: string; // email de quem excluiu
  dono: string;
  email: string; // email do dono
  creditos: number;
};

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Auditoria dos vídeos excluídos: quem excluiu, de quem era, e dá pra assistir. */
export function AdminExcluidos({ itens }: { itens: ExcluidoDTO[] }) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const visiveis = useMemo(
    () =>
      termo
        ? itens.filter(
            (v) =>
              v.dono.toLowerCase().includes(termo) ||
              v.email.toLowerCase().includes(termo) ||
              v.excluidoPor.toLowerCase().includes(termo) ||
              v.produto.toLowerCase().includes(termo),
          )
        : itens,
    [itens, termo],
  );

  if (itens.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
        <Trash2 className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nada excluído ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando alguém excluir um vídeo, o registro aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 sm:max-w-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por dono, quem excluiu ou produto..."
          className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="space-y-2.5">
        {visiveis.map((v) => {
          const excluidoPeloDono = v.excluidoPor === v.email;
          return (
            <div
              key={v.id}
              className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-card p-4"
            >
              {/* mídia (se ainda hospedada, dá pra assistir) */}
              {v.videoUrl ? (
                <video
                  src={v.videoUrl}
                  poster={v.thumb}
                  controls
                  preload="none"
                  playsInline
                  className="aspect-[9/16] w-[110px] shrink-0 rounded-xl border border-border bg-black object-cover"
                />
              ) : (
                <div className="grid aspect-[9/16] w-[110px] shrink-0 place-items-center rounded-xl border border-border bg-muted">
                  <Play className="size-5 text-muted-foreground" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold leading-tight">{v.produto}</p>
                  {v.creditos > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Coins className="size-3" />
                      {v.creditos} créditos
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dono: <span className="font-medium text-foreground">{v.dono}</span> ({v.email})
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Excluído por:{" "}
                  <span className="font-medium text-foreground">
                    {excluidoPeloDono ? "o próprio dono" : v.excluidoPor}
                  </span>
                  {v.excluidoEm ? ` em ${fmtData.format(new Date(v.excluidoEm))}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  Criado em {fmtData.format(new Date(v.criadoEm))}
                  {v.duracao ? ` · ${v.duracao}s` : ""}
                </p>
                {v.videoUrl && (
                  <a
                    href={v.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-block text-[11px] font-medium text-primary hover:underline"
                  >
                    Abrir vídeo em nova aba
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
