import Link from "next/link";
import { Medal, Clock, AlertTriangle, Layers } from "lucide-react";
import { fmtCreditos } from "@/lib/creditos";
import type { ResumoNivel } from "@/lib/niveis";

/**
 * Card do NÍVEL da conta (aba Créditos). Depois da reforma dos níveis (08/2026)
 * o nível é só reconhecimento: não há mais teto diário nem crédito retido em
 * compra nova. O que o card mostra:
 * - o selo do nível (bronze/prata/ouro, sobe sozinho com o uso);
 * - o limite universal de vídeos simultâneos (igual pra toda conta);
 * - o "crédito liberando" APENAS enquanto existir liberação da regra antiga;
 * - o aviso de saldo devedor de reembolso.
 *
 * Cada nível tem a própria cor. Classes completas por nível: o Tailwind só gera
 * o CSS de classe escrita por extenso (nada de montar string dinâmica).
 */
const CORES: Record<
  ResumoNivel["nivel"],
  { badge: string; icone: string; card: string }
> = {
  bronze: {
    badge: "border-orange-600/50 bg-orange-600/15 text-orange-400",
    icone: "text-orange-400",
    card: "border-orange-600/40",
  },
  prata: {
    badge: "border-slate-300/50 bg-slate-300/15 text-slate-200",
    icone: "text-slate-300",
    card: "border-slate-300/40",
  },
  ouro: {
    badge: "border-yellow-400/60 bg-yellow-400/15 text-yellow-400",
    icone: "text-yellow-400",
    card: "border-yellow-400/40",
  },
};

export function NivelCard({ resumo }: { resumo: ResumoNivel }) {
  const cor = CORES[resumo.nivel] ?? CORES.bronze;
  const dataLiberacao = resumo.proximaLiberacao
    ? new Date(resumo.proximaLiberacao.em).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
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

      <div
        className={`mt-4 grid gap-4 ${resumo.presoCentavos > 0 ? "sm:grid-cols-2" : ""}`}
      >
        {/* limite universal de produção */}
        <div className="rounded-xl border border-border bg-background/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers className={`size-4 ${cor.icone}`} />
            Em produção ao mesmo tempo
          </p>
          <p className="mt-1 text-lg font-bold">
            {resumo.simultaneos}
            <span className="text-sm font-medium text-muted-foreground"> vídeos</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Limite igual pra todas as contas. Não existe mais limite diário de
            vídeos, e o crédito comprado cai 100% no saldo na hora.
          </p>
        </div>

        {/* crédito da regra antiga ainda em liberação (some quando zerar) */}
        {resumo.presoCentavos > 0 && (
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className={`size-4 ${cor.icone}`} />
              Crédito liberando
            </p>
            <p className="mt-1 text-lg font-bold">
              {fmtCreditos(resumo.presoCentavos)}
              <span className="text-sm font-medium text-muted-foreground"> créditos</span>
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Resto de uma compra feita na regra antiga de garantia:{" "}
              {dataLiberacao ? `cai sozinho em ${dataLiberacao}` : "cai sozinho em breve"}.
              Compras novas entram inteiras na hora.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        O nível sobe sozinho com o uso da plataforma e vai destravar vantagens e
        recompensas em breve - sem limitar nada por enquanto.{" "}
        <Link href="/painel/extrato" className="underline underline-offset-2">
          Ver extrato
        </Link>
      </p>
    </section>
  );
}
