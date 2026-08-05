"use client";

import { toast } from "sonner";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botão de renovar/assinar enquanto o link de checkout da assinatura
 *  (`CAKTO_CHECKOUT_ASSINATURA`) ainda NÃO foi configurado. Em vez de mandar pra
 *  outra aba, mostra um erro avisando que a renovação ainda não está no ar.
 *  Assim que o env for preenchido, a página troca este botão pelo link real. */
export function BotaoRenovarIndisponivel({ ativa }: { ativa: boolean }) {
  return (
    <Button
      size="lg"
      variant="outline"
      className="h-11"
      onClick={() =>
        toast.error("Renovação indisponível no momento", {
          description:
            "Estamos ativando o pagamento da assinatura por aqui. Tente de novo em breve.",
        })
      }
    >
      <Crown className="size-4" />
      {ativa ? "Renovar agora" : "Assinar agora"}
    </Button>
  );
}
