import type { Metadata } from "next";
import { Activity, AlertCircle, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { classificarErro, elevenSaldo } from "@/lib/diagnostico";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin · Diagnóstico" };
export const dynamic = "force-dynamic";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const fmtNum = new Intl.NumberFormat("pt-BR");

// Só a data (dia/mês) da renovação da cota - fuso fixo pra bater com o BR.
const fmtReset = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function DiagnosticoPage() {
  const [jobsErro, saldo] = await Promise.all([
    prisma.job.findMany({
      where: { status: "erro" },
      orderBy: { criadoEm: "desc" },
      take: 50,
      select: {
        id: true,
        produto: true,
        formato: true,
        erro: true,
        criadoEm: true,
        user: { select: { nome: true, email: true } },
      },
    }),
    elevenSaldo(),
  ]);

  const classificados = jobsErro.map((j) => ({
    ...j,
    diag: classificarErro(j.erro),
  }));

  // resumo por serviço
  const porServico = new Map<string, number>();
  for (const c of classificados) {
    porServico.set(c.diag.servico, (porServico.get(c.diag.servico) ?? 0) + 1);
  }
  const semCredito = classificados.filter((c) => c.diag.semCredito).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Activity className="size-6 text-primary" />
          Diagnóstico
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saldo de tokens e o log de erros de render - em qual vídeo, qual serviço e se
          foi por falta de crédito.
        </p>
      </div>

      {/* ---- Saldo ElevenLabs ---- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          <KeyRound className="size-4" /> Tokens de voz (ElevenLabs)
        </h2>

        {!saldo.configurado ? (
          <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            Pra ver o saldo aqui, adicione a variável{" "}
            <span className="font-medium text-foreground">ELEVENLABS_API_KEYS</span> (as
            chaves separadas por vírgula) nas variáveis de ambiente do servidor
            (EasyPanel). O resto do diagnóstico funciona sem isso.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {saldo.chaves.map((c) => {
              const pct =
                c.ok && c.limite ? Math.min(100, Math.round((c.usado! / c.limite) * 100)) : 0;
              const acabando = c.ok && (c.restante ?? 0) < 1000;
              return (
                <div
                  key={c.rotulo}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.rotulo}</p>
                    {c.ok ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          acabando
                            ? "bg-destructive/15 text-destructive"
                            : "bg-primary/15 text-primary",
                        )}
                      >
                        {acabando ? "acabando" : "ok"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {c.msg}
                      </span>
                    )}
                  </div>
                  {c.ok && (
                    <>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">
                        {fmtNum.format(c.restante ?? 0)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {" "}
                          restantes
                        </span>
                      </p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            acabando ? "bg-destructive" : "bg-primary",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {fmtNum.format(c.usado ?? 0)} / {fmtNum.format(c.limite ?? 0)}
                        {c.tier ? ` · ${c.tier}` : ""}
                      </p>
                      {c.resetEm && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          renova em {fmtReset.format(new Date(c.resetEm))}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---- Resumo de erros ---- */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          <AlertCircle className="size-4" /> Erros recentes
        </h2>

        {classificados.length === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
            <ShieldCheck className="size-8 text-primary" />
            <p className="mt-3 font-medium">Nenhum erro 🎉</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Todos os vídeos renderizaram sem problema.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Pilula texto={`${classificados.length} erro(s)`} forte />
              {semCredito > 0 && (
                <Pilula texto={`${semCredito} por falta de crédito`} alerta />
              )}
              {[...porServico.entries()].map(([s, n]) => (
                <Pilula key={s} texto={`${s}: ${n}`} />
              ))}
            </div>

            <div className="space-y-2">
              {classificados.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.produto}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.user?.nome ?? "-"} ·{" "}
                        {c.formato === "voz" ? "Voz narrada" : "Legenda"} ·{" "}
                        {fmtData.format(new Date(c.criadoEm))}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          c.diag.servico === "ElevenLabs (voz)"
                            ? "bg-amber-500/15 text-amber-500"
                            : c.diag.servico === "Gemini (copy/imagem)"
                              ? "bg-blue-500/15 text-blue-400"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {c.diag.servico}
                      </span>
                      {c.diag.semCredito && (
                        <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                          sem crédito
                        </span>
                      )}
                    </div>
                  </div>
                  {c.erro && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        ver detalhe do erro
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
                        {c.erro}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3" />
        Atualize a página pra ver o saldo e os erros mais recentes.
      </p>
    </div>
  );
}

function Pilula({
  texto,
  forte,
  alerta,
}: {
  texto: string;
  forte?: boolean;
  alerta?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        alerta
          ? "bg-destructive/15 text-destructive"
          : forte
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
      )}
    >
      {texto}
    </span>
  );
}
