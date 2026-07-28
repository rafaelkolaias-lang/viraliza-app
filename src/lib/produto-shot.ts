import "server-only";

/**
 * Monta o prompt do VÍDEO "avatar + produto" pro Grok. Aprendizado na prática:
 * prompt CURTO e direto (em português) funciona muito melhor que um JSON gigante.
 * A pessoa anexa no Grok o retrato do avatar + a foto do produto; este texto só
 * dá a direção: mesma pessoa, produto idêntico, num cenário de casa real, mostrar
 * e anunciar falando em português do Brasil, com um final (CTA) claro.
 */

// como o produto aparece (frase curta em pt por tipo de apresentação)
const ACAO: Record<string, string> = {
  mao: "segurando o produto na palma da mão aberta, mostrando pra câmera",
  corpo: "vestindo o produto",
  pes: "usando o produto nos pés, em pé numa pose natural",
  rosto: "usando o produto no rosto",
  pulso: "com o produto no pulso, mostrando pra câmera",
  lado: "ao lado do produto (ele apoiado numa superfície), apresentando ele",
};

// cenário de casa real (frase curta em pt por chave). É no VÍDEO que o cenário
// entra (não no retrato do avatar), reforçando o ambiente de casa de verdade.
const CENARIO: Record<string, string> = {
  sala: "numa sala de casa de classe média, aconchegante",
  sala_tijolo: "numa casa simples, com parede de tijolo à vista ao fundo",
  cozinha: "numa cozinha de casa comum",
  quarto: "num quarto aconchegante",
  quintal: "no quintal de casa, ao ar livre com luz natural",
  penteadeira: "num cantinho com penteadeira e espelho",
};

export function montarPromptProduto(opts: {
  apresentacao: string;
  gerarClose: boolean;
  produtoNome?: string;
  titulo?: string;
  duracaoSeg?: number;
  cenario?: string;
  temRefCenario?: boolean;
  comFala?: boolean;
}): string {
  const dur = opts.duracaoSeg === 10 ? 10 : opts.duracaoSeg === 15 ? 15 : 6;
  const comFala = opts.comFala !== false; // padrão: com fala
  const acao = ACAO[opts.apresentacao] ?? ACAO.mao;
  const prod = (opts.produtoNome ?? "").trim();
  const linhaProduto = prod ? ` O produto é: ${prod}.` : "";
  const tit = (opts.titulo ?? "").trim();
  const close = opts.gerarClose ? " Dá um close rápido no produto no meio do vídeo." : "";
  const cen = opts.cenario ? CENARIO[opts.cenario] : "";
  const ondeGrava = cen ? ` Grave ${cen}.` : "";
  // quando anexamos a foto do cenário, avisa que ela é só o ambiente (não produto)
  const refCenario = opts.temRefCenario
    ? " A última foto anexada é só a referência do CENÁRIO (o ambiente da casa): use como o lugar/fundo da cena, nunca como produto."
    : "";

  const abertura = `Vídeo vertical 9:16 de cerca de ${dur} segundos, estilo UGC gravado no celular: natural, em casa, sem cara de estúdio e sem cara de IA.${ondeGrava}`;
  const pessoa = `Use a MESMA pessoa da foto de referência (mesmo rosto, cabelo e pele), ${acao}. O produto tem que ser IDÊNTICO ao das fotos: mesma cor, forma, material e marca, sem inventar nada.${linhaProduto}`;

  if (!comFala) {
    // SEM FALA: nada de voz nem boca mexendo; só mostra e valoriza o produto (a
    // pessoa põe voz/texto por cima depois). É o modo bom pros vídeos curtos.
    return [
      abertura,
      pessoa,
      `SEM FALA: a pessoa NÃO fala e NÃO mexe a boca como se estivesse falando. Ela só mostra e valoriza o produto com gestos naturais e expressões (sorriso, aprovação), num vídeo pronto pra colocar voz ou texto por cima depois.${close}`,
      `Movimentos suaves e naturais, sem áudio de voz, sem legendas na tela.${refCenario}`,
    ].join(" ");
  }

  // COM FALA: a avatar anuncia falando em pt-BR (o título entra na fala).
  const nomeFala = tit ? ` Na fala, ela cita o nome do produto de forma natural: "${tit}".` : "";
  return [
    abertura,
    pessoa,
    `Faça ela mostrar o produto e anunciar, falando SÓ em português do Brasil (sem misturar nenhuma palavra em inglês), de forma natural e animada, como uma influenciadora. Comece com um gancho e termine com uma chamada rápida e clara pra comprar no link (tipo: corre lá, garante o seu).${nomeFala}${close}`,
    `Ela fala no ritmo natural dela, sem arrastar e sem robotizar.${refCenario}`,
    // uma linha só de propósito: no campo do Grok, quebra de linha (Enter) ENVIA
    // o prompt antes da hora. Junta com espaço pra digitar tudo de uma vez.
  ].join(" ");
}

/**
 * Prompt do vídeo quando mandamos UMA imagem só: a foto do avatar que JÁ está
 * com o produto na mão/vestido, no cenário dela. O Grok só ANIMA essa imagem (não
 * precisa juntar produto/cenário separados). É o modo do vídeo de 15s. `comFala`
 * decide se ela fala ou não; `titulo` é o nome que ela cita.
 */
export function montarPromptAvatarPronto(opts: {
  titulo?: string;
  duracaoSeg?: number;
  comFala?: boolean;
}): string {
  const dur = opts.duracaoSeg === 6 ? 6 : opts.duracaoSeg === 10 ? 10 : 15;
  const comFala = opts.comFala !== false;
  const tit = (opts.titulo ?? "").trim();

  const base =
    `Vídeo vertical 9:16 de cerca de ${dur} segundos, estilo UGC gravado no celular: natural, em casa, sem cara de estúdio e sem cara de IA. ` +
    `Anime a pessoa DESTA foto: ela já está com o produto na mão/no corpo, no cenário da própria imagem. Mantenha EXATAMENTE a mesma pessoa, o mesmo produto e o mesmo cenário da foto, sem inventar nem adicionar objetos novos. Movimentos naturais e leves.`;

  if (!comFala) {
    return [
      base,
      "SEM FALA: a pessoa NÃO fala e NÃO mexe a boca como se estivesse falando. Ela só mostra e valoriza o produto com gestos naturais e expressões (sorriso, aprovação), num vídeo pronto pra colocar voz ou texto por cima depois. Sem áudio de voz, sem legendas na tela.",
    ].join(" ");
  }

  const nomeFala = tit ? ` Ela cita o nome do produto de forma natural: "${tit}".` : "";
  return [
    base,
    `Faça ela apresentar e anunciar o produto, falando SÓ em português do Brasil (sem misturar inglês), de forma natural e animada, como uma influenciadora. Comece com um gancho e termine com uma chamada rápida pra comprar no link (tipo: corre lá, garante o seu).${nomeFala} Ela fala no ritmo natural dela, sem robotizar.`,
  ].join(" ");
}
