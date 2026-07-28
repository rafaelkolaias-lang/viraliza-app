"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvatarCriado } from "@/components/app/avatar-quiz";

/**
 * "Subir avatar pronto": a pessoa sobe a imagem do avatar dela e usa direto, SEM
 * gerar nada e SEM gastar crédito. POST /api/avatar/subir. Ao concluir, entra na
 * galeria (onCriado) igual aos outros avatares.
 */

function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("falha ao ler o arquivo"));
    r.readAsDataURL(file);
  });
}

export function AvatarSubir({
  onSair,
  onCriado,
}: {
  onSair: () => void;
  onCriado?: (a: AvatarCriado) => void;
}) {
  const [nome, setNome] = useState("");
  const [genero, setGenero] = useState<"female" | "male">("female");
  const [foto, setFoto] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pronto = nome.trim().length >= 2 && !!foto;

  async function escolherFoto(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    try {
      setFoto(await lerArquivo(file));
    } catch {
      toast.error("Não consegui ler essa imagem.");
    }
  }

  async function enviar() {
    if (!pronto || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch("/api/avatar/subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), genero, foto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.erro || "Não consegui salvar o avatar.");
        return;
      }
      toast.success("Avatar adicionado! 🎉");
      if (data.avatar) onCriado?.(data.avatar);
      onSair();
    } catch {
      toast.error("Erro de conexão. Tente de novo.");
    } finally {
      setEnviando(false);
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

      <h2 className="mt-4 text-xl font-black tracking-tight">Subir avatar pronto</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Já tem a imagem do seu avatar? Suba aqui e use direto nos vídeos.{" "}
        <span className="font-semibold text-primary">Sem gerar nada, de graça.</span>
      </p>

      {/* nome */}
      <div className="mt-6">
        <label className="text-sm font-semibold">Nome do avatar</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Meu avatar"
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

      {/* imagem */}
      <div className="mt-4">
        <label className="text-sm font-semibold">Imagem do avatar</label>
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
            <img src={foto} alt="avatar" className="aspect-[3/4] w-full object-cover" />
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
            <span className="text-xs font-semibold">Subir imagem</span>
          </button>
        )}
      </div>

      {/* enviar */}
      <div className="mt-6">
        <button
          type="button"
          onClick={enviar}
          disabled={!pronto || enviando}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
            pronto && !enviando
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {enviando ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
          {enviando ? "Enviando..." : "Adicionar avatar (grátis)"}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          A imagem fica salva nos seus avatares pra usar em quantos vídeos quiser.
        </p>
      </div>
    </div>
  );
}
