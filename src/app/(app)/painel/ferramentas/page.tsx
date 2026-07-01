import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  Clapperboard,
  MapPin,
  ArrowRight,
  Wrench,
  Stamp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ferramentas" };

type Ferramenta = {
  titulo: string;
  desc: string;
  href?: string;
  icon: typeof Sparkles;
  capa?: string;
  gradiente?: string;
  cor: string;
  emBreve?: boolean;
};

const FERRAMENTAS: Ferramenta[] = [
  {
    titulo: "Editor automático",
    desc: "Monte vídeos com legenda ou voz narrada a partir de fotos e clipes.",
    href: "/painel/novo",
    icon: Sparkles,
    capa: "/capas/editor.png",
    cor: "text-emerald-300",
  },
  {
    titulo: "Aplicar marca em lote",
    desc: "Suba vários vídeos + sua logo/@ e gere todos com a marca de uma vez.",
    href: "/painel/lote",
    icon: Stamp,
    capa: "/capas/lote.png",
    cor: "text-emerald-300",
  },
  {
    titulo: "MapsLeads",
    desc: "Garimpe empresas por cidade e nicho, com contatos e mensagem pronta.",
    href: "/painel/leads",
    icon: MapPin,
    capa: "/capas/mapsleads.png",
    cor: "text-amber-300",
  },
  {
    titulo: "Cortes de qualquer vídeo",
    desc: "Cole o link de um vídeo e receba os cortes virais prontos.",
    href: "/painel/cortes",
    icon: Clapperboard,
    capa: "/capas/cortes-auto.png",
    cor: "text-rose-300",
  },
];

export default function FerramentasPage() {
  const disponiveis = FERRAMENTAS.filter((f) => !f.emBreve).length;

  return (
    <div className="space-y-7">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-grid-glow p-6 md:p-8">
        <div className="grain absolute inset-0" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Wrench className="size-3.5" />
            {disponiveis} ferramentas disponíveis
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-glow md:text-4xl">
            Ferramentas
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground md:text-base">
            Tudo que você precisa pra <strong className="text-foreground">produzir</strong>{" "}
            e <strong className="text-foreground">prospectar</strong> - num lugar só.
          </p>
        </div>
      </section>

      {/* ===== CARDS ===== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {FERRAMENTAS.map((f) => {
          const Icon = f.icon;
          const card = (
            <div
              className={cn(
                "group relative aspect-[3/4] overflow-hidden rounded-2xl border border-border transition-all duration-200",
                f.emBreve
                  ? "opacity-90"
                  : "hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10",
              )}
            >
              {/* fundo: capa ou gradiente */}
              {f.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.capa}
                  alt={f.titulo}
                  className={cn(
                    "absolute inset-0 size-full object-cover transition-transform duration-300",
                    f.emBreve ? "opacity-70 grayscale-[30%]" : "group-hover:scale-105",
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-br",
                    f.gradiente,
                  )}
                />
              )}

              {/* escurece pra leitura */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/45 to-black/10" />

              {/* status */}
              <div className="absolute right-3 top-3">
                {f.emBreve ? (
                  <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm">
                    Em breve
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                    Disponível
                  </span>
                )}
              </div>

              {/* conteúdo */}
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="mb-3 grid size-11 place-items-center rounded-xl bg-white/10 backdrop-blur-sm">
                  <Icon className={cn("size-6", f.cor)} />
                </span>
                <h2 className="text-base font-semibold text-white">{f.titulo}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-white/70">{f.desc}</p>
                {!f.emBreve && (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary transition-transform group-hover:translate-x-0.5">
                    Abrir
                    <ArrowRight className="size-3.5" />
                  </span>
                )}
              </div>
            </div>
          );

          return f.href && !f.emBreve ? (
            <Link key={f.titulo} href={f.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={f.titulo} className="cursor-default">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
