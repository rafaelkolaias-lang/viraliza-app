import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { listarAvatares } from "@/lib/avatares";
import { AVATARES_PRONTOS } from "@/lib/avatares-prontos";
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import { VideoLivre } from "@/components/app/video-livre";

export const metadata: Metadata = { title: "Vídeo livre" };
export const dynamic = "force-dynamic";

/**
 * "Vídeo livre": a pessoa escreve o vídeo com as palavras dela e anexa as
 * imagens. Era uma aba do dock do Labs e agora tem rota própria. Os avatares
 * dela vêm do servidor porque o anexo pode sair da galeria de influenciadores.
 */
export default async function LabLivrePage() {
  const user = await requireUser();
  const meus = await listarAvatares(user.id);
  return (
    <div>
      <LabCabecalho
        Icone={Clapperboard}
        chamada="Você escreve o que quer e a IA grava"
        titulo="Vídeo livre"
        descricao="Escreva com suas palavras o vídeo que você quer, anexe as imagens de referência e a IA grava exatamente aquilo."
      />
      <div className="mt-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
        <VideoLivre
          meusAvatares={meus.map((a) => ({
            id: a.id,
            nome: a.nome,
            imagemUrl: a.imagemUrl,
          }))}
          prontos={AVATARES_PRONTOS}
        />
      </div>
    </div>
  );
}
