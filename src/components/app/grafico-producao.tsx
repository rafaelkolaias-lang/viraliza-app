import { BarChart3 } from "lucide-react";
import type { DiaProducao } from "@/lib/admin";

/** Gráfico de barras (CSS puro, sem lib): vídeos por dia. Verde = prontos/ok,
 *  vermelho = erros. Passa o mouse pra ver o número. */
export function GraficoProducao({ dias }: { dias: DiaProducao[] }) {
  const max = Math.max(1, ...dias.map((d) => d.total));
  const totalPeriodo = dias.reduce((s, d) => s + d.total, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-primary" />
          Vídeos por dia
        </h2>
        <span className="text-xs text-muted-foreground">
          {totalPeriodo.toLocaleString("pt-BR")} nos últimos {dias.length} dias
        </span>
      </div>

      <div className="mt-5 flex h-40 items-end gap-1 sm:gap-1.5">
        {dias.map((d) => {
          const ok = d.total - d.erros;
          return (
            <div
              key={d.chave}
              className="group/bar flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${d.label}: ${d.total} vídeo(s)${d.erros ? ` · ${d.erros} erro(s)` : ""}`}
            >
              <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover/bar:opacity-100">
                {d.total || ""}
              </span>
              {/* trilho da barra (empilha erro embaixo + ok em cima) */}
              <div className="flex w-full flex-col justify-end" style={{ height: "100%" }}>
                {d.erros > 0 && (
                  <div
                    className="w-full bg-red-500/70"
                    style={{ height: `${(d.erros / max) * 100}%` }}
                  />
                )}
                <div
                  className="w-full rounded-t bg-primary/80 transition-colors group-hover/bar:bg-primary"
                  style={{ height: `${(ok / max) * 100}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground sm:text-[10px]">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary/80" /> prontos/ok
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-red-500/70" /> erros
        </span>
      </div>
    </div>
  );
}
