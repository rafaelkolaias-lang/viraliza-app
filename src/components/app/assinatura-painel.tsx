import {
  Crown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarClock,
  CalendarCheck,
  UserCheck,
  Coins,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotaoAssinarMP } from "@/components/app/botao-assinar-mp";
import { BotaoCancelarAssinatura } from "@/components/app/botao-cancelar-assinatura";
import { BotaoRenovarIndisponivel } from "@/components/app/botao-renovar-indisponivel";
import { MeusReembolsos } from "@/components/app/meus-reembolsos";
import { cn } from "@/lib/utils";

type Props = {
  ativa: boolean;
  permanente: boolean;
  diasRestantes: number | null;
  venceEm: string | null;
  membroDesde: string | null;
  renovadaEm: string | null;
  urlAssinatura: string | null;
  /** public key do MP: presente = assinar/renovar no NOSSO modal (cartão) */
  mpPublicKey?: string;
  /** valor da mensalidade em reais (mostrado no modal) */
  valorMensal?: number;
  /** true = existe assinatura ativa no MP, então dá pra cancelar a renovação */
  podeCancelar?: boolean;
  /**
   * true = a pessoa já tinha acesso ANTES do Mercado Pago (veio da Cakto ou é
   * concessão permanente). Pra essas o botão de assinar some: se clicassem,
   * passariam a pagar R$98,90/mês por cima do que já têm. "Quem já está, está."
   */
  acessoAntigo?: boolean;
};

// vantagens que a assinatura libera (a biblioteca + o brinde mensal)
const INCLUI = [
  "Acervo de cortes prontos",
  "Vídeos virais atualizados",
  "Produtos Shopee e TikTok",
  "Área de membro e Minerador",
  "4.000 créditos de brinde por mês",
];

export function AssinaturaPainel({
  ativa,
  permanente,
  diasRestantes,
  venceEm,
  membroDesde,
  renovadaEm,
  urlAssinatura,
  mpPublicKey,
  valorMensal,
  podeCancelar,
  acessoAntigo,
}: Props) {
  // perto de vencer = 7 dias ou menos (só quando tem data de vencimento)
  const vencendo = ativa && !permanente && diasRestantes !== null && diasRestantes <= 7;

  const tom = !ativa
    ? {
        borda: "border-red-500/30",
        fundo: "bg-red-500/10",
        cor: "text-red-400",
        Icon: XCircle,
        titulo: "Assinatura inativa",
        detalhe: venceEm
          ? `Venceu em ${venceEm}. A biblioteca está bloqueada até você renovar.`
          : "Você ainda não tem assinatura ativa. Assine para liberar a biblioteca.",
      }
    : vencendo
      ? {
          borda: "border-amber-500/30",
          fundo: "bg-amber-500/10",
          cor: "text-amber-400",
          Icon: AlertTriangle,
          titulo:
            diasRestantes === 0
              ? "Sua assinatura vence hoje"
              : diasRestantes === 1
                ? "Sua assinatura vence amanhã"
                : `Sua assinatura vence em ${diasRestantes} dias`,
          detalhe: `Renove antes de ${venceEm} para não perder o acesso à biblioteca.`,
        }
      : {
          borda: "border-emerald-500/30",
          fundo: "bg-emerald-500/10",
          cor: "text-emerald-400",
          Icon: CheckCircle2,
          titulo: "Assinatura ativa",
          detalhe: permanente
            ? "Acesso permanente à biblioteca."
            : `Liberada até ${venceEm}${diasRestantes !== null ? ` (faltam ${diasRestantes} dias)` : ""}.`,
        };

  const TomIcon = tom.Icon;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Crown className="size-6 text-amber-400" />
          Assinatura
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu acesso à biblioteca e ao crédito mensal de brinde.
        </p>
      </div>

      {/* Status */}
      <section className={cn("flex items-start gap-3 rounded-2xl border p-5", tom.borda, tom.fundo)}>
        <TomIcon className={cn("mt-0.5 size-6 shrink-0", tom.cor)} />
        <div>
          <p className={cn("font-semibold", tom.cor)}>{tom.titulo}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{tom.detalhe}</p>
        </div>
      </section>

      {/* Datas */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <UserCheck className="size-4" />
            Membro desde
          </p>
          <p className="mt-1.5 text-sm font-semibold">{membroDesde ?? "-"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CalendarCheck className="size-4" />
            Última renovação
          </p>
          <p className="mt-1.5 text-sm font-semibold">{renovadaEm ?? "Ainda não renovou"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="size-4" />
            Vence em
          </p>
          <p className="mt-1.5 text-sm font-semibold">
            {permanente ? "Nunca (permanente)" : (venceEm ?? "-")}
          </p>
        </div>
      </section>

      {/* O que inclui */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Library className="size-4 text-primary" />
          O que a assinatura libera
        </h2>
        <ul className="mt-3 space-y-2">
          {INCLUI.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">
          <Coins className="mt-0.5 size-4 shrink-0 text-primary" />
          Os créditos que você compra à parte não vencem com a assinatura: eles ficam no
          seu saldo mesmo com a assinatura inativa. A assinatura controla só a biblioteca
          e o brinde mensal.
        </p>
      </section>

      {/* Renovar / Assinar */}
      {acessoAntigo ? (
        // quem entrou antes do Mercado Pago não precisa (nem deve) assinar de
        // novo: já paga pelo canal antigo ou tem acesso concedido
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
          <h2 className="text-sm font-semibold text-emerald-400">Seu acesso está garantido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você entrou antes da mudança de plano, então continua exatamente como
            está: nada muda pra você e não precisa fazer nada. Qualquer dúvida, é
            só chamar a gente no chat.
          </p>
        </section>
      ) : (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">
          {ativa ? "Renovar assinatura" : "Reativar assinatura"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ativa
            ? "Cada pagamento libera mais um mês de acesso. Renove antes de vencer para não ficar sem a biblioteca."
            : "Assine de novo para liberar a biblioteca e voltar a receber o crédito mensal."}
        </p>
        <div className="mt-4">
          {mpPublicKey ? (
            <BotaoAssinarMP
              ativa={ativa}
              publicKey={mpPublicKey}
              valorReais={valorMensal ?? 98.9}
            />
          ) : urlAssinatura ? (
            <Button
              size="lg"
              className="h-11"
              render={
                <a href={urlAssinatura} target="_blank" rel="noopener noreferrer" />
              }
            >
              <Crown className="size-4" />
              {ativa ? "Renovar agora" : "Assinar agora"}
            </Button>
          ) : (
            // link de checkout ainda não configurado: mostra erro em vez de desviar
            <BotaoRenovarIndisponivel ativa={ativa} />
          )}
        </div>

        {/* cancelamento fácil: a LP e o modal prometem "sem falar com ninguém" */}
        {podeCancelar && (
          <div className="mt-3">
            <BotaoCancelarAssinatura venceEm={venceEm} />
          </div>
        )}
      </section>
      )}

      {/* Pedir reembolso da MENSALIDADE (7 dias). Fica aqui, e não só na aba de
          créditos, porque é aqui que a pessoa vem quando quer sair: se não achar,
          ela contesta no cartão, que custa o valor mais a taxa de chargeback. */}
      <MeusReembolsos />

      <p className="text-center text-xs text-muted-foreground">
        Cancelar vale para as próximas cobranças: o mês já pago continua até o
        fim.{" "}
        <a href="/reembolso" className="underline underline-offset-4 hover:text-foreground">
          Ver a política de reembolso
        </a>
      </p>
    </div>
  );
}
