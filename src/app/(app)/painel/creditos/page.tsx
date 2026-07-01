import type { Metadata } from "next";
import Link from "next/link";
import {
  Coins,
  KeyRound,
  Type,
  Volume2,
  Sparkles,
  Crown,
  Receipt,
  Lock,
} from "lucide-react";
import { requireUser } from "@/lib/dal";
import { getCarteira, fmtCreditos } from "@/lib/creditos";
import { Button } from "@/components/ui/button";
import { PlanosCreditos } from "@/components/app/planos-creditos";
import { AdminCreditosTeste } from "@/components/app/admin-creditos-teste";

export const metadata: Metadata = { title: "Créditos" };
export const dynamic = "force-dynamic";

export default async function CreditosPage({
  searchParams,
}: {
  searchParams: Promise<{ bloqueio?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const carteira = await getCarteira(user.id);

  return (
    <div className="space-y-7">
      {/* aviso quando a pessoa tentou entrar na biblioteca sem assinatura */}
      {sp.bloqueio === "biblioteca" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Lock className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="text-sm">
            <p className="font-semibold text-amber-400">
              A biblioteca é exclusiva pra assinantes
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Assine pra liberar o acervo de cortes, os vídeos virais, os produtos
              e a área do membro.
            </p>
          </div>
        </div>
      )}

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-grid-glow p-6 md:p-8">
        <div className="grain absolute inset-0" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Coins className="size-3.5" />
            Créditos de IA
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-glow md:text-4xl">
            Comprar créditos
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground md:text-base">
            Seus créditos pagam a <strong className="text-foreground">produção</strong> dos
            vídeos (texto e narração por IA). A assinatura libera a{" "}
            <strong className="text-foreground">biblioteca</strong>.
          </p>

          {/* saldo real */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 backdrop-blur-sm">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary">
                <Coins className="size-5" />
              </span>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Seu saldo
                </p>
                <p className="text-lg font-bold leading-none text-foreground">
                  {fmtCreditos(carteira.saldoCentavos)}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    créditos
                  </span>
                </p>
              </div>
            </div>
            {carteira.assinante && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm font-semibold text-amber-400">
                <Crown className="size-4" />
                Assinante
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              render={<Link href="/painel/extrato" />}
            >
              <Receipt className="size-4" />
              Ver extrato
            </Button>
          </div>
        </div>
      </section>

      {/* ===== PAINEL DE TESTE (admin) ===== */}
      {user.role === "admin" && (
        <AdminCreditosTeste assinante={carteira.assinante} />
      )}

      {/* ===== PLANOS ===== */}
      <PlanosCreditos />

      {/* ===== COMO FUNCIONA ===== */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-5 text-primary" />
          Como os créditos funcionam
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <Type className="size-5 text-primary" />
            <p className="mt-2 text-sm font-semibold">Geração de texto</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada copy/legenda escrita pela IA desconta um valor do seu saldo,
              conforme o tamanho do texto.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <Volume2 className="size-5 text-primary" />
            <p className="mt-2 text-sm font-semibold">Geração de áudio</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A narração desconta conforme a quantidade de fala - quanto mais longo
              o áudio, maior o custo.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <KeyRound className="size-5 text-primary" />
            <p className="mt-2 text-sm font-semibold">Tem sua própria chave?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Você pode usar sua própria API e gerar sem gastar crédito da
              plataforma.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
