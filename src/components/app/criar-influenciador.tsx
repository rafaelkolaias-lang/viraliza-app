"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Coins, Package, Palette, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AvatarCriado } from "@/lib/avatar-modelo";
import { CUSTO_AVATAR } from "@/lib/avatar-modelo";
import { AvatarCriar } from "@/components/app/avatar-criar";
import { AvatarDaFoto } from "@/components/app/avatar-da-foto";
import { AvatarComProduto } from "@/components/app/avatar-com-produto";

/**
 * Tela "Novo influenciador" (`/painel/meus-avatares/criar`).
 *
 * Antes os três caminhos de IA viviam escondidos dentro da galeria: dois eram
 * link de texto miúdo embaixo dos botões, e quase ninguém achava. Aqui cada um
 * ganha um cartão do mesmo tamanho, com o que faz e quanto custa na cara.
 *
 * Terminou de criar, volta pra galeria: é lá que o influenciador novo aparece.
 */

type Caminho = "zero" | "foto" | "produto";

const CAMINHOS: {
  chave: Caminho;
  titulo: string;
  descricao: string;
  Icone: typeof Sparkles;
  destaque?: boolean;
}[] = [
  {
    // NÃO chamar de "Novo influenciador": esse é o nome do item de menu que traz
    // a pessoa pra cá, e o nome repetido dava a sensação de que a tela não abriu.
    // Igual aos outros dois cartões, o título diz de onde ela está PARTINDO.
    chave: "zero",
    titulo: "Do zero, sem foto",
    descricao:
      "Responda 7 perguntas rápidas (rosto, corpo, cabelo, roupa) e a IA desenha uma pessoa que não existe em lugar nenhum, só sua.",
    Icone: Sparkles,
    destaque: true,
  },
  {
    chave: "foto",
    titulo: "A partir de uma foto real",
    descricao:
      "Envie a foto de alguém de verdade, você inclusive, e a IA cria um influenciador parecido pra usar nos vídeos.",
    Icone: Camera,
  },
  {
    chave: "produto",
    titulo: "Junto com um produto",
    descricao:
      "O influenciador já nasce segurando o seu produto na mão, que é a imagem que mais vende.",
    Icone: Package,
  },
];

export function CriarInfluenciador({
  avatares = [],
  admin = false,
}: {
  avatares?: AvatarCriado[];
  admin?: boolean;
}) {
  const router = useRouter();
  const [caminho, setCaminho] = useState<Caminho | null>(null);

  function aoCriar() {
    toast.success("Influenciador criado! Ele já está na sua galeria.");
    router.push("/painel/meus-avatares");
  }

  if (caminho) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => setCaminho(null)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Escolher outro jeito de criar
        </button>
        {caminho === "zero" && (
          <AvatarCriar admin={admin} onSair={() => setCaminho(null)} onCriado={aoCriar} />
        )}
        {caminho === "foto" && <AvatarDaFoto onSair={() => setCaminho(null)} onCriado={aoCriar} />}
        {caminho === "produto" && (
          <AvatarComProduto
            avatares={avatares}
            onSair={() => setCaminho(null)}
            onCriado={aoCriar}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary shadow-[0_0_24px_-6px_var(--color-primary)]">
          <Palette className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">Novo influenciador</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Escolha por onde você quer começar. Todos custam {CUSTO_AVATAR} créditos.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {CAMINHOS.map(({ chave, titulo, descricao, Icone, destaque }) => (
          <button
            key={chave}
            type="button"
            onClick={() => setCaminho(chave)}
            className={`flex flex-col gap-3 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_30px_-12px_var(--color-primary)] ${
              destaque ? "border-primary/40 bg-primary/5" : "border-border bg-card/60"
            }`}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Icone className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-bold">{titulo}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{descricao}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <Coins className="size-3.5" />
              {CUSTO_AVATAR} créditos
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <p className="text-sm font-semibold">Já tem a foto pronta?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Enviar uma imagem que você já tem não usa IA e não gasta crédito nenhum. O botão
          de enviar imagem fica na galeria.
        </p>
        <Link
          href="/painel/meus-avatares"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50"
        >
          Ir pra galeria
        </Link>
      </div>
    </div>
  );
}
