import type { Metadata } from "next";
import { Images } from "lucide-react";
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import { LabGaleria } from "@/components/app/lab-galeria";

export const metadata: Metadata = { title: "Minhas imagens" };
export const dynamic = "force-dynamic";

/**
 * "Minhas imagens": a galeria do que a pessoa já gerou. Era uma aba do dock do
 * Labs e agora tem rota própria. Quem carrega a lista é a própria galeria (ela
 * busca em /api/imagens), então aqui não tem nada de servidor pra fazer: o login
 * já é exigido pelo layout do painel.
 */
export default function LabImagensPage() {
  return (
    <div>
      <LabCabecalho
        Icone={Images}
        chamada="Tudo que você já gerou, salvo"
        titulo="Minhas imagens"
        descricao="Toda imagem que você gera fica guardada aqui. Baixe, favorite ou gere um vídeo novo dela sem precisar montar a cena de novo."
      />
      <div className="mt-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
        <LabGaleria comCabecalho={false} />
      </div>
    </div>
  );
}
