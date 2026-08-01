"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTO_AVATAR } from "@/lib/avatar-modelo";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import type { AvatarCriado } from "@/lib/avatar-modelo";

/**
 * "Avatar da minha foto": a pessoa sobe UMA foto dela e a IA gera um retrato de
 * avatar (image-to-image). POST /api/avatar/da-foto. Ao concluir, o avatar entra
 * na galeria (onCriado) igual aos outros.
 */

export function AvatarDaFoto({
  onSair,
  onCriado,
}: {
  onSair: () => void;
  onCriado?: (a: AvatarCriado) => void;
}) {
  const [nome, setNome] = useState("");
  const [genero, setGenero] = useState<"female" | "male">("female");
  const [foto, setFoto] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pronto = nome.trim().length >= 2 && !!foto;

  async function escolherFoto(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    // converte pra JPEG de verdade (HEIC/AVIF com nome .jpg quebram a IA)
    const dataUrl = await normalizarImagem(file);
    if (!dataUrl) {
      toast.error(ERRO_IMAGEM);
      return;
    }
    setFoto(dataUrl);
  }

  async function gerar() {
    if (!pronto || gerando) return;
    setGerando(true);
    try {
      const res = await fetch("/api/avatar/da-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), genero, foto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.erro || "Não consegui gerar o avatar.");
        return;
      }
      toast.success("Avatar criado! 🎉");
      if (data.avatar) onCriado?.(data.avatar);
      onSair();
    } catch {
      toast.error("Erro de conexão. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-border bg-card p-6 sm:p-8">
      <button
        type="button"
        onClick={onSair}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </button>

      <h2 className="mt-4 text-xl font-black tracking-tight">Avatar da minha foto</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Suba uma foto sua bem iluminada e de frente. A IA cria um avatar seu pra usar
        nos vídeos.
      </p>

      {/* nome */}
      <div className="mt-6">
        <label className="text-sm font-semibold">Nome do avatar</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Eu mesmo"
          maxLength={120}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* genero */}
      <div className="mt-4">
        <label className="text-sm font-semibold">Gênero</label>
        <div className="mt-1.5 flex gap-2">
          {([["female", "Mulher"], ["male", "Homem"]] as const).map(([v, txt]) => (
            <button
              key={v}
              type="button"
              onClick={() => setGenero(v)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                genero === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {/* foto */}
      <div className="mt-4">
        <label className="text-sm font-semibold">Sua foto</label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => escolherFoto(e.target.files?.[0])}
        />
        {foto ? (
          <div className="mt-1.5 relative w-40 overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto} alt="sua foto" className="aspect-[3/4] w-full object-cover" />
            <button
              type="button"
              onClick={() => setFoto(null)}
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-1.5 flex aspect-[3/4] w-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            <ImagePlus className="size-7" />
            <span className="text-xs font-semibold">Subir foto</span>
          </button>
        )}
      </div>

      {/* gerar */}
      <div className="mt-6">
        <button
          type="button"
          onClick={gerar}
          disabled={!pronto || gerando}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
            pronto && !gerando
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {gerando ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {gerando ? "Gerando o avatar..." : `Gerar avatar (${CUSTO_AVATAR} créditos)`}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {gerando
            ? "A IA está criando seu avatar. Leva alguns segundos. ✨"
            : "Dica: use uma foto nítida, rosto bem visível e de frente."}
        </p>
      </div>
    </div>
  );
}
