/**
 * Índice da Central de Ajuda (`/painel/ajuda`).
 *
 * Fonte única da numeração: o menu lateral e o número que aparece no título de
 * cada seção saem daqui. Pra criar uma seção nova, adicione o id na ordem certa
 * e escreva o <Secao id="..."> no componente do grupo - a numeração se ajusta
 * sozinha e nunca fica fora de ordem.
 */

export type ItemAjuda = { id: string; titulo: string };
export type GrupoAjuda = { grupo: string; itens: ItemAjuda[] };

export const GRUPOS_AJUDA: GrupoAjuda[] = [
  {
    grupo: "Começando",
    itens: [
      { id: "primeiros-passos", titulo: "Primeiros passos" },
      { id: "creditos", titulo: "Créditos e assinatura" },
      { id: "niveis", titulo: "Níveis da conta" },
    ],
  },
  {
    grupo: "Seu influenciador",
    itens: [
      { id: "influenciador", titulo: "O que é um influenciador" },
      // o `id` continua "criar-com-ia" de propósito: é a âncora da seção e o que
      // link antigo e conversa salva do robô já apontam. Só a etiqueta mudou.
      { id: "criar-com-ia", titulo: "Novo influenciador, passo a passo" },
      { id: "outras-formas", titulo: "As outras 3 formas de criar" },
    ],
  },
  {
    grupo: "Criar vídeos",
    itens: [
      { id: "labs", titulo: "Viraliza Labs" },
      { id: "boost", titulo: "Viral Boost" },
      { id: "editor", titulo: "Editor automático" },
      { id: "criar-corte", titulo: "Criar um Corte" },
      { id: "cortes", titulo: "Cortes de qualquer vídeo" },
    ],
  },
  {
    grupo: "Outras ferramentas",
    itens: [
      { id: "lote", titulo: "Aplicar marca em lote" },
      { id: "leads", titulo: "MapsLeads" },
      { id: "biblioteca", titulo: "Minerador e biblioteca" },
    ],
  },
  {
    grupo: "Sua conta",
    itens: [
      { id: "meus-videos", titulo: "Meus vídeos e downloads" },
      { id: "conta", titulo: "Conta, senha e indicações" },
      { id: "problemas", titulo: "Deu errado? Resolve aqui" },
    ],
  },
];

/** Todas as seções na ordem em que aparecem na página (define a numeração). */
export const SECOES_AJUDA: ItemAjuda[] = GRUPOS_AJUDA.flatMap((g) => g.itens);

/** Número da seção pelo id (1 based). Zero quando o id não está no índice. */
export function numeroDaSecao(id: string): number {
  return SECOES_AJUDA.findIndex((s) => s.id === id) + 1;
}
