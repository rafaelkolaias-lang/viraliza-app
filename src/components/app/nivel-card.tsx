import Link from "next/link";
import { Medal, Clock, AlertTriangle } from "lucide-react";
import { fmtCreditos } from "@/lib/creditos";
import type { ResumoNivel } from "@/lib/niveis";

/**
 * Card do NÍVEL da conta (aba Créditos): badge bronze/prata/ouro, uso do teto
 * diário, crédito comprado ainda em quarentena e aviso de saldo devedor.
 * A "análise interna" não aparece aqui de propósito.
 *
 * Cada nível tem a própria cor (bronze = cobre, prata = cinza-claro, ouro =
 * dourado). Classes completas por nível: o Tailwind só gera o CSS de classe
 * escrita por extenso (nada de montar string dinâmica).
 */
const CORES: Record<
  ResumoNivel["nivel"],
  { badge: string; icone: string; barra: string; card: string }
> = {
  bronze: {
    badge: "border-orange-600/50 bg-orange-600/15 text-orange-400",
    icone: "text-orange-400",
    barra: "bg-orange-500",
    card: "border-orange-600/40",
  },
  prata: {
    badge: "border-slate-300/50 bg-slate-300/15 text-slate-200",
    icone: "text-slate-300",
    barra: "bg-slate-300",
    card: "border-slate-300/40",
  },
  ouro: {
    badge: "border-yellow-400/60 bg-yellow-400/15 text-yellow-400",
    icone: "text-yellow-400",
    barra: "bg-yellow-400",
    card: "border-yellow-400/40",
  },
};

export function NivelCard({ resumo }: { resumo: ResumoNivel }) {
  const cor = CORES[resumo.nivel] ?? CORES.bronze;
  const pctDia = Math.min(
    100,
    Math.round((resumo.videosHoje / Math.max(1, resumo.videosDia)) * 100),
  );
  const dataLiberacao = resumo.proximaLiberacao
    ? new Date(resumo.proximaLiberacao.em).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : null;

  return (
    <section className={`rounded-2xl border bg-card p-6 ${cor.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Medal className={`size-5 ${cor.icone}`} />
          Nível da conta
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-base font-bold ${cor.badge}`}
        >
          {resumo.emoji} {resumo.rotulo}
        </span>
      </div>

      {resumo.dividaCentavos > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div className="text-sm">
            <p className="font-semibold text-red-400">
              Sua conta tem um saldo pendente de {fmtCreditos(resumo.dividaCentavos)} créditos
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Ele veio de um reembolso feito depois dos créditos já terem sido usados.
              Adquira créditos pra regularizar e voltar a gerar vídeos.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {/* vídeos de hoje */}
        <div className="rounded-xl border border-border bg-background/50 p-4">
          <p className="text-sm font-semibold">Vídeos hoje</p>
          <p className="mt-1 text-lg font-bold">
            {resumo.videosHoje}
            <span className="text-sm font-medium text-muted-foreground">
              {" "}
              / {resumo.videosDia}
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${cor.barra}`}
              style={{ width: `${pctDia}%` }}
            />
          </div>
          {resumo.proximoNivel && (
            <p className="mt-2 text-xs text-muted-foreground">
              Contas {resumo.proximoNivel.rotulo} geram até {resumo.proximoNivel.videosDia}/dia.
            </p>
          )}
        </div>

        {/* simultâneos */}
        <div className="rounded-xl border border-border bg-background/50 p-4">
          <p className="text-sm font-semibold">Em produção ao mesmo tempo</p>
          <p className="mt-1 text-lg font-bold">
            {resumo.simultaneos}
            <span className="text-sm font-medium text-muted-foreground">
              {" "}
              vídeo{resumo.simultaneos > 1 ? "s" : ""}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Seu nível define quantos vídeos podem renderizar juntos.
          </p>
        </div>

        {/* crédito em liberação */}
        <div className="rounded-xl border border-border bg-background/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className={`size-4 ${cor.icone}`} />
            Crédito liberando
          </p>
          {resumo.presoCentavos > 0 ? (
            <>
              <p className="mt-1 text-lg font-bold">
                {fmtCreditos(resumo.presoCentavos)}
                <span className="text-sm font-medium text-muted-foreground">
                  {" "}
                  créditos
                </span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Garantia da compra: {dataLiberacao ? `libera em ${dataLiberacao}` : "libera em breve"}{" "}
                automaticamente.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Nenhum crédito em espera - compras novas podem liberar em duas partes
              (garantia da compra).
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Seu nível sobe sozinho com o uso: continue entrando e gerando que a conta
        evolui pra {resumo.proximoNivel ? resumo.proximoNivel.rotulo : "além"} - com
        mais vídeos por dia e crédito liberado na hora.{" "}
        <Link href="/painel/extrato" className="underline underline-offset-2">
          Ver extrato
        </Link>
      </p>
    </section>
  );
}
