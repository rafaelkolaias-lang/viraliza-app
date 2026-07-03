"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { midiaUrl, linkBaixar } from "@/lib/utils";

/** Baixa vários arquivos de uma vez (dispara um download por arquivo, espaçados). */
export function BaixarTodos({
  arquivos,
  label = "Baixar todos",
  className,
}: {
  arquivos: string[];
  label?: string;
  className?: string;
}) {
  const [baixando, setBaixando] = useState(false);

  async function baixar() {
    if (baixando || arquivos.length === 0) return;
    setBaixando(true);
    try {
      for (let i = 0; i < arquivos.length; i++) {
        // força download same-origin (funciona no celular), com nome sequencial
        const url = linkBaixar(midiaUrl(arquivos[i]), `corte-${i + 1}`);
        if (!url) continue;
        const a = document.createElement("a");
        a.href = url;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
        // pequeno espaçamento pra o navegador não bloquear os downloads
        await new Promise((r) => setTimeout(r, 600));
      }
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Button
      size="sm"
      onClick={baixar}
      disabled={baixando || arquivos.length === 0}
      className={className}
    >
      {baixando ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {label} ({arquivos.length})
    </Button>
  );
}
