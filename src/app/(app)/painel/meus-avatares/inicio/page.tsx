import type { Metadata } from "next";
import { Image as ImageIcon, Palette, Sparkles, UserRound } from "lucide-react";
import { LabCabecalho } from "@/components/app/lab-cabecalho";
import {
  GradeFerramentas,
  type CartaoFerramenta,
} from "@/components/app/grade-ferramentas";

export const metadata: Metadata = { title: "Personalize com IA" };

/**
 * Porta de entrada do grupo "Personalize com IA": apresenta as 3 telas e diz o
 * que cada uma faz. É pra onde o nome do grupo no menu leva.
 *
 * Mesma ideia da tela do Viraliza Labs (`/painel/lab/inicio`): os nomes não se
 * explicam sozinhos, e a frase que a barrinha do rodapé tem só aparece no
 * balãozinho do mouse, que no celular não existe. Quem já sabe o caminho não
 * passa por aqui, continua clicando direto no submenu ou na barrinha.
 *
 * Ela mora DENTRO de `meus-avatares/` pra herdar a casca do grupo (é o layout
 * dessa pasta que monta a barrinha do rodapé). Não tem nada de servidor pra
 * fazer aqui e o login já é exigido pelo layout do painel.
 */

const TELAS: CartaoFerramenta[] = [
  {
    href: "/painel/meus-avatares/criar",
    titulo: "Novo influenciador",
    imagemLocal: "/capas/novo-influenciador.png",
    Icone: Sparkles,
    descricao:
      "Onde nasce a pessoa que aparece nos seus vídeos. São três caminhos: montar do zero respondendo perguntas, partir de uma foto real ou criar já segurando o seu produto.",
  },
  {
    href: "/painel/meus-avatares",
    titulo: "Galeria de avatares",
    chave: "galeria-avatares",
    foto: true,
    Icone: UserRound,
    descricao:
      "Seus influenciadores ficam guardados aqui, junto com os que já vêm prontos na plataforma. É desta lista que você escolhe na hora de gerar um vídeo.",
  },
  {
    href: "/painel/meus-avatares/cenarios",
    titulo: "Meus cenários",
    chave: "meus-cenarios",
    foto: true,
    Icone: ImageIcon,
    descricao:
      "O fundo onde a cena acontece. Suba a sua loja, a sua bancada ou o seu quarto e use sempre o mesmo lugar, pra os vídeos parecerem do mesmo canal.",
  },
];

export default function PersonalizeInicioPage() {
  return (
    <div>
      <LabCabecalho
        Icone={Palette}
        chamada="Quem aparece e onde aparece nos seus vídeos"
        titulo={
          <>
            Personalize <span className="text-primary">com IA</span>
          </>
        }
        descricao="São três telas aqui dentro, e elas se completam: uma cria a pessoa, outra guarda ela e a terceira guarda o cenário. Veja o que cada uma faz."
      />
      <div className="mt-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
        <GradeFerramentas itens={TELAS} colunas={3} />
      </div>
    </div>
  );
}
