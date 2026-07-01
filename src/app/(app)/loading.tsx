import { Loader2 } from "lucide-react";

/**
 * Indicador de carregamento global (mostrado ao navegar entre as telas logadas).
 * Fica no centro, embaixo, pulsando, pra chamar atenção. Visível ao usuário final
 * (diferente do "Compiling..." do Next, que só aparece em desenvolvimento).
 */
export default function Loading() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div className="inline-flex animate-pulse items-center gap-2.5 rounded-full border border-primary/40 bg-card/90 px-5 py-2.5 shadow-xl shadow-primary/15 backdrop-blur-sm">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-sm font-semibold text-foreground">Carregando...</span>
      </div>
    </div>
  );
}
