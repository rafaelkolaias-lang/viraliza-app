"use client";

import { ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Lê o texto copiado e joga no campo. Facilita colar nome/descrição do produto.
 */
export function PasteButton({ onPaste }: { onPaste: (text: string) => void }) {
  async function handle() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error("Nada copiado pra colar.");
        return;
      }
      onPaste(text.trim());
      toast.success("Colado!");
    } catch {
      toast.error("Não consegui acessar a área de transferência.");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handle}>
      <ClipboardPaste className="size-4" />
      Colar
    </Button>
  );
}
