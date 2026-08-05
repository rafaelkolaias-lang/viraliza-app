import Link from "next/link";
import { Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tela de bloqueio da biblioteca (mostrada NO LUGAR do conteúdo quando a pessoa
 *  não tem assinatura ativa). Substitui o antigo redirect pra outra página: o
 *  usuário continua onde clicou e vê o aviso ali mesmo. */
export function BibliotecaBloqueada({ titulo }: { titulo?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber-500/15">
        <Lock className="size-7 text-amber-400" />
      </span>
      <h1 className="mt-5 text-lg font-semibold tracking-tight">
        {titulo ?? "Isso é exclusivo pra assinantes"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sua assinatura não está ativa. Assine (ou renove) para liberar o acervo de
        cortes, os vídeos virais, os produtos e a área do membro. Comprar crédito não
        libera a biblioteca: quem abre é a assinatura.
      </p>
      <div className="mt-6">
        <Button render={<Link href="/painel/assinatura" />}>
          <Crown className="size-4" />
          Ver minha assinatura
        </Button>
      </div>
    </div>
  );
}
