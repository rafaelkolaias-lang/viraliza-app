import { Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VideoStatus } from "@/lib/types";

const MAP: Record<
  VideoStatus,
  { label: string; classes: string; Icon: typeof Clock; spin?: boolean }
> = {
  na_fila: {
    label: "Na fila",
    classes: "bg-muted text-muted-foreground",
    Icon: Clock,
  },
  renderizando: {
    label: "Renderizando",
    classes: "bg-amber-500/15 text-amber-400",
    Icon: Loader2,
    spin: true,
  },
  processando: {
    label: "Finalizando",
    classes: "bg-amber-500/15 text-amber-400",
    Icon: Loader2,
    spin: true,
  },
  pronto: {
    label: "Pronto",
    classes: "bg-primary/15 text-primary",
    Icon: CheckCircle2,
  },
  erro: {
    label: "Erro",
    classes: "bg-destructive/15 text-destructive",
    Icon: AlertCircle,
  },
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  const { label, classes, Icon, spin } = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        classes,
      )}
    >
      <Icon className={cn("size-3.5", spin && "animate-spin")} />
      {label}
    </span>
  );
}
