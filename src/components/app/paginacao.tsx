"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Controles de paginação simples (anterior / página atual / próxima). */
export function Paginacao({
  pagina,
  totalPaginas,
  onMudar,
}: {
  pagina: number;
  totalPaginas: number;
  onMudar: (p: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pagina <= 1}
        onClick={() => onMudar(pagina - 1)}
      >
        <ChevronLeft className="size-4" />
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">
        Página <span className="font-medium text-foreground">{pagina}</span> de{" "}
        {totalPaginas}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagina >= totalPaginas}
        onClick={() => onMudar(pagina + 1)}
      >
        Próxima
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
