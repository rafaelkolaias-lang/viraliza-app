"use client";

import { MonitorDown, Apple } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Botões de download do app de computador. Viram links reais quando os instaladores
 * (Windows/macOS) estiverem prontos.
 */
export function BaixarBotoes() {
  function emBreve(plataforma: string) {
    toast.info(`Instalador pra ${plataforma} em breve!`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button
        size="lg"
        className="h-12 flex-1"
        onClick={() => emBreve("Windows")}
      >
        <MonitorDown className="size-5" />
        Baixar para Windows
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-12 flex-1"
        onClick={() => emBreve("macOS")}
      >
        <Apple className="size-5" />
        Baixar para Mac
      </Button>
    </div>
  );
}
