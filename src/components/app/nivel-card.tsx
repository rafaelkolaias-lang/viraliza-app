import Link from "next/link";
import { Medal, AlertTriangle } from "lucide-react";
import { fmtCreditos } from "@/lib/creditos";
import type { ResumoNivel } from "@/lib/niveis";

/**
 * Card do NÍVEL da conta (aba Créditos): a medalha bronze/prata/ouro, quantos
 * vídeos a pessoa já fez e quanto falta pra próxima.
 *
 * Desde 06/ago/2026 nível NÃO limita nada (nem vídeos por dia, nem quantos ao
 * mesmo tempo): é só reconhecimento de uso. Por isso o card não fala mais de
 * teto nenhum, senão sugeriria um limite que não existe.
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
  // progresso até a próxima medalha (Ouro fica cheio)
  const pct = resumo.proximoNivel
    ? Math.min(100, Math.round((resumo.videos / Math.max(1, resumo.proximoNivel.videosMin)) * 100))
    : 100;

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

      <div className="mt-4 rounded-xl border border-border bg-background/50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Vídeos gerados</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {resumo.videos.toLocaleString("pt-BR")}
            </p>
          </div>
          {resumo.proximoNivel && (
            <p className="text-right text-xs text-muted-foreground">
              faltam{" "}
              <b className="text-foreground">
                {resumo.proximoNivel.faltam.toLocaleString("pt-BR")}
              </b>{" "}
              pro {resumo.proximoNivel.emoji} {resumo.proximoNivel.rotulo}
            </p>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${cor.barra}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {resumo.proximoNivel
          ? `A medalha sobe sozinha conforme você produz: ${resumo.proximoNivel.videosMin.toLocaleString("pt-BR")} vídeos te levam pro ${resumo.proximoNivel.rotulo}.`
          : "Você chegou no topo: Ouro é pra quem passou de 200 vídeos."}{" "}
        Ela não limita nada, é só o reconhecimento do seu uso.{" "}
        <Link href="/painel/extrato" className="underline underline-offset-2">
          Ver extrato
        </Link>
      </p>
    </section>
  );
}
