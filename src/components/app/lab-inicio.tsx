import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  Compass,
  Images,
  PenLine,
  type LucideIcon,
} from "lucide-react";

import { midiaFerramenta } from "@/lib/lab-midia";

/**
 * Cartões da tela de apresentação do Viraliza Labs (`/painel/lab/inicio`).
 *
 * Por que ela existe: os nomes das quatro ferramentas não se explicam sozinhos
 * (ninguém adivinha a diferença entre "Criar criativo" e "Vídeo livre"). A
 * barrinha do rodapé até tem uma frase de cada uma, mas só no balãozinho do
 * mouse, que no celular NÃO existe. Aqui a explicação fica na tela, pra todo
 * mundo, e cada cartão inteiro é o botão.
 *
 * Ela não substitui atalho nenhum: quem já sabe o caminho continua clicando
 * direto no item do submenu ou na barrinha, sem passar por aqui. É por isso que
 * ela mora num endereço próprio e não em `/painel/lab`, que é onde o login cai e
 * pra onde a galeria manda a imagem quando a pessoa pede um vídeo novo.
 *
 * VÍDEO DE CADA CARTÃO: entra pelo campo `chave` e sai por `midiaFerramenta`,
 * ou seja, o arquivo mora no serverrk como `lab/ferramentas/<chave>.mp4` com a
 * capa `<chave>.jpg` do lado, igual aos exemplos de estilo e de movimento do
 * funil (ver `lib/lab-midia.ts`). Toca em autoplay, mudo, em loop. Sem o campo,
 * o cartão cai no ícone grande, que é como os três apareciam antes.
 *
 * PESO: a tela toca os quatro de uma vez, então arquivo cru aqui é proibido.
 * Os do Grok vêm em 960px e somavam 32MB para um cartão que aparece com ~250px;
 * recomprimidos pra 480px sem áudio somam 2,25MB. Vídeo novo passa pelo mesmo
 * tratamento ANTES de subir pro serverrk:
 *   ffmpeg -i entrada.mp4 -vf scale=480:480:flags=lanczos -c:v libx264 \
 *     -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart -an <chave>.mp4
 *   ffmpeg -i entrada.mp4 -vf scale=480:480:flags=lanczos -frames:v 1 -q:v 6 <chave>.jpg
 *
 * NENHUM cartão anuncia preço nem "de graça", de propósito. O valor aparece na
 * hora de gerar, que é onde ele é cobrado, e assim esta tela não vira um segundo
 * lugar pra desatualizar quando um preço mudar. Já aconteceu: as quatro eram
 * anunciadas aqui e o Gerador de prompt deixou de ser gratuito em 05/08/2026.
 */

type Ferramenta = {
  href: string;
  titulo: string;
  Icone: LucideIcon;
  descricao: string;
  /** nome do vídeo quadrado em `lab/ferramentas` no serverrk, sem extensão.
   *  Sem ele, o cartão usa o ícone grande. */
  chave?: string;
};

const FERRAMENTAS: Ferramenta[] = [
  {
    href: "/painel/lab",
    titulo: "Criar criativo",
    Icone: Compass,
    descricao:
      "O caminho guiado, do produto até o vídeo pronto. Ele pergunta uma coisa de cada vez e monta tudo pra você. É por aqui que quase todo mundo começa.",
    chave: "criar-criativo",
  },
  {
    href: "/painel/lab/livre",
    titulo: "Vídeo livre",
    Icone: Clapperboard,
    descricao:
      "Sem passo a passo: você escreve com as suas palavras o vídeo que quer, anexa as imagens de referência e a IA grava aquilo.",
    chave: "video-livre",
  },
  {
    href: "/painel/lab/imagens",
    titulo: "Minhas imagens",
    Icone: Images,
    descricao:
      "Tudo que você já gerou fica guardado aqui. Dá pra baixar, favoritar e gerar um vídeo novo de uma imagem sem pagar ela outra vez.",
    chave: "minhas-imagens",
  },
  {
    href: "/painel/lab/prompt",
    titulo: "Gerador de prompt",
    Icone: PenLine,
    descricao:
      "Suba suas fotos e a IA escreve a descrição técnica do vídeo, do jeito que os profissionais escrevem. Depois é só levar pro Vídeo livre.",
    chave: "gerador-prompt",
  },
];

export function LabInicio() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {FERRAMENTAS.map(({ href, titulo, Icone, descricao, chave }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_30px_-12px_var(--color-primary)]"
        >
          {chave ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-black/40">
              <video
                src={midiaFerramenta(chave).video}
                poster={midiaFerramenta(chave).poster}
                autoPlay
                loop
                muted
                playsInline
                preload="none"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : (
            <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <Icone className="size-5.5" />
            </span>
          )}

          <p className="text-sm font-bold sm:text-base">{titulo}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{descricao}</p>

          {/* botão de verdade (fundo cheio): antes era só um texto verde com a
              setinha e não lia como algo clicável. O cartão inteiro continua
              sendo o link, isto aqui é a parte que PARECE botão. */}
          <span className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all group-hover:opacity-90 group-hover:shadow-[0_0_24px_-6px_var(--color-primary)]">
            Abrir
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}
