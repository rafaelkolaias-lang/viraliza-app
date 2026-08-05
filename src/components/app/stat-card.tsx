import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  /** aceita texto ou trecho montado (ex: valor em reais + créditos em menor) */
  value: ReactNode;
  icon: LucideIcon;
  /** legenda secundária pequena (ex: "cliente pagou R$25,89") */
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/12">
          <Icon className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
