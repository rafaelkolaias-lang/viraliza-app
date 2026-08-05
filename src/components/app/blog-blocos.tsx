import { Sparkles } from "lucide-react";
import type { BlocoArtigo } from "@/lib/blog";

/** Desenha os blocos de um artigo do blog. Componente puro (sem estado e sem
 *  acesso a dados), então serve tanto pro servidor (a prévia) quanto pro cliente
 *  (o resto que abre no "Continuar lendo"). */
export function BlogBlocos({ blocos }: { blocos: BlocoArtigo[] }) {
  return (
    <div className="space-y-4">
      {blocos.map((b, i) => {
        if (b.tipo === "subtitulo") {
          return (
            <h2 key={i} className="pt-2 text-lg font-semibold tracking-tight sm:text-xl">
              {b.texto}
            </h2>
          );
        }
        if (b.tipo === "lista") {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {b.itens.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.tipo === "destaque") {
          return (
            <div
              key={i}
              className="flex gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed">{b.texto}</p>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {b.texto}
          </p>
        );
      })}
    </div>
  );
}
