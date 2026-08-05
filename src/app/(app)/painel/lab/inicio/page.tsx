import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import { LabInicio } from "@/components/app/lab-inicio";

export const metadata: Metadata = { title: "Viraliza Labs" };

/**
 * Porta de entrada do Viraliza Labs: apresenta as 4 ferramentas com o que cada
 * uma faz e um botão pra abrir. É pra onde o nome "Viraliza Labs" do menu leva.
 *
 * O funil continua em `/painel/lab` (é onde o login cai, pra onde a galeria manda
 * a imagem no "Novo vídeo" e o que o aviso de vídeo pronto abre), então esta tela
 * NÃO rouba aquele endereço: ela é um lugar a mais, não um pedágio no caminho de
 * quem já sabe aonde vai.
 *
 * Não tem nada de servidor pra fazer aqui (é texto e link), e o login já é
 * exigido pelo layout do painel.
 */
export default function LabInicioPage() {
  return (
    <div>
      <LabCabecalho
        Icone={FlaskConical}
        chamada="O laboratório onde produtos viram criativos"
        titulo={
          <>
            Viraliza <span className="text-primary">Labs</span>
          </>
        }
        descricao="São quatro ferramentas aqui dentro. Veja o que cada uma faz e escolha por onde começar."
      />
      <div className="mt-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
        <LabInicio />
      </div>
    </div>
  );
}
