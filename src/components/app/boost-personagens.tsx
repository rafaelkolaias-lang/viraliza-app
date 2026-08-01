"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Upload, Loader2, Trash2, X, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import { elencoDoFormato, type FrutaPersonagem } from "@/lib/viral-boost";

/**
 * Escolha do elenco do Viral Boost: os personagens da casa mais os que a pessoa
 * subiu. A foto é o que trava o personagem no vídeo, então subir o próprio é o
 * que deixa ela usar a fruta dela, a avó dela ou o mascote da loja.
 */

function Card({
  p,
  ativo,
  onEscolher,
  onExcluir,
}: {
  p: FrutaPersonagem;
  ativo: boolean;
  onEscolher: () => void;
  onExcluir?: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onEscolher}
        aria-pressed={ativo}
        className={cn(
          "w-full overflow-hidden rounded-2xl border bg-card/60 p-2 text-left transition-all",
          ativo
            ? "border-primary shadow-[0_0_28px_-10px_var(--color-primary)] ring-2 ring-primary/30"
            : "border-border/60 hover:border-primary/40",
        )}
      >
        <span className="relative block overflow-hidden rounded-xl bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imagem} alt={p.nome} className="aspect-square w-full object-contain" />
          {ativo && (
            <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow">
              <Check className="size-3.5" />
            </span>
          )}
        </span>
        <span className={cn("mt-2 block text-sm font-semibold", ativo && "text-primary")}>
          {p.nome}
        </span>
        <span className="line-clamp-2 block text-[11px] leading-snug text-muted-foreground">
          {p.jeito}
        </span>
      </button>
      {onExcluir && (
        <button
          type="button"
          onClick={onExcluir}
          title="Excluir personagem"
          className="absolute left-3 top-3 grid size-7 place-items-center rounded-lg bg-black/60 text-white/80 opacity-0 backdrop-blur transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100 sm:opacity-0 sm:hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function BoostPersonagens({
  formato,
  escolhidos,
  onEscolher,
  onLista,
  max,
}: {
  formato: string;
  escolhidos: string[];
  onEscolher: (chaves: string[]) => void;
  /** avisa a tela de fora quais personagens a pessoa tem (pro resumo e pro prompt) */
  onLista?: (lista: FrutaPersonagem[]) => void;
  max: number;
}) {
  const [meus, setMeus] = useState<FrutaPersonagem[]>([]);
  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [jeito, setJeito] = useState("");
  const [genero, setGenero] = useState<"f" | "m">("f");
  const [foto, setFoto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/boost/personagens", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setMeus(d?.personagens ?? []);
        onLista?.(d?.personagens ?? []);
      })
      .catch(() => {});
    // roda uma vez ao abrir: a lista da pessoa não muda sozinha
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(chave: string) {
    onEscolher(
      escolhidos.includes(chave)
        ? escolhidos.filter((c) => c !== chave)
        : escolhidos.length >= max
          ? escolhidos
          : [...escolhidos, chave],
    );
  }

  async function escolherFoto(file?: File | null) {
    if (!file) return;
    try {
      const dataUrl = await normalizarImagem(file);
      if (!dataUrl) {
        toast.error("Não consegui ler essa imagem. Tente um JPG ou PNG.");
        return;
      }
      setFoto(dataUrl);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function salvar() {
    if (!nome.trim() || !foto) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/boost/personagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, jeito, genero, formato, foto }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      setMeus((atual) => {
        const nova = [d.personagem, ...atual];
        onLista?.(nova);
        return nova;
      });
      toggle(d.personagem.chave);
      setAbrindo(false);
      setNome("");
      setJeito("");
      setFoto(null);
      toast.success("Personagem salvo!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(chave: string, nomeDele: string) {
    if (!confirm(`Excluir "${nomeDele}"?`)) return;
    try {
      const r = await fetch(`/api/boost/personagens?id=${encodeURIComponent(chave)}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error();
      setMeus((atual) => {
        const nova = atual.filter((m) => m.chave !== chave);
        onLista?.(nova);
        return nova;
      });
      onEscolher(escolhidos.filter((c) => c !== chave));
    } catch {
      toast.error("Não consegui excluir.");
    }
  }

  const daCasa = elencoDoFormato(formato);
  const meusDoFormato = meus.filter((m) => m.formato === formato);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {daCasa.map((p) => (
          <Card key={p.chave} p={p} ativo={escolhidos.includes(p.chave)} onEscolher={() => toggle(p.chave)} />
        ))}
      </div>

      {meusDoFormato.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Meus personagens
          </h3>
          <div className="group grid grid-cols-2 gap-3 sm:grid-cols-4">
            {meusDoFormato.map((p) => (
              <Card
                key={p.chave}
                p={p}
                ativo={escolhidos.includes(p.chave)}
                onEscolher={() => toggle(p.chave)}
                onExcluir={() => excluir(p.chave, p.nome)}
              />
            ))}
          </div>
        </div>
      )}

      {!abrindo ? (
        <button
          type="button"
          onClick={() => setAbrindo(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <UserPlus className="size-4" />
          Subir o meu personagem
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Novo personagem</p>
            <button
              type="button"
              onClick={() => setAbrindo(false)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            A foto é o que trava o personagem no vídeo. Vale a sua fruta, a sua avó ou o mascote
            da loja: fundo limpo e corpo inteiro funcionam melhor.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="Novo personagem" className="size-20 rounded-xl object-contain" />
            ) : null}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Upload className="size-4" />
              {foto ? "Trocar imagem" : "Escolher imagem"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => escolherFoto(e.target.files?.[0])}
            />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value.slice(0, 40))}
              placeholder="Nome (ex: Melancião)"
              className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
            />
            <input
              value={jeito}
              onChange={(e) => setJeito(e.target.value.slice(0, 120))}
              placeholder="Como ele é (ex: fofoqueiro, fala rápido)"
              className="rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary/60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["f", "m"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenero(g)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  genero === g
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/40",
                )}
              >
                Voz {g === "f" ? "feminina" : "masculina"}
              </button>
            ))}
            <button
              type="button"
              onClick={salvar}
              disabled={!nome.trim() || !foto || salvando}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Salvar personagem
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {escolhidos.length} de {max} escolhido{escolhidos.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
