import type { Metadata } from "next";
import { AssinarPublico } from "@/components/app/assinar-publico";

export const metadata: Metadata = {
  title: "Assinar o Viraliza",
  description:
    "Crie influenciadores de IA e gere vídeos que vendem. Acesso imediato, cancele quando quiser.",
};

// preço e credenciais vêm do ambiente, então nada de cache
export const dynamic = "force-dynamic";

/**
 * Checkout PÚBLICO da assinatura (o destino dos botões da landing page).
 *
 * Existe por causa da ordem do fluxo no Viraliza: a conta só pode ser criada
 * depois da compra (trava anti-farm do crédito de boas-vindas). Então o
 * visitante precisa de um lugar pra pagar SEM estar logado; o cadastro vem
 * depois, com o e-mail que ele usar aqui.
 */
export default function AssinarPage() {
  // a public key tem que ser da MESMA aplicação do token de assinatura, senão
  // o Mercado Pago não reconhece o cartão tokenizado
  const publicKey =
    process.env.MP_ASSINATURA_PUBLIC_KEY || process.env.MP_PUBLIC_KEY || "";

  if (!publicKey) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Assinatura indisponível no momento</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estamos ajustando o pagamento. Tente de novo em alguns minutos.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background">
      <AssinarPublico publicKey={publicKey} />
    </main>
  );
}
