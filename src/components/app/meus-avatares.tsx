"use client";

import { useState } from "react";
import { Sparkles, Plus, UserRoundPlus, Camera, Wand2, Film } from "lucide-react";
import { AvatarQuiz, type AvatarCriado } from "@/components/app/avatar-quiz";

/**
 * FRONT da aba "Meus avatares". A pessoa cria e gerencia os avatares dela (que
 * depois aparecem na aba "Meus avatares" do criador de vídeo). "Criar avatar" abre
 * o quiz; a foto e gerada no gpt-image-1 e hospedada no serverrk. A galeria comeca
 * com os avatares que ja vieram do servidor e cresce quando cria um novo.
 */

const PASSOS = [
  { Icon: Camera, txt: "Responda o quiz do avatar" },
  { Icon: Wand2, txt: "A IA gera a foto do seu avatar" },
  { Icon: Film, txt: "Use nos seus vídeos" },
];

export function MeusAvatares({
  avataresIniciais = [],
  admin = false,
}: {
  avataresIniciais?: AvatarCriado[];
  admin?: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const [avatares, setAvatares] = useState<AvatarCriado[]>(avataresIniciais);

  if (criando) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <AvatarQuiz
          admin={admin}
          onSair={() => setCriando(false)}
          onCriado={(a) => setAvatares((prev) => [a, ...prev])}
        />
      </div>
    );
  }

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
            Monte um avatar do seu jeito, respondendo um quiz rápido, pra usar nos
            seus vídeos de produto.
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
            onClick={() => setCriando(true)}
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
              Clique em Criar avatar e responda o quiz. Seus avatares vão aparecer aqui
              pra usar nos vídeos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
