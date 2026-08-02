"use client";

import { useState } from "react";
import { ImageOff, ExternalLink, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Todas as imagens geradas na plataforma, de todo mundo.
 *
 * Serve pra bater o olho na QUALIDADE: quando o motor entrega quadro ruidoso ou
 * a cena sai errada, é aqui que dá pra ver o padrão sem depender de alguém
 * reclamar. Por isso a grade é grande e sem corte esperto: a imagem aparece
 * inteira, do jeito que a pessoa recebeu.
 */

export type ImagemAdmin = {
  id: string;
  origem: string;
  titulo: string;
  imagemUrl: string;
  quando: string;
  videos: number;
  usuarioNome: string;
  usuarioEmail: string;
};

const ORIGENS = [
  { chave: "todas", label: "Todas" },
  { chave: "lab", label: "Viraliza Labs" },
  { chave: "avatar", label: "Personalize com IA" },
  { chave: "boost", label: "Viral Boost" },
];

const COR_ORIGEM: Record<string, string> = {
  lab: "border-primary/40 bg-primary/10 text-primary",
  avatar: "border-purple-400/40 bg-purple-400/10 text-purple-300",
  boost: "border-orange-500/40 bg-orange-500/10 text-orange-300",
};

export function AdminImagens({ imagens }: { imagens: ImagemAdmin[] }) {
  const [origem, setOrigem] = useState("todas");
  const [busca, setBusca] = useState("");

  const filtradas = imagens.filter((i) => {
    if (origem !== "todas" && i.origem !== origem) return false;
    if (!busca.trim()) return true;
    const t = busca.trim().toLowerCase();
    return (
      i.titulo.toLowerCase().includes(t) ||
      i.usuarioNome.toLowerCase().includes(t) ||
      i.usuarioEmail.toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-card/40 p-1">
          {ORIGENS.map((o) => {
            const n =
              o.chave === "todas"
                ? imagens.length
                : imagens.filter((i) => i.origem === o.chave).length;
            return (
              <button
                key={o.chave}
                type="button"
                onClick={() => setOrigem(o.chave)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  origem === o.chave
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label} <span className="opacity-60">({n})</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-50 flex-1">
          <Filter className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por usuário, e-mail ou título"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-12 text-center">
          <ImageOff className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">Nenhuma imagem por aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtradas.map((i) => (
            <div
              key={i.id}
              className="overflow-hidden rounded-2xl border border-border/60 bg-card/40"
            >
              <a
                href={i.imagemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-9/16 bg-background/60"
              >
                {/* sem next/image: a URL é do serverrk e o que importa aqui é ver o
                    arquivo exatamente como ele foi entregue */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i.imagemUrl}
                  alt={i.titulo}
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  <ExternalLink className="size-3.5" />
                </span>
                <span
                  className={cn(
                    "absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur",
                    COR_ORIGEM[i.origem] ?? "border-border bg-background/80",
                  )}
                >
                  {i.origem}
                </span>
              </a>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium" title={i.titulo}>
                  {i.titulo}
                </p>
                <p className="truncate text-[11px] text-muted-foreground" title={i.usuarioEmail}>
                  {i.usuarioNome || i.usuarioEmail}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(i.quando).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {i.videos > 0 && ` · ${i.videos} vídeo${i.videos > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
