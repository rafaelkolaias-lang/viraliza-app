"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Download, Trash2, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { linkBaixar } from "@/lib/utils";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import type { CenarioMeu } from "@/lib/cenarios-usuario";

/**
 * Galeria "Meus cenários" (aba Cenários do Personalize com IA): a pessoa sobe a
 * foto de um ambiente e ele vira uma opção do passo Cenário do Lab — só pra ela.
 * Sem IA e sem custo: a gente só hospeda e registra.
 */
export function MeusCenarios() {
  const [cenarios, setCenarios] = useState<CenarioMeu[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [subindo, setSubindo] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/cenarios", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCenarios(d?.cenarios ?? []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function subir(file?: File | null) {
    if (!file) return;
    setSubindo(true);
    try {
      const dataUrl = await normalizarImagem(file);
      if (!dataUrl) throw new Error(ERRO_IMAGEM);
      const nome = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Meu cenário";
      const r = await fetch("/api/cenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, foto: dataUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao subir o cenário.");
      setCenarios((l) => [d.cenario, ...l]);
      toast.success("Cenário salvo! Ele já aparece no passo Cenário do Lab.");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === ERRO_IMAGEM
          ? "Não consegui ler essa imagem. Tente outra foto (JPG ou PNG)."
          : e instanceof Error
            ? e.message
            : "Falha ao subir o cenário.",
      );
    } finally {
      setSubindo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function excluir(c: CenarioMeu) {
    if (!confirm(`Excluir o cenário "${c.nome}"?`)) return;
    setExcluindo(c.id);
    try {
      const r = await fetch(`/api/cenarios?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setCenarios((l) => l.filter((i) => i.id !== c.id));
    } catch {
      toast.error("Não consegui excluir.");
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Suba a foto de um ambiente (quarto, loja, área externa...) e ele vira uma
          opção de cenário nos seus vídeos. Só você vê os seus.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subindo}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {subindo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {subindo ? "Subindo..." : "Subir cenário"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => subir(e.target.files?.[0])}
        />
      </div>

      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando seus cenários...
        </div>
      ) : cenarios.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
            <ImageIcon className="size-6" />
          </span>
          <p className="font-medium">Nenhum cenário seu ainda</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Suba a foto de um ambiente e ela aparece na hora de criar seus vídeos no
            Lab, junto com os cenários da plataforma.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cenarios.map((c) => (
            <div
              key={c.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 transition-all hover:border-primary/50"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.imagemUrl}
                  alt={c.nome}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex items-center gap-1 p-2.5">
                <p className="min-w-0 flex-1 truncate text-sm font-medium" title={c.nome}>
                  {c.nome}
                </p>
                <a
                  href={linkBaixar(c.imagemUrl, c.nome || "cenario")}
                  title="Baixar"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Download className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => excluir(c)}
                  disabled={excluindo === c.id}
                  title="Excluir"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  {excluindo === c.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
