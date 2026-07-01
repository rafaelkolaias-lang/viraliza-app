import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Carta grande de uma coleção/categoria (estilo Netflix): capa de fundo,
 * título e contagem por cima. É leve - usa imagem estática, não vídeo.
 * Ao clicar, abre a coleção (onde os vídeos de fato carregam).
 */
export function CategoriaCard({
  href,
  titulo,
  subtitulo,
  capa,
  emBreve = false,
}: {
  href: string;
  titulo: string;
  subtitulo: string;
  capa: string;
  emBreve?: boolean;
}) {
  const conteudo = (
    <div className="relative aspect-[4/5]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={capa}
        alt={titulo}
        loading="lazy"
        className={cn(
          "size-full object-cover transition-transform duration-300",
          emBreve
            ? "opacity-60 grayscale-[35%]"
            : "group-hover:scale-105",
        )}
      />
      {/* escurece a base pra leitura do texto */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

      {emBreve ? (
        <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur-sm">
          Em breve
        </span>
      ) : (
        <span className="absolute right-2 top-2 grid size-8 translate-y-0 place-items-center rounded-full bg-background/70 text-foreground opacity-100 backdrop-blur-sm transition-all duration-200 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      )}

      {/* título + contagem */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-semibold leading-tight text-white drop-shadow">
          {titulo}
        </p>
        <p className="mt-0.5 text-xs font-medium text-white/75">{subtitulo}</p>
      </div>
    </div>
  );

  const base =
    "group relative block overflow-hidden rounded-xl border border-border";

  if (emBreve) {
    return (
      <div className={cn(base, "cursor-default")} aria-disabled>
        {conteudo}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        base,
        "transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
      )}
    >
      {conteudo}
    </Link>
  );
}
