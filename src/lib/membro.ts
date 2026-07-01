export type EbookSecao = { titulo: string; paragrafos: string[] };
export type EbookCta = { label: string; href: string };

export type Ebook = {
  slug: string;
  titulo: string;
  descricao: string;
  cover: string;
  youtubeId: string;
  secoes: EbookSecao[];
  ctas?: EbookCta[];
};

export const EBOOKS: Ebook[] = [
  {
    slug: "vender-na-shopee-do-zero",
    titulo: "Vender na Shopee do Zero",
    descricao:
      "O caminho completo pra sair do zero e fazer suas primeiras vendas como afiliado Shopee - usando a plataforma a seu favor.",
    cover: "/capas/vendernashope.png",
    youtubeId: "hYexKTMSrDw",
    secoes: [
      {
        titulo: "1. Comece pelo produto certo",
        paragrafos: [
          "O erro nº1 de quem começa é escolher um produto que ninguém quer. A regra é simples: não invente, copie o que JÁ está vendendo.",
          "Na aba Produtos virais (Shopee) você tem uma vitrine de produtos que já estão bombando, com o link pronto. Escolha um nicho, pegue um produto quente e comece por ele.",
        ],
      },
      {
        titulo: "2. Transforme o produto em vídeo",
        paragrafos: [
          "Produto bom sem vídeo não vende. Você precisa de um vídeo curto, com gancho e legenda que chama atenção.",
          "Use o Editor automático: você joga as fotos/clipes do produto, a IA escreve a copy e monta o vídeo 9:16 pronto pra postar. E olhe a aba Vídeos virais Shopee pra se inspirar no que está dando certo.",
        ],
      },
      {
        titulo: "3. Poste com constância",
        paragrafos: [
          "Quem posta 1 vez por semana não cresce. O jogo é volume + constância: poste todo dia, em TikTok, Reels e Kwai.",
          "Repita o formato dos vídeos que viralizaram. Constância vence talento - em 30 dias postando todo dia você aprende mais que em 6 meses 'planejando'.",
        ],
      },
      {
        titulo: "4. Dobre o que funciona",
        paragrafos: [
          "Quando um vídeo estourar, NÃO pare. Faça 5 variações do mesmo. O algoritmo já gostou - explore até esgotar.",
          "Acompanhe quais produtos convertem e foque neles. Menos produtos, mais vídeos por produto.",
        ],
      },
    ],
    ctas: [
      { label: "Ver Produtos virais", href: "/painel/produtos" },
      { label: "Criar um vídeo agora", href: "/painel/novo" },
    ],
  },
  {
    slug: "videos-virais-que-vendem",
    titulo: "Vídeos Virais que Vendem",
    descricao:
      "A anatomia de um vídeo que prende, viraliza e converte - e como montar um em minutos sem aparecer.",
    cover: "/capas/videoviraisquevendem.png",
    youtubeId: "Y_MkjGjuphk",
    secoes: [
      {
        titulo: "1. Os 3 primeiros segundos decidem tudo",
        paragrafos: [
          "Se você não fisgar nos primeiros 3 segundos, perdeu. O gancho (visual + frase) é 80% do resultado.",
          "Comece com movimento, um problema ou uma promessa forte. Nada de introdução - vá direto pro que interessa.",
        ],
      },
      {
        titulo: "2. Não comece do zero",
        paragrafos: [
          "Criar do nada é lento. Use referência. No Acervo de cortes você tem +18 mil cortes virais por categoria (memes, futebol, desenhos, motivacional...) pra usar de base, remix e inspiração.",
          "Estude o ritmo dos cortes que já bombaram e replique a estrutura no seu produto.",
        ],
      },
      {
        titulo: "3. Monte rápido com IA",
        paragrafos: [
          "Velocidade é vantagem. No Editor automático você monta o vídeo, corta os clipes, escolhe a posição da legenda e a IA escreve a copy - tudo em minutos.",
          "Quanto mais rápido você produz, mais testa. Mais testes = mais chances de viralizar.",
        ],
      },
      {
        titulo: "4. Legenda que converte",
        paragrafos: [
          "O vídeo prende, a legenda vende. Use ganchos na legenda e um CTA claro (ex: 'link na bio', 'corre que acaba').",
          "Veja o ebook Ganchos que Prendem pra dominar essa parte.",
        ],
      },
    ],
    ctas: [
      { label: "Explorar o Acervo de cortes", href: "/painel/acervo" },
      { label: "Criar um vídeo agora", href: "/painel/novo" },
    ],
  },
  {
    slug: "ganchos-que-prendem",
    titulo: "Copy & Ganchos Matadores",
    descricao:
      "As fórmulas de gancho e copy que fazem o dedo parar de rolar - e como deixar a IA escrever por você.",
    cover: "/capas/ganchosqueprendem.png",
    youtubeId: "eNTT3mOFArk",
    secoes: [
      {
        titulo: "1. O gancho é tudo",
        paragrafos: [
          "Sem gancho não tem alcance. O gancho é a primeira frase/imagem que segura a pessoa. É a parte mais importante de qualquer vídeo.",
          "Pense sempre: 'por que alguém pararia pra ver isso?'. A resposta é o seu gancho.",
        ],
      },
      {
        titulo: "2. Fórmulas que funcionam",
        paragrafos: [
          "Curiosidade: 'Você está usando isso errado...'. Dor: 'Cansado de gastar à toa com...?'. Prova: 'Vendi X em Y dias com esse produto'. Polêmica: 'Pare de comprar Z, faça isso'.",
          "Tenha um banco de ganchos. Adapte os que já funcionaram pro seu produto - não precisa inventar.",
        ],
      },
      {
        titulo: "3. Deixe a IA escrever",
        paragrafos: [
          "No Editor automático, a IA gera a copy e a legenda no tom que você escolher (agressivo, equilibrado ou tranquilo), já com gancho e CTA.",
          "Gere 2 ou 3 variações e teste qual prende mais. Copy é teste, não adivinhação.",
        ],
      },
      {
        titulo: "4. Hashtags e chamada final",
        paragrafos: [
          "Feche sempre com um CTA: 'link na bio', 'comenta EU QUERO'. E use hashtags do nicho pra o algoritmo entender pra quem entregar.",
        ],
      },
    ],
    ctas: [{ label: "Gerar copy no Editor", href: "/painel/novo" }],
  },
  {
    slug: "afiliado-shopee-escala",
    titulo: "Afiliado Shopee: Escala",
    descricao:
      "Como sair de alguns vídeos por semana pra uma operação que roda em escala - com prospecção e reaproveitamento.",
    cover: "/capas/afiliadoshopee.png",
    youtubeId: "tY7pLCxOlsM",
    secoes: [
      {
        titulo: "1. De 1 vídeo a 100",
        paragrafos: [
          "Escala é matemática: mais vídeos no ar = mais chances de venda. Crie um processo: escolher produto, montar vídeo, postar, repetir.",
          "Use o Editor pra produzir em série e o Acervo de cortes pra ter material infinito. O gargalo deixa de ser ideia e vira só execução.",
        ],
      },
      {
        titulo: "2. Ache parceiros e clientes com o MapsLeads",
        paragrafos: [
          "Quer vender serviço de vídeo ou fechar parcerias locais? Use o MapsLeads: busque empresas por cidade e nicho, com telefone, Instagram e até uma mensagem de abordagem pronta.",
          "É prospecção em escala: garimpe leads quentes (quem não tem site/poucas avaliações) e ofereça seu trabalho.",
        ],
      },
      {
        titulo: "3. Reaproveite tudo",
        paragrafos: [
          "Nada se perde. Um corte vira 5 vídeos com ganchos diferentes. Baixe em massa do Acervo e refaça com novas legendas.",
          "Conteúdo reaproveitado com cabeça é o que mantém o volume sem te queimar.",
        ],
      },
      {
        titulo: "4. Constância e números",
        paragrafos: [
          "Acompanhe o que converte e corte o que não dá retorno. Foque o tempo no que traz venda.",
          "Quem aguenta a constância por 90 dias quase sempre ganha. Escala é consistência aplicada.",
        ],
      },
    ],
    ctas: [
      { label: "Abrir o MapsLeads", href: "/painel/leads" },
      { label: "Ver o Acervo de cortes", href: "/painel/acervo" },
    ],
  },
];

export function getEbook(slug: string): Ebook | undefined {
  return EBOOKS.find((e) => e.slug === slug);
}
