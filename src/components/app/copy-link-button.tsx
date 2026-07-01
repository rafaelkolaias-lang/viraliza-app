"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Botão que copia um link pra área de transferência (com feedback). */
export function CopyLinkButton({
  link,
  className,
  label = "Copiar link",
}: {
  link: string;
  className?: string;
  label?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      toast.success("Copiado!");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não consegui copiar. Copie manualmente.");
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={copiar}
      className={cn("w-full", className)}
    >
      {copiado ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      {copiado ? "Copiado!" : label}
    </Button>
  );
}
