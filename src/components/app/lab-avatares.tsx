"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Check, Upload, Loader2, X, Hand, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { cn, linkBaixar } from "@/lib/utils";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import { AVATARES_PRONTOS } from "@/lib/avatares-prontos";
import type { EstiloCamera } from "@/lib/estilos-camera";

/**
 * Passo "Escolha o avatar" do Viraliza Lab: os avatares da plataforma (grátis) +
 * os da pessoa + a opção NENHUM. Nenhum existe por causa do estilo POV (Mãos):
 * ali não aparece pessoa, só as mãos segurando o produto, então escolher rosto
 * não faz sentido. Nos outros estilos, "Nenhum" gera uma pessoa anônima (mãos e
 * corpo genéricos), útil pra quem não quer avatar fixo.
 */

export type AvatarLab = { id: string; nome: string; imagemUrl: string; pronto?: boolean };

/** valor especial de "sem avatar" (POV ou pessoa anônima) */
export const SEM_AVATAR: AvatarLab = { id: "nenhum", nome: "Nenhum", imagemUrl: "" };

export function LabAvatares({
  estilo,
  meus,
  escolhido,
  onEscolher,
  onNovoAvatar,
  onExcluirAvatar,
}: {
  estilo: EstiloCamera;
  meus: AvatarLab[];
  escolhido: AvatarLab | null;
  onEscolher: (a: AvatarLab | null) => void;
  onNovoAvatar: (a: AvatarLab) => void;
  onExcluirAvatar?: (id: string) => void;
}) {
  const [subindo, setSubindo] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ehPov = estilo.chave === "maos";

  async function excluir(a: AvatarLab) {
    if (!confirm(`Excluir o avatar "${a.nome}"? Os vídeos já feitos com ele continuam.`))
      return;
    setExcluindo(a.id);
    try {
      const r = await fetch(`/api/avatar/${a.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao excluir.");
      if (escolhido?.id === a.id) onEscolher(null);
      onExcluirAvatar?.(a.id);
      toast.success("Avatar excluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(null);
    }
  }

  const prontos: AvatarLab[] = AVATARES_PRONTOS.map((a) => ({
    id: `pronto-${a.id}`,
    nome: a.nome,
    imagemUrl: a.src,
    pronto: true,
  }));

  async function subir(file?: File | null) {
    if (!file) return;
    setSubindo(true);
    try {
      const dataUrl = await normalizarImagem(file);
      const r = await fetch("/api/avatar/subir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || "Meu avatar",
          foto: dataUrl,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao subir o avatar.");
      const novo: AvatarLab = {
        id: d.avatar?.id ?? crypto.randomUUID(),
        nome: d.avatar?.nome ?? "Meu avatar",
        imagemUrl: d.avatar?.imagemUrl ?? dataUrl,
      };
      onNovoAvatar(novo);
      onEscolher(novo);
      toast.success("Avatar salvo!");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message === ERRO_IMAGEM
          ? "Não consegui ler essa imagem. Tente outra foto (JPG ou PNG)."
          : e instanceof Error
            ? e.message
            : "Falha ao subir o avatar.",
      );
    } finally {
      setSubindo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /** Card no formato do grid: foto quadrada + nome embaixo. Os avatares DA PESSOA
   *  ganham atalhos de baixar e excluir (os prontos da plataforma, não). */
  function Card({ a }: { a: AvatarLab }) {
    const ativo = escolhido?.id === a.id;
    const meu = !a.pronto;
    return (
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-card/60 p-1.5 transition-all",
          ativo
            ? "border-primary ring-2 ring-primary/40"
            : "border-border/60 hover:border-primary/40 hover:bg-card",
        )}
      >
        <button
          type="button"
          onClick={() => onEscolher(a)}
          aria-pressed={ativo}
          className="w-full text-left"
        >
          <div className="relative aspect-square overflow-hidden rounded-lg bg-black/30">
            <Image
              src={a.imagemUrl}
              alt={a.nome}
              fill
              unoptimized
              sizes="(max-width: 640px) 33vw, 150px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {ativo && (
              <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                <Check className="size-3" />
              </span>
            )}
          </div>
          <p className="truncate px-1 pb-0.5 pt-1.5 text-center text-[11px] font-medium">
            {a.nome}
          </p>
        </button>

        {meu && (
          <div className="absolute left-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
            <a
              href={linkBaixar(a.imagemUrl, `${a.nome}.png`)}
              onClick={(e) => e.stopPropagation()}
              title="Baixar avatar"
              aria-label={`Baixar ${a.nome}`}
              className="grid size-6 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black/90"
            >
              <Download className="size-3" />
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                excluir(a);
              }}
              disabled={excluindo === a.id}
              title="Excluir avatar"
              aria-label={`Excluir ${a.nome}`}
              className="grid size-6 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-destructive disabled:opacity-50"
            >
              {excluindo === a.id ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  /** Card "Nenhum": sem pessoa na cena (obrigatório no POV). */
  function CardNenhum() {
    const ativo = escolhido?.id === SEM_AVATAR.id;
    return (
      <button
        type="button"
        onClick={() => onEscolher(SEM_AVATAR)}
        aria-pressed={ativo}
        className={cn(
          "overflow-hidden rounded-xl border bg-card/60 p-1.5 transition-all",
          ativo
            ? "border-primary ring-2 ring-primary/40"
            : "border-border/60 hover:border-primary/40 hover:bg-card",
        )}
      >
        <div className="grid aspect-square place-items-center rounded-lg bg-black/30 text-primary">
          {ehPov ? <Hand className="size-7" /> : <X className="size-7" />}
        </div>
        <p className="truncate px-1 pb-0.5 pt-1.5 text-center text-[11px] font-medium">
          Nenhum
        </p>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {ehPov ? (
        <div className="flex gap-2.5 rounded-xl border border-primary/25 bg-primary/8 p-3 text-xs leading-relaxed sm:text-[13px]">
          <Hand className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            No estilo <strong className="text-primary">Mãos (POV)</strong> não aparece
            rosto nem corpo: a imagem mostra só as mãos segurando o produto. Pode
            deixar em <strong>Nenhum</strong>. Se escolher um avatar, usamos o tom de
            pele e as mãos dele na cena.
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Escolha quem vai aparecer com o produto na imagem e no vídeo. Os avatares da
          plataforma são grátis.
        </p>
      )}

      {meus.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Meus avatares</h3>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-7">
            {meus.map((a) => (
              <Card key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Avatares da plataforma</h3>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-7">
          <CardNenhum />
          {prontos.map((a) => (
            <Card key={a.id} a={a} />
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subindo}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            <span className="grid aspect-square w-full place-items-center rounded-lg bg-black/20">
              {subindo ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5" />
              )}
            </span>
            <span className="pb-0.5 text-center text-[10px] font-medium leading-tight">
              Subir avatar
            </span>
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => subir(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
