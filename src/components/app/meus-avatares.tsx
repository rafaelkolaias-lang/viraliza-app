"use client";

import { useState } from "react";
import {
  Plus,
  Upload,
  UserRound,
  Image as ImageIcon,
  Download,
  Trash2,
  Loader2,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { cn, linkBaixar } from "@/lib/utils";
import type { AvatarCriado } from "@/lib/avatar-modelo";
import { AvatarCriar } from "@/components/app/avatar-criar";
import { AVATARES_PRONTOS } from "@/lib/avatares-prontos";
import { AvatarDaFoto } from "@/components/app/avatar-da-foto";
import { AvatarComProduto } from "@/components/app/avatar-com-produto";
import { AvatarSubir } from "@/components/app/avatar-subir";

/**
 * FRONT do "Meus avatares": a galeria de influenciadores da pessoa, em cards
 * grandes (a foto é o que importa aqui, não o texto).
 *
 * Duas portas de entrada no topo: CRIAR COM IA (a IA gera a pessoa) e ENVIAR
 * IMAGEM (a pessoa já tem a foto e não gasta crédito). Cada card traz o nome, a
 * ficha de quem é aquela pessoa e os botões de baixar e excluir.
 */

type Modo = null | "zero" | "foto" | "produto" | "subir";
type Aba = "influencers" | "cenarios";

/** Card grande da galeria: foto em cima, nome e ficha embaixo. */
function CardAvatar({
  nome,
  ficha,
  imagemUrl,
  onExcluir,
  excluindo,
}: {
  nome: string;
  ficha?: string;
  imagemUrl: string;
  onExcluir?: () => void;
  excluindo?: boolean;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-[0_0_30px_-12px_var(--color-primary)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagemUrl}
          alt={nome}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-sm font-semibold">{nome}</p>
        {ficha && (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{ficha}</p>
        )}
        <div className="mt-auto flex items-center justify-end gap-1 pt-2">
          <a
            href={linkBaixar(imagemUrl, `${nome || "avatar"}.png`)}
            title="Baixar"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download className="size-4" />
          </a>
          {onExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              disabled={excluindo}
              title="Excluir"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              {excluindo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Topo da tela: identidade da area + as duas abas. Aparece tambem na criacao. */
function Cabecalho({
  aba,
  onAba,
}: {
  aba?: Aba;
  onAba?: (a: Aba) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary shadow-[0_0_24px_-6px_var(--color-primary)]">
          <Palette className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">Personalize com IA</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Crie influenciadores e cenários personalizados pros seus vídeos
          </p>
        </div>
      </div>

      <div className="inline-flex gap-1 rounded-xl border border-border bg-card/60 p-1">
        {[
          { chave: "influencers" as const, label: "Influenciadores", Icone: UserRound },
          { chave: "cenarios" as const, label: "Cenários", Icone: ImageIcon },
        ].map(({ chave, label, Icone }) => (
          <button
            key={chave}
            type="button"
            onClick={() => onAba?.(chave)}
            disabled={!onAba}
            aria-pressed={aba === chave}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              aba === chave
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground enabled:hover:text-foreground",
            )}
          >
            <Icone className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MeusAvatares({
  avataresIniciais = [],
  admin = false,
}: {
  avataresIniciais?: AvatarCriado[];
  admin?: boolean;
}) {
  const [modo, setModo] = useState<Modo>(null);
  const [aba, setAba] = useState<Aba>("influencers");
  const [avatares, setAvatares] = useState<AvatarCriado[]>(avataresIniciais);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const aoCriar = (a: AvatarCriado) => {
    setAvatares((prev) => [a, ...prev]);
    setModo(null);
  };

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"? Os vídeos já feitos com ele continuam funcionando.`)) return;
    setExcluindo(id);
    try {
      const r = await fetch(`/api/avatar/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui excluir.");
      setAvatares((prev) => prev.filter((a) => a.id !== id));
      toast.success("Influenciador excluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui excluir.");
    } finally {
      setExcluindo(null);
    }
  }

  // ===== telas de criação =====
  if (modo === "zero") {
    return (
      <div className="w-full">
        <Cabecalho aba="influencers" />
        <div className="mt-5">
          <AvatarCriar admin={admin} onSair={() => setModo(null)} onCriado={aoCriar} />
        </div>
      </div>
    );
  }
  if (modo === "foto") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <AvatarDaFoto onSair={() => setModo(null)} onCriado={aoCriar} />
      </div>
    );
  }
  if (modo === "produto") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <AvatarComProduto avatares={avatares} onSair={() => setModo(null)} onCriado={aoCriar} />
      </div>
    );
  }
  if (modo === "subir") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <AvatarSubir onSair={() => setModo(null)} onCriado={aoCriar} />
      </div>
    );
  }

  // ===== galeria =====
  return (
    <div className="relative w-full space-y-5">
      <Cabecalho aba={aba} onAba={setAba} />

      {aba === "influencers" ? (
        <>
          {/* ===== AÇÕES ===== */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModo("zero")}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_24px_-6px_var(--color-primary)]"
            >
              <Plus className="size-4" />
              Criar com IA
            </button>
            <button
              type="button"
              onClick={() => setModo("subir")}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50"
            >
              <Upload className="size-4" />
              Enviar imagem
            </button>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setModo("foto")}
              className="underline-offset-2 transition-colors hover:text-primary hover:underline"
            >
              Criar a partir de uma foto sua
            </button>
            <button
              type="button"
              onClick={() => setModo("produto")}
              className="underline-offset-2 transition-colors hover:text-primary hover:underline"
            >
              Criar junto com um produto
            </button>
          </div>

          {/* ===== GALERIA ===== */}
          {avatares.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {avatares.map((a) => (
                <CardAvatar
                  key={a.id}
                  nome={a.nome}
                  ficha={a.ficha}
                  imagemUrl={a.imagemUrl}
                  excluindo={excluindo === a.id}
                  onExcluir={() => excluir(a.id, a.nome)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
                <UserRound className="size-6" />
              </span>
              <p className="font-medium">Nenhum influenciador seu por aqui ainda</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Crie um com IA ou envie a imagem de alguém que você já tem. Ele passa a
                aparecer na hora de gerar seus vídeos.
              </p>
            </div>
          )}

          {/* ===== PRONTOS DA PLATAFORMA ===== */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Influenciadores da plataforma</h2>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                Grátis
              </span>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              Já vêm com a plataforma e todo mundo pode usar nos vídeos, sem gastar nada.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {AVATARES_PRONTOS.map((a) => (
                <CardAvatar key={a.id} nome={a.nome} imagemUrl={a.src} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
            <ImageIcon className="size-6" />
          </span>
          <p className="font-medium">Cenários personalizados</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Aqui você vai poder criar e guardar os seus próprios cenários pra usar nos
            vídeos. Estamos montando essa parte agora.
          </p>
        </div>
      )}
    </div>
  );
}
