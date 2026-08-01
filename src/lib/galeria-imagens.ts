/**
 * Galeria "Minhas imagens": toda imagem gerada na plataforma cai aqui sozinha.
 *
 * A pessoa costuma gerar 3, 4 vezes até gostar, e antes disso as tentativas se
 * perdiam ao sair da tela (ela já tinha pago). Agora tudo fica salvo e ela apaga
 * o que não prestou.
 *
 * O contexto é o que separa essa galeria de uma pasta de fotos: quando a imagem
 * nasce no Lab, a gente guarda produto, influenciador, estilo e cenário junto.
 * Aí o botão "Novo vídeo" abre o Lab direto no passo do vídeo, com tudo no
 * lugar, sem refazer (e sem cobrar) a imagem de novo.
 *
 * Este arquivo é PURO (tela e servidor usam). Quem fala com o banco é o
 * galeria-servidor.ts.
 */

export type OrigemImagem = "lab" | "boost" | "avatar";

/** O que o Lab precisa saber pra retomar a imagem no passo do vídeo. */
export type ContextoImagem = {
  estilo?: string | null;
  variacao?: string | null;
  cena?: string;
  cenario?: string | null;
  cenarioTexto?: string;
  produtoId?: string;
  produtoTitulo?: string;
  produtoImagem?: string;
  produtoMeu?: boolean;
  avatarId?: string;
  avatarNome?: string;
  avatarImagem?: string;
};

export type ImagemDaGaleria = {
  id: string;
  origem: OrigemImagem;
  titulo: string;
  imagem: string;
  favorita: boolean;
  videos: number;
  criadoEm: string;
  contexto: ContextoImagem | null;
};

/** Rótulo de cada origem (etiqueta no card). */
export const ROTULO_ORIGEM: Record<OrigemImagem, string> = {
  lab: "Viraliza Labs",
  boost: "Viral Boost",
  avatar: "Personalize com IA",
};
