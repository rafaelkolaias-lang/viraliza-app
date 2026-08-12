import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { midiaFerramenta } from "@/lib/lab-midia";
import { cn } from "@/lib/utils";

/**
 * A GRADE DE CARTÕES das telas de apresentação de grupo (os "quadradinhos").
 *
 * Nasceu dentro do `lab-inicio.tsx`, com a lista das 4 ferramentas do Labs
 * cravada no meio do JSX. Quando os grupos "Personalize com IA" e "Ferramentas"
 * ganharam a mesma tela (06/08/2026), copiar o mesmo JSX três vezes garantiria
 * que um dia as três ficariam diferentes: agora o desenho mora aqui e cada tela
 * só passa a SUA lista.
 *
 * Por que essas telas existem: o nome das ferramentas não se explica sozinho
 * (ninguém adivinha a diferença entre "Criar um Corte" e "Cortes de qualquer
 * vídeo"). A barrinha do rodapé até tem uma frase de cada uma, mas só no
 * balãozinho do mouse, que no celular NÃO existe. Aqui a explicação fica na
 * tela, pra todo mundo, e o cartão inteiro é o botão.
 *
 * Elas não substituem atalho nenhum: quem já sabe o caminho continua clicando
 * direto no submenu ou na barrinha, sem passar por aqui. **Isso é o que
 * diferencia esta tela da antiga `/painel/ferramentas`, que foi APAGADA em
 * 05/08/2026 justamente por ser uma grade de atalhos repetidos, um clique a mais
 * pro mesmo lugar.** O que justifica a volta dela é a explicação. Se um dia
 * alguém tirar as frases e deixar só os botões, ela vira aquilo de novo.
 *
 * VÍDEO DE CADA CARTÃO: entra pelo campo `chave` e sai por `midiaFerramenta`, ou
 * seja, o arquivo mora no serverrk como `lab/ferramentas/<chave>.mp4` com a capa
 * `<chave>.jpg` do lado, igual aos exemplos de estilo e de movimento do funil
 * (ver `lib/lab-midia.ts`). Toca em autoplay, mudo, em loop. Sem o campo, o
 * cartão cai no ícone grande, que é como os do Labs apareciam antes do vídeo
 * chegar.
 *
 * SÓ FOTO: cartão com `foto: true` mostra apenas o `<chave>.jpg` (o "poster"),
 * sem procurar `.mp4` nenhum. É o estado atual das 9 ferramentas dos grupos
 * "Personalize com IA" e "Ferramentas" (06/08/2026): o dono subiu uma arte por
 * cartão enquanto os vídeos de demonstração não existem. Quando o vídeo de um
 * cartão ficar pronto, suba o `<chave>.mp4` no serverrk e apague o `foto: true`
 * daquele item, que o cartão volta a tocar vídeo com a mesma foto de capa.
 *
 * IMAGEM DO PRÓPRIO SITE: cartão com `imagemLocal` mostra o arquivo que está na
 * pasta `public` daqui mesmo (ex: `/capas/novo-influenciador.png`), sem passar
 * pelo serverrk nem pelo `midiaFerramenta`. Ganha de `chave` e de `foto: true`.
 * Serve pra arte que o dono quer trocar sem subir nada em servidor nenhum, e
 * por isso ela também não pega o cache de 4h da Cloudflare.
 *
 * PESO: a tela toca todos de uma vez, então arquivo cru aqui é proibido. Os do
 * Grok vêm em 960px e somavam 32MB para um cartão que aparece com ~250px;
 * recomprimidos pra 480px sem áudio somam 2,25MB. Vídeo novo passa pelo mesmo
 * tratamento ANTES de subir pro serverrk:
 *   ffmpeg -i entrada.mp4 -vf scale=480:480:flags=lanczos -c:v libx264 \
 *     -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart -an <chave>.mp4
 *   ffmpeg -i entrada.mp4 -vf scale=480:480:flags=lanczos -frames:v 1 -q:v 6 <chave>.jpg
 * E lembre do cache de 4h da Cloudflare, que guarda até o 404 (explicado no topo
 * do `lib/lab-midia.ts`): testar a URL antes de subir o arquivo deixa o erro
 * grudado depois.
 *
 * NENHUM cartão anuncia preço nem "de graça", de propósito. O valor aparece na
 * hora de gerar, que é onde ele é cobrado, e assim esta tela não vira um segundo
 * lugar pra desatualizar quando um preço mudar. Já aconteceu: as quatro do Labs
 * eram anunciadas aqui e o Gerador de prompt deixou de ser gratuito em
 * 05/08/2026.
 */

export type CartaoFerramenta = {
  href: string;
  titulo: string;
  Icone: LucideIcon;
  descricao: string;
  /** nome do vídeo quadrado em `lab/ferramentas` no serverrk, sem extensão.
   *  Sem ele, o cartão usa o ícone grande. */
  chave?: string;
  /** true = ainda não existe o vídeo: mostra só a foto `<chave>.jpg`. */
  foto?: boolean;
  /** caminho de uma imagem servida pelo próprio site (pasta `public`), tipo
   *  "/capas/novo-influenciador.png". Tem prioridade sobre `chave`: quando a
   *  arte do cartão mora aqui e não no serverrk, é este campo que vale. */
  imagemLocal?: string;
};

export function GradeFerramentas({
  itens,
  colunas = 4,
}: {
  itens: readonly CartaoFerramenta[];
  /** quantas colunas no desktop. 3 fica melhor quando são poucos cartões. */
  colunas?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2",
        colunas === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4",
      )}
    >
      {itens.map(({ href, titulo, Icone, descricao, chave, foto, imagemLocal }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_30px_-12px_var(--color-primary)]"
        >
          {imagemLocal ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-black/40">
              <img
                src={imagemLocal}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : chave && foto ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-black/40">
              <img
                src={midiaFerramenta(chave).poster}
                alt=""
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : chave ? (
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
