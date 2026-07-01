"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronRight as Seta } from "lucide-react";

/**
 * Prateleira horizontal (estilo Netflix): título, setas de rolagem e os cards.
 * Os cards entram como children - a rolagem é por scroll nativo + botões.
 */
export function Prateleira({
  titulo,
  verTodosHref,
  children,
}: {
  titulo: string;
  verTodosHref?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ ativo: false, startX: 0, startScroll: 0, moveu: false });

  function rolar(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  }

  // arrastar com o mouse pra rolar (toque já rola nativo)
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    drag.current = {
      ativo: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moveu: false,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || !drag.current.ativo) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moveu = true;
    el.scrollLeft = drag.current.startScroll - dx;
  }

  function onPointerUp() {
    drag.current.ativo = false;
  }

  // se arrastou, cancela o clique (não abre o link sem querer)
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current.moveu) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moveu = false;
    }
  }

  return (
    <section className="group/shelf space-y-2">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
        <div className="flex items-center gap-1">
          {verTodosHref && (
            <Link
              href={verTodosHref}
              className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Ver todos
              <Seta className="size-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => rolar(-1)}
            aria-label="Anterior"
            className="hidden size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:grid"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => rolar(1)}
            aria-label="Próximo"
            className="hidden size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:grid"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className="flex cursor-grab gap-3 overflow-x-auto scroll-smooth pb-2 select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}
