/**
 * A oferta da página pública de assinatura (/assinar). Client-safe: a tela
 * importa direto pra montar o resumo do pedido.
 *
 * Quem manda no preço é o servidor: a tela mostra o que está aqui, e a rota de
 * criação lê a MESMA constante. Assim não existe o caso de a pessoa ver um
 * valor e ser cobrada outro.
 */

export const PLANO_BASE_REAIS = Number(process.env.MP_ASSINATURA_REAIS || 98.9);

/** Preço cheio da tabela, usado como referência ("de X por Y"). */
export const PLANO_DE_REAIS = Number(process.env.MP_ASSINATURA_DE_REAIS || 197.9);

/** Quanto tempo o desconto fica de pé pra quem abriu a página (minutos). */
export const OFERTA_MINUTOS = 15;

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O que a assinatura entrega (a lista do resumo do pedido). */
export const INCLUI_PLANO = [
  "4.000 créditos de IA todo mês",
  "Influenciadores de IA que você cria do seu jeito",
  "Viraliza Labs: cenas, câmera e avatares",
  "Viral Boost com as historinhas prontas",
  "Editor automático com legenda e voz",
  "Acervo com 18 mil cortes em 22 categorias",
  "Produtos do TikTok e da Shopee com link de afiliado",
];

/**
 * Os quatro selos que ficam logo abaixo do preço. Curtos de propósito: eles
 * respondem as objeções que travam o clique (vou ficar sozinho? demora? e se
 * não gostar?), e frase comprida ali vira parede de texto que ninguém lê.
 */
export const GARANTIAS = [
  { titulo: "Acesso imediato", sub: "Libera assim que o pagamento cai" },
  { titulo: "Suporte 24h", sub: "Chat e WhatsApp, todo dia" },
  { titulo: "Grupo exclusivo", sub: "Comunidade só de assinantes" },
  { titulo: "Experimente sem riscos", sub: "7 dias pra pedir reembolso" },
];
