import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { EmBreve } from "@/components/app/em-breve";

export const metadata: Metadata = { title: "Indique e Ganhe" };
export const dynamic = "force-dynamic";

export default async function IndiquePage() {
  await requireUser();
  return (
    <EmBreve
      etiqueta="Programa de indicação"
      titulo="Indique e"
      destaque="Ganhe"
      Icone={Gift}
      descricao="Você indica a Viraliza, a pessoa assina e você ganha. Estamos fechando as regras e o pagamento pra abrir do jeito certo."
      itens={[
        {
          titulo: "Seu link",
          texto: "Um link só seu pra compartilhar onde quiser, sem limite de indicações.",
        },
        {
          titulo: "Comissão por venda",
          texto: "Cada assinatura que entrar pelo seu link vira dinheiro na sua conta.",
        },
        {
          titulo: "Acompanhamento",
          texto: "Painel com cliques, indicações e quanto você já ganhou.",
        },
      ]}
      rodape="Quer entrar na primeira leva? Manda um recado na aba Sugestões que a gente te chama."
    />
  );
}
