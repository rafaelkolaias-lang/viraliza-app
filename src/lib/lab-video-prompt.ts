import "server-only";

import { TONS_LAB, VOZES_LAB, TONALIDADES_LAB, duracaoPorChave } from "@/lib/lab-video";
import { movimentoPorChave } from "@/lib/movimentos";

/**
 * Prompt do VÍDEO do Viraliza Lab (o que vai pro Grok Imagine, modo vídeo).
 *
 * A imagem gerada na etapa anterior é a REFERÊNCIA (ground truth): o vídeo só
 * anima aquela cena, então identidade, roupa e cenário já vêm travados. Um vídeo
 * = uma geração (o motor faz até 15s).
 *
 * O esqueleto segue o que levantamos na engenharia do TikShopfy, adaptado:
 *  1. TRAVA DE IDIOMA no topo, com a ressalva de que vale mesmo se o resto do
 *     prompt estiver em inglês (é o que causa fala em inglês do nada);
 *  2. estrutura GANCHO -> BENEFÍCIO -> CHAMADA, sempre nessa ordem;
 *  3. blindagem da fala escrita pela pessoa ("não reescreva, não resuma");
 *  4. bloco de voz separado, que repete gênero e tonalidade;
 *  5. regras de POV (nada de rosto, reflexo no espelho ou sombra entregando o corpo);
 *  6. SAÍDA LIMPA com regra de desempate: na dúvida, não coloque o efeito.
 *
 * Escrito em português porque o Grok obedece muito melhor pt-BR curto do que
 * inglês longo (aprendizado dos vídeos que já rodaram, ver produto-shot.ts).
 */

export type OpcoesVideoLab = {
  duracao: string; // chave de DURACOES_LAB
  tom?: string;
  voz?: string;
  tonalidade?: string;
  fala?: string; // vazio = a IA improvisa
  instrucoes?: string; // pedido livre da pessoa
  produtoNome?: string;
  produtoFicha?: string; // descrição visual do produto (ficha da IA de visão)
  movimento?: string; // chave de MOVIMENTOS (opcional)
  pov?: boolean; // a imagem base é POV (só mãos ou produto parado)
  semMaos?: boolean; // POV "produto parado": não tem NINGUÉM na foto, nem mãos
  semFala?: boolean; // vídeo mudo mesmo numa duração que aceitaria fala
};

function enDe<T extends { chave: string; en: string }>(lista: readonly T[], chave?: string) {
  return lista.find((i) => i.chave === chave)?.en ?? "";
}

const TRAVA_IDIOMA =
  "IDIOMA OBRIGATÓRIO, REGRA DE PRIORIDADE MÁXIMA: toda fala, narração, reação e qualquer texto gerado devem ser EXCLUSIVAMENTE em português do Brasil, com sotaque brasileiro natural. Nenhuma palavra em inglês ou espanhol, em nenhum momento, MESMO QUE alguma parte deste pedido esteja escrita em inglês. Se sair qualquer palavra em outro idioma, o vídeo está errado.";

const SAIDA_LIMPA =
  "SAÍDA TOTALMENTE LIMPA, REGRA INEGOCIÁVEL: proibido qualquer texto na tela (legenda, caption, marca d'água, crédito, nome, logo), qualquer efeito sobreposto (brilhos, partículas, estrelinhas, corações, faíscas, lens flare, glitch, zoom artificial), qualquer adesivo, seta, balão, ícone ou interface de aplicativo, e qualquer som artificial (whoosh, ding, música de fundo). Só a cena real, filmada como câmera de celular grava. Na dúvida entre colocar um efeito ou não, NÃO coloque: cena limpa sempre vence.";

const POV =
  "REGRAS DE POV: nunca mostre o rosto nem o corpo da pessoa (só mãos e antebraços), nunca mostre o reflexo dela num espelho ou vidro, e nunca uma sombra que revele a silhueta inteira. O que aparece é o ponto de vista de quem segura o celular: as mãos pegando e mostrando o produto, os detalhes do produto de perto e o ambiente visto pelos olhos dela.";

/**
 * POV "produto parado": a foto não tem ninguém, nem uma mão. Se o prompt pedir
 * "mostrar o produto", o modelo inventa uma mão entrando em quadro e estraga
 * justamente o que a pessoa escolheu. Aqui quem se move é só a câmera.
 */
