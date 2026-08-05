/**
 * BLOG da plataforma (`/painel/blog`).
 *
 * ESTRUTURA PRÉ-PRONTA: hoje não existe nenhum artigo publicado, então a tela
 * mostra o "EM BREVE" (igual ao Viraliza Academy). Assim que o primeiro objeto
 * entrar em ARTIGOS_BLOG, a listagem e a leitura passam a funcionar sozinhas.
 *
 * COMO O PAYWALL FUNCIONA (o pedido do dono):
 * todo artigo tem uma `previa` (o começo, que qualquer usuário logado lê) e um
 * `conteudo` (o resto). Quando `exclusivo: true`, o resto só vai pra quem tem
 * assinatura ativa: quem não tem vê o botão "Continuar lendo" e, ao clicar,
 * recebe o convite pra assinar. O corte é feito NO SERVIDOR (o texto exclusivo
 * nem chega no navegador de quem não pode ler); esconder com CSS não seguraria.
 *
 * Módulo client-safe de propósito (sem "server-only"): o componente de leitura
 * é client e precisa dos tipos daqui.
 */

export type BlocoArtigo =
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "lista"; itens: string[] }
  /** caixa de destaque (dica, aviso, resumo do que importa) */
  | { tipo: "destaque"; texto: string };

export type ArtigoBlog = {
  /** vira a URL: /painel/blog/<slug>. Só minúsculas, números e hífen. */
  slug: string;
  titulo: string;
  /** uma frase: aparece no card da listagem e na abertura do artigo */
  resumo: string;
  /** etiqueta curta do card, ex: "Tendências", "Tutorial", "Novidades" */
  categoria: string;
  /** "AAAA-MM-DD" (data de publicação, no fuso do Brasil) */
  publicadoEm: string;
  /** tempo de leitura em minutos (aparece no card) */
  minutos: number;
  /** imagem de capa (URL da mídia); sem ela o card usa só a cor da marca */
  capa?: string;
  /** true = o `conteudo` é só pra assinante (a `previa` continua aberta) */
  exclusivo: boolean;
  /** começo do artigo: SEMPRE visível pra qualquer usuário logado */
  previa: BlocoArtigo[];
  /** o resto do artigo: atrás do paywall quando `exclusivo` */
  conteudo: BlocoArtigo[];
};

/**
 * Artigos publicados, do mais novo pro mais antigo.
 *
 * MODELO pra criar o primeiro (é só descomentar e ajustar):
 *
 * {
 *   slug: "produtos-em-alta-agosto",
 *   titulo: "Os produtos que estão vendendo agora na Shopee",
 *   resumo: "O que subiu de procura essa semana e como fazer o vídeo antes de saturar.",
 *   categoria: "Tendências",
 *   publicadoEm: "2026-08-10",
 *   minutos: 4,
 *   exclusivo: true,
 *   previa: [
 *     { tipo: "paragrafo", texto: "Todo mês uma leva de produto sobe..." },
 *     { tipo: "paragrafo", texto: "Antes de gravar, vale olhar três coisas..." },
 *   ],
 *   conteudo: [
 *     { tipo: "subtitulo", texto: "1. Olhe o número de vendidos" },
 *     { tipo: "paragrafo", texto: "..." },
 *     { tipo: "lista", itens: ["Primeiro ponto", "Segundo ponto"] },
 *     { tipo: "destaque", texto: "Dica: ..." },
 *   ],
 * },
 */
export const ARTIGOS_BLOG: ArtigoBlog[] = [];

/** Tem artigo publicado? Enquanto for false, a aba mostra a tela de "em breve". */
export function blogTemArtigos(): boolean {
  return ARTIGOS_BLOG.length > 0;
}

/** Artigos do mais novo pro mais antigo (a listagem usa esta ordem). */
export function listarArtigos(): ArtigoBlog[] {
  return [...ARTIGOS_BLOG].sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
}

/** Acha o artigo pela URL. null quando o slug não existe (a página dá 404). */
export function artigoPorSlug(slug: string): ArtigoBlog | null {
  return ARTIGOS_BLOG.find((a) => a.slug === slug) ?? null;
}

/**
 * O leitor pode ver o artigo INTEIRO?
 * Artigo aberto: todo mundo. Artigo exclusivo: só com assinatura ativa
 * (admin e demo entram sempre, porque `assinaturaAtiva` já devolve true pra eles).
 */
export function podeLerCompleto(artigo: ArtigoBlog, assinante: boolean): boolean {
  return !artigo.exclusivo || assinante;
}

/** Os outros artigos, pra sugerir no fim da leitura. */
export function outrosArtigos(slug: string, quantos = 3): ArtigoBlog[] {
  return listarArtigos()
    .filter((a) => a.slug !== slug)
    .slice(0, quantos);
}

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** "2026-08-10" -> "10 de agosto de 2026". Meio-dia evita virada de fuso. */
export function dataDoArtigo(publicadoEm: string): string {
  const d = new Date(`${publicadoEm}T12:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? publicadoEm : fmtData.format(d);
}
