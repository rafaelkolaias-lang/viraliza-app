"use client";

import Image from "next/image";
import { Eye, Package, UserRound, Camera, MapPin, Pencil, Quote } from "lucide-react";
import type { EstiloCamera } from "@/lib/estilos-camera";
import type { ProdutoLab } from "@/components/app/lab-produtos";
import type { AvatarLab } from "@/components/app/lab-avatares";
import { CENARIOS_LAB } from "@/components/app/lab-cenario";

/**
 * Resumo antes de gerar: mostra em uma linha cada escolha (produto, influenciador,
 * câmera, cenário e a descrição da cena) com atalho pra editar. É a última chance
 * de conferir antes de gastar crédito.
 */

type Linha = {
  chave: string;
  rotulo: string;
  valor: string;
  Icone: typeof Package;
  foto?: string;
};

export function LabResumo({
  estilo,
  produto,
  avatar,
  cenario,
  cenarioTexto,
  cena,
  onEditar,
}: {
  estilo: EstiloCamera;
  produto: ProdutoLab;
  avatar: AvatarLab;
  cenario: string;
  cenarioTexto: string;
  cena: string;
  onEditar: (destino: "estilo" | "produto" | "avatar" | "cenario") => void;
}) {
  const cen = CENARIOS_LAB.find((c) => c.chave === cenario);
  const nomeCenario = cenario.startsWith("meu:")
    ? "Meu cenário (foto sua)"
    : cenario === "outros"
      ? cenarioTexto || "Cenário personalizado"
      : (cen?.label ?? "");

  const linhas: { destino: "estilo" | "produto" | "avatar" | "cenario"; dado: Linha }[] = [
    {
      destino: "produto",
      dado: {
        chave: "produto",
        rotulo: "Produto",
        valor: produto.titulo,
        Icone: Package,
        foto: produto.imagem,
      },
    },
    {
      destino: "avatar",
      dado: {
        chave: "avatar",
        rotulo: "Influenciador",
        valor: avatar.imagemUrl ? avatar.nome : "Nenhum (sem pessoa na cena)",
        Icone: UserRound,
        foto: avatar.imagemUrl || undefined,
      },
    },
    {
      destino: "estilo",
      dado: {
        chave: "camera",
        rotulo: "Câmera",
        valor: estilo.label,
        Icone: Camera,
        foto: estilo.poster,
      },
    },
    {
      destino: "cenario",
      dado: {
        chave: "cenario",
        rotulo: "Cenário",
        valor: nomeCenario,
        Icone: MapPin,
      },
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-primary" />
        <h2 className="font-semibold">Resumo da imagem</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Confira suas escolhas antes de gerar a imagem.
      </p>

      <div className="space-y-2 pt-1">
        {linhas.map(({ destino, dado }) => (
          <div
            key={dado.chave}
            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-2.5 transition-colors hover:border-primary/30"
          >
            <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/30 text-primary">
              {dado.foto ? (
                <Image
                  src={dado.foto}
                  alt={dado.valor}
                  fill
                  unoptimized
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                <dado.Icone className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {dado.rotulo}
              </p>
              <p className="truncate text-sm font-medium">{dado.valor}</p>
            </div>
            <button
              type="button"
              onClick={() => onEditar(destino)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Pencil className="size-3" />
              Editar
            </button>
          </div>
        ))}

        {/* a descrição da cena ocupa uma linha inteira: é o que mais muda o resultado */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Quote className="size-3" />
              Como deve aparecer
            </p>
            <button
              type="button"
              onClick={() => onEditar("produto")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Pencil className="size-3" />
              Editar
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{cena}</p>
        </div>
      </div>
    </div>
  );
}
