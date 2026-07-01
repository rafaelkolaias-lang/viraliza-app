import type { Metadata } from "next";
import Link from "next/link";
import {
  User,
  Mail,
  Crown,
  Coins,
  Receipt,
  KeyRound,
} from "lucide-react";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getCarteira, fmtCreditos } from "@/lib/creditos";
import { Button } from "@/components/ui/button";
import { TrocarSenhaForm } from "@/components/app/trocar-senha-form";
import { ChaveElevenForm } from "@/components/app/chave-eleven-form";

export const metadata: Metadata = { title: "Conta" };
export const dynamic = "force-dynamic";

// BYO key (chave própria da ElevenLabs): recurso pronto, mas ainda NÃO liberado.
// Vire pra `true` quando quiser abrir pros usuários (é a única porta de entrada:
// travar o formulário desliga o BYO por completo).
const BYO_LIBERADO = false;

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default async function ContaPage() {
  const user = await requireUser();
  const carteira = await getCarteira(user.id);
  const dados = await prisma.user.findUnique({
    where: { id: user.id },
    select: { elevenKey: true },
  });
  const chaveConfigurada = !!dados?.elevenKey;
  const assinaturaOk =
    carteira.assinante &&
    (!carteira.assinaturaAte || carteira.assinaturaAte.getTime() > Date.now());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <User className="size-6 text-primary" />
          Minha conta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus dados, plano e segurança.
        </p>
      </div>

      {/* Dados */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Dados</h2>
        <div className="mt-3 space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            {user.nome}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            {user.email}
          </p>
        </div>
      </section>

      {/* Plano + créditos */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Plano e créditos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Crown className="size-4 text-amber-400" />
              Assinatura
            </p>
            <p className="mt-1.5 text-lg font-bold">
              {assinaturaOk ? "Ativa" : "Inativa"}
            </p>
            {assinaturaOk && carteira.assinaturaAte && (
              <p className="text-xs text-muted-foreground">
                até {fmtData.format(carteira.assinaturaAte)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Coins className="size-4 text-primary" />
              Créditos
            </p>
            <p className="mt-1.5 text-lg font-bold text-primary">
              {fmtCreditos(carteira.saldoCentavos)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" render={<Link href="/painel/extrato" />}>
            <Receipt className="size-4" />
            Ver extrato
          </Button>
          <Button size="sm" render={<Link href="/painel/creditos" />}>
            <Coins className="size-4" />
            Comprar créditos
          </Button>
        </div>
      </section>

      {/* Segurança */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" />
          Trocar senha
        </h2>
        <div className="mt-3">
          <TrocarSenhaForm />
        </div>
      </section>

      {/* Chave ElevenLabs própria (BYO) - pronto, mas ainda "Em breve" */}
      <section
        className={
          BYO_LIBERADO
            ? "rounded-2xl border border-border bg-card p-5"
            : "rounded-2xl border border-dashed border-border bg-card/40 p-5"
        }
      >
        <h2
          className={
            BYO_LIBERADO
              ? "flex items-center gap-2 text-sm font-semibold"
              : "flex items-center gap-2 text-sm font-semibold text-muted-foreground"
          }
        >
          <KeyRound className={BYO_LIBERADO ? "size-4 text-primary" : "size-4"} />
          Sua chave da ElevenLabs
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Cole a sua chave e a narração passa a usar a sua conta ElevenLabs,
          inclusive as vozes que você criou - sem gastar crédito da plataforma na
          voz. A chave fica guardada cifrada.
        </p>
        {BYO_LIBERADO ? (
          <div className="mt-3">
            <ChaveElevenForm configurada={chaveConfigurada} />
          </div>
        ) : (
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            Em breve
          </span>
        )}
      </section>
    </div>
  );
}
