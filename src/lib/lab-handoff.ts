"use client";

/**
 * Passagem de bastão entre as telas do Viraliza Labs.
 *
 * As ferramentas do Labs viraram ROTAS separadas (funil, minhas imagens, vídeo
 * livre, gerador de prompt). Antes elas eram abas da mesma tela e trocavam dados
 * por estado do React; agora que cada uma é uma página, os dois atalhos que
 * cruzam telas precisam de um lugar pra deixar o recado:
 *
 * - "Novo vídeo" na galeria: leva a imagem (e as escolhas que a criaram) pro
 *   funil, que abre direto no passo do vídeo sem gerar a imagem de novo.
 * - "Usar no Vídeo livre" no gerador: leva o prompt pronto e as fotos.
 *
 * Por que memória do módulo e não sessionStorage: o recado do gerador carrega
 * até 3 fotos em base64, que passam fácil da cota do sessionStorage e fariam o
 * atalho falhar calado. Como a navegação do painel é do lado do cliente, o
 * módulo continua vivo entre uma tela e outra. Se a pessoa recarregar a página
 * no meio do caminho o recado se perde, e é o comportamento certo: ela abriu a
 * tela do zero, não clicou no atalho.
 *
 * O recado vale UMA vez só: quem lê ("espiar") monta a tela com ele e depois
 * apaga ("limpar"). Sem isso, entrar no Labs pelo menu na vez seguinte cairia de
 * novo no vídeo da imagem antiga. Ler e apagar são passos separados de propósito
 * porque a tela lê enquanto está montando o estado inicial, e apagar coisa de
 * fora no meio da montagem é justamente o que quebra em modo estrito.
 */

import type { ImagemDaGaleria } from "@/lib/galeria-imagens";

export type PromptParaLivre = { texto: string; midias: string[] };

let imagemParaVideo: ImagemDaGaleria | null = null;
let promptParaLivre: PromptParaLivre | null = null;

/** Galeria: manda a imagem pro funil abrir no passo do vídeo. */
export function guardarImagemParaVideo(img: ImagemDaGaleria) {
  imagemParaVideo = img;
}

/** Funil: lê a imagem que a galeria deixou, sem consumir. */
export function espiarImagemParaVideo(): ImagemDaGaleria | null {
  return imagemParaVideo;
}

/** Funil: apaga o recado depois de já ter montado a tela com ele. */
export function limparImagemParaVideo() {
  imagemParaVideo = null;
}

/** Gerador de prompt: manda o prompt pronto e as fotos pro Vídeo livre. */
export function guardarPromptParaLivre(recado: PromptParaLivre) {
  promptParaLivre = recado;
}

/** Vídeo livre: lê o prompt que o gerador deixou, sem consumir. */
export function espiarPromptParaLivre(): PromptParaLivre | null {
  return promptParaLivre;
}

/** Vídeo livre: apaga o recado depois de já ter preenchido o campo. */
export function limparPromptParaLivre() {
  promptParaLivre = null;
}