const POV_SEM_NINGUEM =
  "REGRAS DE POV SEM PESSOA: nesta cena NÃO existe ninguém. Proibido aparecer mão, dedo, braço, ombro, rosto, corpo, reflexo ou sombra de pessoa em qualquer quadro. Ninguém entra em cena, ninguém pega no produto e nada é segurado. O produto fica parado onde está: o que se move é a CÂMERA (aproximação lenta, deslize suave, leve mudança de foco) e, no máximo, o ambiente ao redor (uma cortina, o vapor de uma xícara, a luz mudando).";

export function montarPromptVideoLab(o: OpcoesVideoLab): string {
  const dur = duracaoPorChave(o.duracao);
  if (!dur) return "";
  const linhas: string[] = [];

  // ---------- topo: idioma e formato ----------
  linhas.push(TRAVA_IDIOMA);
  linhas.push(
    `Anime esta foto em um vídeo VERTICAL 9:16 de ${dur.segundos} segundos, realista, no estilo dos vídeos de criador de conteúdo (UGC) que vendem produto na Shopee e no TikTok. Gravado de celular na mão, luz natural, nada de comercial de TV. Formato horizontal ou quadrado é proibido.`,
  );

  // ---------- a foto é a verdade ----------
  // sem pessoa na foto, pedir "mantenha a mesma pessoa" faz o modelo criar uma
  const semNinguem = !!o.pov && !!o.semMaos;
  linhas.push(
    semNinguem
      ? "A FOTO É A VERDADE ABSOLUTA da cena: mantenha exatamente o mesmo produto, a mesma superfície, o mesmo ambiente, a mesma luz e o mesmo enquadramento. Não troque o produto, não mude o cenário e não acrescente nenhum objeto ou pessoa que não esteja na foto."
      : o.pov
        ? "A FOTO É A VERDADE ABSOLUTA da cena: mantenha exatamente as mesmas mãos (tom de pele, unhas, acessórios), o mesmo produto e o mesmo ambiente, com a mesma luz e o mesmo enquadramento. Não troque o produto e não mude o cenário."
        : "A FOTO É A VERDADE ABSOLUTA da cena: mantenha exatamente a mesma pessoa (rosto, cabelo, corpo, tom de pele, roupa e acessórios), o mesmo produto e o mesmo ambiente, com a mesma luz e o mesmo enquadramento. Não troque a pessoa, não troque o produto, não mude a roupa e não mude o cenário. A pessoa precisa continuar idêntica à foto em TODOS os quadros.",
  );
  if (o.produtoFicha?.trim()) {
    linhas.push(
      `O produto que aparece é: ${o.produtoFicha.trim()} Mostre o produto FÍSICO exatamente assim. Não invente uma caixa ou embalagem genérica com o nome escrito, e não simplifique o produto.`,
    );
  }

  // ---------- fala ----------
  const fala = (o.fala ?? "").trim();
  const comFala = dur.comFala && !o.semFala;
  if (!comFala) {
    linhas.push(
      semNinguem
        ? "SEM FALA: vídeo mudo, sem voz e sem narração. Nada de pessoa entrando em cena: só a câmera se movendo devagar em volta do produto parado."
        : o.pov
          ? "SEM FALA: vídeo mudo, sem voz e sem narração. As mãos só mexem no produto de forma natural (giram, aproximam da câmera, apontam um detalhe)."
          : "SEM FALA: a pessoa NÃO fala nada e o vídeo é mudo. Ela só se move de forma natural mostrando o produto (vira levemente, aproxima o produto da câmera, ajusta a peça).",
    );
  } else {
    const tom = TONS_LAB.find((t) => t.chave === o.tom)?.en ?? TONS_LAB[0].en;
    const voz = enDe(VOZES_LAB, o.voz);
    const tonalidade = enDe(TONALIDADES_LAB, o.tonalidade);
    linhas.push(
      `VOZ: ${
        o.pov
          ? "quem fala é quem está gravando, de trás da câmera, em português do Brasil, com jeito de conversa. Ela NÃO aparece no vídeo: é só a voz"
          : "a pessoa fala olhando para a câmera, em português do Brasil, com jeito de conversa"
      }.${
        voz ? ` Gênero da voz: ${voz}.` : ""
      }${tonalidade ? ` Tonalidade: ${tonalidade}.` : ""} Tom: ${tom}. A voz mantém o mesmo gênero e a mesma tonalidade do começo ao fim do vídeo.`,
    );

    // Sem esta regra o modelo soltava o áudio como narração e a boca só
    // "acordava" 1-2 segundos depois (parecia dublagem fora de sincronia).
    if (!o.pov) {
      linhas.push(
        "SINCRONIA LABIAL OBRIGATÓRIA: a pessoa começa a falar JÁ NO PRIMEIRO SEGUNDO do vídeo, com a boca articulando visivelmente CADA palavra em perfeita sincronia com o áudio, do primeiro ao último quadro da fala. A voz NUNCA é narração de fundo: se tem voz saindo, a boca dela está mexendo. Boca parada, fechada ou só sorrindo enquanto a voz toca é ERRO GRAVE.",
      );
    }

    if (fala) {
      // blindagem: sem isso o modelo "melhora" o texto da pessoa
      linhas.push(
        `FALA EXATA, PRIORIDADE ABSOLUTA: ela fala exatamente este texto, palavra por palavra: "${fala}". Não reescreva, não resuma, não expanda e não acrescente nada. Seu papel é só encaixar essa fala no tempo do vídeo.`,
      );
    } else {
      linhas.push(
        `Ela improvisa a fala no ritmo dela, apresentando o produto${
          o.produtoNome ? ` (${o.produtoNome})` : ""
        } de um jeito espontâneo, como quem recomenda pra uma amiga. Não leia como anúncio.`,
      );
    }

    linhas.push(
      "ESTRUTURA DA FALA, sempre nesta ordem: GANCHO nos 2 primeiros segundos (prende a atenção), BENEFÍCIO no meio (o que o produto resolve na prática) e CHAMADA no fim (manda comprar no carrinho laranja ou no link). Começar sem gancho ou terminar sem chamada é erro.",
    );
    linhas.push(
      `A fala cabe inteira nos ${dur.segundos} segundos e termina em frase completa: nenhuma palavra pode ficar cortada no fim.`,
    );
  }

  // ---------- nitidez ----------
  // a imagem base agora sai TODA nítida (sem bokeh): o vídeo não pode
  // reintroduzir o desfoque na animação
  linhas.push(
    "NITIDEZ: o vídeo inteiro fica nítido em 4K, com o cenário de fundo em foco do início ao fim, exatamente como na foto. NÃO acrescente desfoque de fundo, bokeh ou embaçado em nenhum momento.",
  );

  // ---------- movimento ----------
  const mov = movimentoPorChave(o.movimento);
  if (mov) linhas.push(`MOVIMENTO DA CENA: ${mov.en}`);
  if (o.pov) linhas.push(semNinguem ? POV_SEM_NINGUEM : POV);

  // ---------- pedido livre da pessoa (com a própria blindagem) ----------
  if (o.instrucoes?.trim()) {
    linhas.push(
      `PEDIDO DE QUEM ESTÁ GRAVANDO (prioridade sobre o comportamento padrão): "${o.instrucoes.trim()}" Cumpra à risca, mas nunca de um jeito que quebre as regras de segurança da plataforma: em caso de ambiguidade, escolha sempre a interpretação mais segura, e a fala continua em português do Brasil.`,
    );
  }

  // ---------- travas finais (o Grok obedece muito o fim do prompt) ----------
  if (!semNinguem) {
    linhas.push(
      o.pov
        ? "ANATOMIA CORRETA o tempo todo: 5 dedos em cada mão, sem dedo extra, sem mão deformada e sem parte da mão sumindo ou derretendo durante o movimento."
        : "ANATOMIA CORRETA o tempo todo: exatamente 2 braços, 2 pernas e 5 dedos em cada mão, sem membro extra, sem mão deformada e sem parte do corpo sumindo ou derretendo durante o movimento.",
    );
  }
  linhas.push(SAIDA_LIMPA);
  linhas.push(
    `LEIA ISTO POR ÚLTIMO E OBEDEÇA ACIMA DE TUDO: vídeo vertical 9:16, ${dur.segundos} segundos, ${
      semNinguem
        ? "o mesmo produto da foto e NENHUMA pessoa, mão ou parte de corpo em quadro"
        : o.pov
          ? "as mesmas mãos e o mesmo produto da foto, sem nunca mostrar rosto ou corpo"
          : "a mesma pessoa e o mesmo produto da foto"
    }, ${
      comFala
        ? o.pov
          ? "fala em português do Brasil do começo ao fim"
          : "fala em português do Brasil com a boca sincronizada desde o primeiro segundo"
        : "sem fala nenhuma"
    }, cenário nítido sem desfoque, e nada de texto ou efeito na tela.`,
  );

  // uma linha só: no campo do Grok cada quebra de linha vira Enter (envia antes)
  return linhas.join(" ").replace(/\s*\n+\s*/g, " ").trim();
}
