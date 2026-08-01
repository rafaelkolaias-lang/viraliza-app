import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { EmBreve } from "@/components/app/em-breve";

export const metadata: Metadata = { title: "Viraliza Academy" };
export const dynamic = "force-dynamic";

export default async function AcademyPage() {
  await requireUser();
  return (
    <EmBreve
      etiqueta="Área de treinamento"
      titulo="Viraliza"
      destaque="Academy"
      Icone={GraduationCap}
      descricao="As aulas que ensinam a vender com os criativos que você gera aqui: do primeiro vídeo até escalar. Estamos gravando, e você vai ser avisado assim que abrir."
      itens={[
        {
          titulo: "Primeiros passos",
          texto: "Como usar cada ferramenta da plataforma sem se perder e já sair com vídeo pronto.",
        },
        {
          titulo: "Achar o produto certo",
          texto: "Como garimpar o que está vendendo no TikTok Shop e na Shopee antes de saturar.",
        },
        {
          titulo: "Criativo que vende",
          texto: "O que muda entre um vídeo que roda e um vídeo que fatura, na prática.",
        },
      ]}
      rodape="Assim que a primeira aula subir, o aviso chega no sininho."
    />
  );
}
