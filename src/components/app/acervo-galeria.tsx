"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Download, X, Film, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/app/paginacao";
import { driveThumb, drivePreview, driveDownload } from "@/lib/drive";

type Item = { id: string; nome: string };

const POR_PAGINA = 48;

function normaliza(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function AcervoGaleria({ itens }: { itens: Item[] }) {
  const [aberto, setAberto] = useState<Item | null>(null);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const b = normaliza(busca);
    return b ? itens.filter((i) => normaliza(i.nome).includes(b)) : itens;
  }, [itens, busca]);

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA);
  const pAtual = Math.min(pagina, Math.max(1, totalPaginas));
  const visiveis = filtrados.slice((pAtual - 1) * POR_PAGINA, pAtual * POR_PAGINA);

  // fecha com ESC + trava o scroll do fundo enquanto o modal está aberto
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <div className="space-y-4">
      {/* busca dentro da categoria */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar nesta categoria..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(1);
          }}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visiveis.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAberto(item)}
            className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-black text-left transition-all duration-200 hover:scale-[1.03] hover:border-primary/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={driveThumb(item.id, 320)}
              alt={item.nome}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/25">
              <span className="grid size-10 place-items-center rounded-full bg-black/55 opacity-80 backdrop-blur-sm transition-transform group-hover:scale-110">
                <Play className="size-4 fill-white text-white" />
              </span>
            </div>
            <p className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-medium text-white">
              {item.nome}
            </p>
          </button>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Film className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum vídeo encontrado</p>
        </div>
      )}

      <Paginacao
        pagina={pAtual}
        totalPaginas={totalPaginas}
        onMudar={(p) => {
          setPagina(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* ===== MODAL PLAYER (iframe só carrega quando aberto) ===== */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setAberto(null)}
        >
          <div
            className="relative w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium text-white">
                {aberto.nome}
              </p>
              <button
                type="button"
                onClick={() => setAberto(null)}
                aria-label="Fechar"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={drivePreview(aberto.id)}
                title={aberto.nome}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                className="size-full"
              />
            </div>
            <div className="mt-2">
              <a
                href={driveDownload(aberto.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
              >
                <Download className="size-4" />
                Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
