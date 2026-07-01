"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Botão de baixar. Vira link de download real quando os arquivos estiverem no servidor.
 */
export function DownloadButton({
  className,
  full = false,
}: {
  className?: string;
  full?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(full && "w-full", className)}
      onClick={() => toast.info("Em breve disponível pra baixar.")}
    >
      <Download className="size-4" />
      Baixar
    </Button>
  );
}
