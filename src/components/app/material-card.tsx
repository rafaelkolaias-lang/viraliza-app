"use client";

import {
  Download,
  Package,
  Video,
  Music,
  ImageIcon,
  FileDown,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { midiaUrl } from "@/lib/utils";
import type { Material, MaterialTipo } from "@/lib/types";

const ICONE: Record<MaterialTipo, typeof Package> = {
  pacote: Package,
  video: Video,
  musica: Music,
  imagem: ImageIcon,
  outro: FileDown,
};

const ROTULO: Record<MaterialTipo, string> = {
  pacote: "Pacote",
  video: "Vídeos",
  musica: "Músicas",
  imagem: "Imagens",
  outro: "Arquivo",
};

export function MaterialCard({
  material,
  isAdmin = false,
  onExcluir,
  excluindo = false,
}: {
  material: Material;
  isAdmin?: boolean;
  onExcluir?: () => void;
  excluindo?: boolean;
}) {
  const tipo = material.tipo ?? "pacote";
  const Icon = ICONE[tipo];
  const externo = /^https?:\/\//i.test(material.url);

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12">
          <Icon className="size-5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{material.titulo}</p>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {ROTULO[tipo]}
            </span>
          </div>
          {material.descricao && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {material.descricao}
            </p>
          )}
          {material.tamanho && (
            <p className="mt-1 text-xs text-muted-foreground">{material.tamanho}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1"
          render={
            externo ? (
              <a href={material.url} target="_blank" rel="noopener noreferrer" />
            ) : (
              <a href={midiaUrl(material.url)} download />
            )
          }
        >
          <Download className="size-4" />
          Baixar
        </Button>

        {isAdmin && onExcluir && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir material"
            disabled={excluindo}
            onClick={onExcluir}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
