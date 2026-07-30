"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Coins, Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type ReporteDTO = {
  id: string;
  jobId: string;
  produto: string;
  motivo: string;
  creditos: number;
  status: string; // "novo" | "reembolsado" | "recusado"
  criadoEm: string;
  usuario: string;
  email: string;
  // o vídeo reportado (do Job; some se o usuário excluiu o vídeo)
  videoUrl?: string;
  thumb?: string;
  // mídias de ENTRADA que a pessoa mandou (salvas nos jobs novos)
  avatarUrl?: string;
  produtoFotos?: string[];
  cenario?: string;
};

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Lista dos reportes (admin): reembolsar credita de volta, recusar encerra. */
export function AdminReportes({ reportes }: { reportes: ReporteDTO[] }) {
  const router = useRouter();
  const [agindo, setAgindo] = useState<string | null>(null);

  async function decidir(id: string, acao: "reembolsar" | "recusar") {
    setAgindo(id + acao);
    try {
      const res = await fetch("/api/reportes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acao }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.erro || "Não consegui decidir. Tente de novo.");
        return;
      }
      toast.success(acao === "reembolsar" ? "Reembolsado! 💚" : "Recusado.");
      router.refresh();
    } catch {
      toast.error("Sem conexão.");
    } finally {
      setAgindo(null);
    }
  }

  if (reportes.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border py-16 text-center">
        <Flag className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nenhum reporte ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando alguém reportar um vídeo com problema, aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reportes.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{r.produto}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.usuario} · {r.email} · {fmtData.format(new Date(r.criadoEm))}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                <Coins className="size-3" />
                {r.creditos} créditos
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  r.status === "novo" && "bg-amber-500/15 text-amber-500",
                  r.status === "reembolsado" && "bg-primary/15 text-primary",
                  r.status === "recusado" && "bg-muted text-muted-foreground",
                )}
              >
                {r.status === "novo" ? "Novo" : r.status === "reembolsado" ? "Reembolsado" : "Recusado"}
              </span>
            </div>
          </div>

          <p className="mt-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">{r.motivo}</p>

          {/* o vídeo reportado + as mídias que a pessoa mandou (compara os dois) */}
          <div className="mt-3 flex flex-wrap items-start gap-4">
            {r.videoUrl ? (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Vídeo reportado
                </p>
                <video
                  src={r.videoUrl}
                  poster={r.thumb}
                  controls
                  preload="none"
                  playsInline
                  className="aspect-[9/16] w-[150px] rounded-xl border border-border bg-black object-cover"
                />
                <a
                  href={r.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-[11px] font-medium text-primary hover:underline"
                >
                  Abrir em nova aba
                </a>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                (o vídeo foi excluído pelo usuário ou não tem mídia)
              </p>
            )}

            {(r.avatarUrl || (r.produtoFotos?.length ?? 0) > 0) && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  O que a pessoa enviou
                </p>
                <div className="flex flex-wrap gap-2">
                  {r.avatarUrl && (
                    <figure>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.avatarUrl}
                        alt="avatar usado"
                        className="aspect-[3/4] w-[84px] rounded-lg border border-border object-cover"
                      />
                      <figcaption className="mt-0.5 text-center text-[10px] text-muted-foreground">
                        avatar
                      </figcaption>
                    </figure>
                  )}
                  {(r.produtoFotos ?? []).map((f, i) => (
                    <figure key={i}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={f}
                        alt={`produto ${i + 1}`}
                        className="aspect-square w-[84px] rounded-lg border border-border object-cover"
                      />
                      <figcaption className="mt-0.5 text-center text-[10px] text-muted-foreground">
                        produto {i + 1}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                {r.cenario && (
                  <p className="mt-1 text-[11px] text-muted-foreground">cenário: {r.cenario}</p>
                )}
              </div>
            )}
          </div>

          {r.status === "novo" && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => decidir(r.id, "reembolsar")}
                disabled={!!agindo}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {agindo === r.id + "reembolsar" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Reembolsar {r.creditos} créditos
              </button>
              <button
                type="button"
                onClick={() => decidir(r.id, "recusar")}
                disabled={!!agindo}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
              >
                {agindo === r.id + "recusar" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <X className="size-3.5" />
                )}
                Recusar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
