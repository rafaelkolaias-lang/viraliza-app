"use client";

import { useState } from "react";
import {
  Sparkles,
  Plus,
  UserRoundPlus,
  Camera,
  Wand2,
  Film,
  ImagePlus,
  ShoppingBag,
  Upload,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { AvatarQuiz, type AvatarCriado } from "@/components/app/avatar-quiz";
import { AVATARES_PRONTOS } from "@/lib/avatares-prontos";
import { AvatarDaFoto } from "@/components/app/avatar-da-foto";
import { AvatarComProduto } from "@/components/app/avatar-com-produto";
import { AvatarSubir } from "@/components/app/avatar-subir";

/**
 * FRONT da aba "Meus avatares". A pessoa cria e gerencia os avatares dela (que
 * depois aparecem na aba "Meus avatares" do criador de vídeo). Três formas de criar:
 *  - do zero (quiz)          -> AvatarQuiz
 *  - da minha foto           -> AvatarDaFoto
 *  - com produto             -> AvatarComProduto
 * Todas geram a imagem (gpt-image-1) e hospedam no serverrk. A galeria cresce quando
 * cria um novo.
 */

type Modo = null | "menu" | "zero" | "foto" | "produto" | "subir";

const PASSOS = [
  { Icon: Camera, txt: "Escolha como criar o avatar" },
  { Icon: Wand2, txt: "A IA gera a foto do seu avatar" },
  { Icon: Film, txt: "Use nos seus vídeos" },
];

const OPCOES: { modo: Exclude<Modo, null | "menu">; Icon: typeof Camera; titulo: string; desc: string; gratis?: boolean }[] = [
  {
    modo: "subir",
    Icon: Upload,
    titulo: "Subir avatar pronto",
    desc: "Já tem a imagem do seu avatar? Suba e use direto, sem gastar crédito.",
    gratis: true,
  },
  {
    modo: "zero",
    Icon: Wand2,
    titulo: "Criar do zero",
    desc: "Responda um quiz rápido e a IA cria uma pessoa nova, do seu jeito.",
  },
  {
    modo: "foto",
    Icon: ImagePlus,
    titulo: "Avatar da minha foto",
    desc: "Suba uma foto sua e a IA transforma num avatar pra usar nos vídeos.",
  },
  {
    modo: "produto",
    Icon: ShoppingBag,
    titulo: "Avatar com produto",
    desc: "Junte uma pessoa com a foto do produto: ela aparece usando o produto.",
  },
];

export function MeusAvatares({
  avataresIniciais = [],
  admin = false,
}: {
  avataresIniciais?: AvatarCriado[];
  admin?: boolean;
}) {
  const [modo, setModo] = useState<Modo>(null);
  const [avatares, setAvatares] = useState<AvatarCriado[]>(avataresIniciais);

  const aoCriar = (a: AvatarCriado) => setAvatares((prev) => [a, ...prev]);

  // ===== telas de criação =====
  if (modo === "zero") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <AvatarQuiz admin={admin} onSair={() => setModo(null)} onCriado={aoCriar} />
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

  // ===== menu de escolha do modo =====
  if (modo === "menu") {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <button
          type="button"
          onClick={() => setModo(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Como quer criar?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha uma das formas abaixo. Já tem a imagem pronta? Suba de graça.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OPCOES.map(({ modo: m, Icon, titulo, desc, gratis }) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/60"
            >
              {gratis && (
                <span className="absolute right-3 top-3 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Grátis
                </span>
              )}
              <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="mt-3 flex items-center gap-1 font-bold">
                {titulo}
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ===== galeria (tela inicial) =====
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      {/* ===== HERÓI ===== */}
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-primary/12 via-card to-background p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Meus avatares
          </span>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Crie o{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
              seu avatar
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Crie do zero, a partir de uma foto sua ou junto com um produto, pra usar
            nos seus vídeos.
          </p>
        </div>
      </div>

      {/* ===== COMO FUNCIONA ===== */}
      <div className="grid gap-3 sm:grid-cols-3">
        {PASSOS.map(({ Icon, txt }, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Icon className="size-4.5" />
            </span>
            <p className="text-sm font-medium">{txt}</p>
          </div>
        ))}
      </div>

      {/* ===== GALERIA ===== */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Seus avatares</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {/* card de criar */}
          <button
            type="button"
            onClick={() => setModo("menu")}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
          >
            <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
              <Plus className="size-6" />
            </span>
            <span className="text-xs font-semibold">Criar avatar</span>
          </button>

          {/* avatares criados */}
          {avatares.map((a) => (
            <div
              key={a.id}
              className="group relative overflow-hidden rounded-2xl border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.imagemUrl}
                alt={a.nome}
                className="aspect-[3/4] w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6 text-sm font-semibold text-white">
                {a.nome}
              </span>
            </div>
          ))}
        </div>

        {/* estado vazio (só quando não tem nenhum) */}
        {avatares.length === 0 && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <UserRoundPlus className="size-6" />
            </span>
            <p className="font-medium">Você ainda não criou nenhum avatar</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Clique em Criar avatar e escolha uma das formas. Seus avatares vão
              aparecer aqui pra usar nos vídeos.
            </p>
          </div>
        )}
      </div>

      {/* ===== AVATARES PRONTOS DA PLATAFORMA (grátis pra todo mundo) ===== */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Avatares prontos da plataforma</h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Grátis
          </span>
        </div>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
          Esses já vêm com a plataforma e todo mundo pode usar nos vídeos, sem gastar
          nada. É só escolher um deles na hora de gerar.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {AVATARES_PRONTOS.map((a) => (
            <div
              key={a.id}
              className="group relative overflow-hidden rounded-2xl border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.src}
                alt={a.nome}
                className="aspect-[3/4] w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-6 text-sm font-semibold text-white">
                {a.nome}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
