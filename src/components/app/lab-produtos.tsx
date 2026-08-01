"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Search,
  Upload,
  Check,
  Loader2,
  ShoppingBag,
  Sparkles,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import { dicaDeEstilo, type EstiloCamera } from "@/lib/estilos-camera";

/**
 * Passo 2 do Viraliza Lab: escolher o produto. Mostra os produtos que a pessoa
 * já subiu + o acervo da Shopee (com busca), e deixa subir uma foto nova na
 * hora. Se o produto não combinar com o estilo de câmera escolhido, aparece uma
 * dica sugerindo o estilo que rende mais (sem travar nada).
 */

export type ProdutoLab = { id: string; titulo: string; imagem?: string; meu: boolean };

function CardProduto({
  p,
  ativo,
  onEscolher,
}: {
  p: ProdutoLab;
  ativo: boolean;
  onEscolher: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      aria-pressed={ativo}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card/60 text-left transition-all",
        ativo
          ? "border-primary ring-2 ring-primary/40"
          : "border-border/60 hover:border-primary/40 hover:bg-card",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-black/30">
        {p.imagem ? (
          <Image
            src={p.imagem}
            alt={p.titulo}
            fill
            unoptimized
            sizes="(max-width: 640px) 33vw, 160px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="grid size-full place-items-center text-muted-foreground">
            <ShoppingBag className="size-6" />
          </span>
        )}
        {p.meu && (
          <span className="absolute left-1 top-1 rounded-full bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
            Meu
          </span>
        )}
        {ativo && (
          <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow">
            <Check className="size-3" />
          </span>
        )}
      </div>
      <p className="line-clamp-2 p-2 text-[11px] leading-snug text-muted-foreground">
        {p.titulo}
      </p>
    </button>
  );
}

/** Caixinha pra subir a foto do produto da pessoa (nome + imagem). */
function SubirProduto({ onSalvo }: { onSalvo: (p: ProdutoLab) => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function escolherArquivo(file?: File | null) {
    if (!file) return;
    try {
      const dataUrl = await normalizarImagem(file);
      setFoto(dataUrl);
      if (!nome) setNome(file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80));
    } catch (e) {
      toast.error(e instanceof Error && e.message === ERRO_IMAGEM
        ? "Não consegui ler essa imagem. Tente outra foto (JPG ou PNG)."
        : "Não consegui ler essa imagem.");
    }
  }

  async function salvar() {
    if (nome.trim().length < 2) return toast.error("Dê um nome ao produto.");
    if (!foto) return toast.error("Escolha a foto do produto.");
    setSalvando(true);
    try {
      const r = await fetch("/api/lab/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), foto }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      toast.success("Produto salvo!");
      onSalvo(d.produto as ProdutoLab);
      setAberto(false);
      setNome("");
      setFoto(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Upload className="size-4" />
        Subir meu produto
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Subir meu produto</h3>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-dashed border-border bg-black/20 transition-colors hover:border-primary/50"
        >
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="Produto" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center text-muted-foreground">
              <Upload className="size-5" />
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => escolherArquivo(e.target.files?.[0])}
        />
        <div className="flex flex-1 flex-col gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={200}
            placeholder="Nome do produto (ex: Short linho feminino)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/60"
          />
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Salvar produto
          </button>
        </div>
      </div>
    </div>
  );
}

export function LabProdutos({
  estilo,
  produto,
  onEscolher,
  onTrocarEstilo,
}: {
  estilo: EstiloCamera;
  produto: ProdutoLab | null;
  onEscolher: (p: ProdutoLab | null) => void;
  onTrocarEstilo: (chave: string) => void;
}) {
  const [meus, setMeus] = useState<ProdutoLab[]>([]);
  const [shopee, setShopee] = useState<ProdutoLab[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [temMais, setTemMais] = useState(false);

  const carregar = useCallback(async (termo: string, pag: number) => {
    setCarregando(true);
    try {
      const r = await fetch(
        `/api/lab/produtos?busca=${encodeURIComponent(termo)}&pagina=${pag}`,
        { cache: "no-store" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao carregar produtos.");
      if (pag === 1) {
        setMeus(d.meus ?? []);
        setShopee(d.shopee ?? []);
      } else {
        setShopee((atual) => [...atual, ...(d.shopee ?? [])]);
      }
      setTemMais(!!d.temMais);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar produtos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // busca com respiro de 400ms (não dispara a cada tecla)
  useEffect(() => {
    const t = setTimeout(() => {
      setPagina(1);
      carregar(busca, 1);
    }, 400);
    return () => clearTimeout(t);
  }, [busca, carregar]);

  const dica = produto ? dicaDeEstilo(produto.titulo, estilo.chave) : null;

  return (
    <div className="space-y-4">
      {/* lembrete do estilo escolhido: o que ele faz bem */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-2.5 text-xs sm:text-sm">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span>
          Estilo <strong className="text-primary">{estilo.label}</strong>: melhor para{" "}
          {estilo.paraQuem.toLowerCase()}.
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto pelo nome"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        <SubirProduto
          onSalvo={(p) => {
            setMeus((atual) => [p, ...atual]);
            onEscolher(p);
          }}
        />
      </div>

      {/* dica de combinação produto x estilo (só aparece quando não bate) */}
      {dica && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200 sm:text-sm">
          <Lightbulb className="size-4 shrink-0" />
          <span>{dica.mensagem}</span>
          <button
            type="button"
            onClick={() => onTrocarEstilo(dica.sugerido.chave)}
            className="ml-auto rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-500/30"
          >
            Trocar para {dica.sugerido.label}
          </button>
        </div>
      )}

      {meus.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Meus produtos
          </h3>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
            {meus.map((p) => (
              <CardProduto
                key={p.id}
                p={p}
                ativo={produto?.id === p.id}
                onEscolher={() => onEscolher(produto?.id === p.id ? null : p)}
              />
            ))}
          </div>
        </div>
      )}

      <div id="lab-produtos-shopee" className="space-y-2 scroll-mt-24">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Produtos da Shopee
        </h3>
        {carregando && shopee.length === 0 ? (
          <div className="grid place-items-center py-10 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : shopee.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado. Tente outro nome ou suba a foto do seu produto.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
              {shopee.map((p) => (
                <CardProduto
                  key={p.id}
                  p={p}
                  ativo={produto?.id === p.id}
                  onEscolher={() => onEscolher(produto?.id === p.id ? null : p)}
                />
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {temMais && (
                <button
                  type="button"
                  disabled={carregando}
                  onClick={() => {
                    const prox = pagina + 1;
                    setPagina(prox);
                    carregar(busca, prox);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                >
                  {carregando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                  Ver mais produtos
                </button>
              )}
              {/* volta pro tamanho inicial quando a lista já cresceu (some no celular
                  a rolagem infinita e a pessoa reencontra a busca) */}
              {pagina > 1 && (
                <button
                  type="button"
                  disabled={carregando}
                  onClick={() => {
                    setPagina(1);
                    carregar(busca, 1);
                    document
                      .getElementById("lab-produtos-shopee")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                >
                  <ChevronUp className="size-4" />
                  Ver menos
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
