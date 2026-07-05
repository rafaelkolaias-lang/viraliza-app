"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronRight as Seta, Loader2 } from "lucide-react";
import { CapaCorte } from "@/components/hub/capa-corte";
import { maisVirais } from "@/app/actions/virais";
import type { ViralVideo } from "@/lib/types";

/**
 * Prateleira horizontal (Netflix) que vai CARREGANDO MAIS sozinha conforme o
 * usuário arrasta/rola pro fim (scroll infinito). Não precisa entrar no "Ver todos".
 * Recebe a 1ª leva do servidor e busca as próximas por server action.
 */
export function PrateleiraVirais({
  titulo,
  verTodosHref,
  itensIniciais,
  total,
  nicho,
  emAlta = false,
  porPagina = 20,
}: {
  titulo: string;
  verTodosHref?: string;
  itensIniciais: ViralVideo[];
  total: number;
  nicho?: string;
  emAlta?: boolean;
  porPagina?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ ativo: false, startX: 0, startScroll: 0, moveu: false });

  const [itens, setItens] = useState<ViralVideo[]>(itensIniciais);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const temMais = itens.length < total;

  const carregarMais = useCallback(async () => {
    if (carregando || itens.length >= total) return;
    setCarregando(true);
    try {
      const prox = pagina + 1;
      const { itens: novos } = await maisVirais({ nicho, emAlta, pagina: prox, porPagina });
      setItens((atual) => {
        const vistos = new Set(atual.map((v) => v.id));
        const filtrados = novos.filter((v) => !vistos.has(v.id));
        return filtrados.length ? [...atual, ...filtrados] : atual;
      });
      setPagina(prox);
    } finally {
      setCarregando(false);
    }
  }, [carregando, itens.length, total, pagina, nicho, emAlta, porPagina]);

  function talvezCarregar(el: HTMLDivElement) {
    // perto do fim (menos de 1.5 largura de tela restando) -> puxa a próxima leva
    if (el.scrollWidth - (el.scrollLeft + el.clientWidth) < el.clientWidth * 1.5) {
      carregarMais();
    }
  }

  function rolar(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
    if (dir === 1) talvezCarregar(el);
  }

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    talvezCarregar(e.currentTarget);
  }

  // arrastar com o mouse pra rolar (toque já rola nativo)
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    drag.current = { ativo: true, startX: e.clientX, startScroll: el.scrollLeft, moveu: false };
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
              Ver em grade
              <Seta className="size-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => rolar(-1)}
            aria-label="Anterior"
            className="hidden size-8 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:grid"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => rolar(1)}
            aria-label="Próximo"
            className="hidden size-8 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground md:grid"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className="flex cursor-grab gap-3 overflow-x-auto scroll-smooth pb-2 select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {itens.map((v) => (
          <CapaCorte key={v.id} video={v} />
        ))}

        {temMais && (
          <button
            type="button"
            onClick={carregarMais}
            aria-label="Carregar mais"
            className="grid w-[150px] shrink-0 cursor-pointer place-items-center rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary sm:w-[170px]"
            style={{ aspectRatio: "9 / 16" }}
          >
            <span className="flex flex-col items-center gap-2 text-xs font-medium">
              <Loader2 className={carregando ? "size-6 animate-spin" : "size-6"} />
              {carregando ? "Carregando..." : "Mais vídeos"}
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
