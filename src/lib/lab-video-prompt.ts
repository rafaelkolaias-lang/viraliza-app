import "server-only";

import { TONS_LAB, VOZES_LAB, TONALIDADES_LAB, duracaoPorChave } from "@/lib/lab-video";
import { movimentoPorChave } from "@/lib/movimentos";

/**
 * Prompt do VÍDEO do Viraliza Lab (o que vai pro Grok Imagine, modo vídeo).
 *
 * ============================================================================
 * REESCRITO EM 06/ago/2026 depois do teste A/B (o B ganhou por larga margem).
 * ============================================================================
 *
 * A versão anterior tinha 742 palavras num vídeo de 10s com fala. Esta tem
 * cerca de 150. Três mudanças estruturais, cada uma com motivo:
 *
 * 1. A AÇÃO VEM PRIMEIRO. O motor do Grok (Aurora) renderiza do primeiro quadro
 *    em diante, e o que está nas primeiras 20 a 30 palavras é o que ele executa.
 *    Antes o movimento aparecia lá pela palavra 450, depois de idioma, fala,
 *    ritmo e nitidez: chegava tarde demais pra virar coreografia.
 *
 * 2. NADA DE NEGATIVA SOBRE COISA VISÍVEL. O Grok não tem campo de negative
 *    prompt (a API da xAI não expõe nenhum), então "sem membro extra" e "sem
 *    mão deformada" não viram proibição: viram menção, e o modelo pode
 *    materializar o que a gente listou. Em vez de contar braços, o prompt diz
 *    ONDE CADA MÃO ESTÁ e o que ela toca. Mão ancorada não vira mão inventada.
 *    Sobrou só negativa técnica (sem legenda, sem música), que não tem objeto
 *    visual pra ser plantado.
 *
 * 3. A TRAVA DE PRESERVAÇÃO FICA SOZINHA NO FIM. É a única coisa que ganha
 *    ficando no fim: restrição estática, não ação. E a foto já carrega pessoa,
 *    produto, roupa e cenário, então redescrever tudo isso no meio do prompt só
 *    roubava espaço da direção de movimento.
 *
 * Uma linha só no fim: no campo do Grok cada quebra de linha vira Enter e envia
 * o prompt antes da hora.
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

function rotulo<T extends { chave: string; label: string }>(
  lista: readonly T[],
  chave?: string,
) {
  return lista.find((i) => i.chave === chave)?.label.toLowerCase() ?? "";
}

/**
 * Quando a pessoa não escolhe movimento, o prompt ainda precisa abrir com uma
 * ação: sem ação nas primeiras palavras o Grok tende a segurar o quadro parado
 * (o default dele é ficar estático) e o vídeo sai como foto tremida.
 */
function acaoPadrao(semNinguem: boolean, pov?: boolean): string {
  if (semNinguem) {
    return "A câmera se aproxima devagar do produto, que fica parado onde está.";
  }
  if (pov) {
    return "As duas mãos seguram o produto e giram ele devagar, mostrando a frente e depois a lateral.";
  }
  return "Ela se move com naturalidade diante da câmera, mostrando o produto, com o peso trocando de leve de uma perna pra outra.";
}

export function montarPromptVideoLab(o: OpcoesVideoLab): string {
  const dur = duracaoPorChave(o.duracao);
  if (!dur) return "";

  const semNinguem = !!o.pov && !!o.semMaos;
  const comFala = dur.comFala && !o.semFala;
  const fala = (o.fala ?? "").trim();
  const partes: string[] = [];

  // ---------- 1. abertura: formato e AÇÃO, nessa ordem ----------
  // É o trecho de maior peso do prompt inteiro. Tudo que não for movimento fica
  // pra depois, de propósito.
  // O cabeçalho do POV NÃO afirma mais "aparecem as mãos": quem manda no
  // enquadramento é a direção do movimento. Com a afirmação fixa, o card
  // "olhando pros pés" (que pede os braços FORA do quadro) entrava em
  // contradição com o próprio prompt, duas frases depois.
  const cabecalho = semNinguem
    ? `Vídeo vertical 9:16, ${dur.segundos} segundos, filmado de celular, sem ninguém em cena: só o produto.`
    : o.pov
      ? `Vídeo vertical 9:16, ${dur.segundos} segundos, filmado de celular em POV, no ponto de vista de quem está gravando.`
      : `Vídeo vertical 9:16, ${dur.segundos} segundos, filmado de celular na mão.`;

  const mov = movimentoPorChave(o.movimento);
  partes.push(`${cabecalho} ${mov ? mov.direcao : acaoPadrao(semNinguem, o.pov)}`);

  // ---------- 2. o gesto tem tamanho, e o vídeo pode ser maior que ele ----------
  // Em 10s e 15s sobra tempo depois do gesto. Sem essa frase o modelo arrasta em
  // câmera lenta ou inventa um segundo gesto (que é de onde saía o braço extra).
  if (dur.segundos > 6) {
    partes.push(
      semNinguem
        ? "Terminado o movimento, a câmera fica parada no enquadramento final."
        : "Terminado o gesto, ela só permanece em cena, respirando e piscando.",
    );
  }

  // ---------- 3. realismo de celular ----------
  // Câmera estabilizada demais é, ela mesma, um sinal de vídeo de IA.
  partes.push("Câmera na mão, com leve tremor natural, luz do ambiente.");

  // ---------- 4. fala ----------
  if (!comFala) {
    partes.push("Vídeo mudo, sem voz e sem narração.");
  } else {
    const voz = rotulo(VOZES_LAB, o.voz) || "feminina";
    const tonalidade = rotulo(TONALIDADES_LAB, o.tonalidade);
    const tom = rotulo(TONS_LAB, o.tom) || TONS_LAB[0].label.toLowerCase();
    const timbre = `voz ${voz} brasileira${tonalidade ? `, tonalidade ${tonalidade}` : ""}, tom ${tom}`;

    // A sincronia labial precisa vir junto do pedido de fala: quando vinha em
    // bloco separado, o áudio saía como narração e a boca acordava depois.
    const quemFala = o.pov
      ? `Quem fala é quem está gravando, de trás da câmera, sem aparecer em quadro, em português do Brasil, ${timbre}`
      : `Ela fala olhando pra lente, com a boca sincronizada desde o primeiro quadro, em português do Brasil, ${timbre}`;

    partes.push(
      fala
        ? `${quemFala}, dizendo exatamente isto: "${fala}"`
        : `${quemFala}, apresentando o produto${
            o.produtoNome ? ` (${o.produtoNome})` : ""
          } como quem recomenda pra uma amiga, com gancho no começo e chamada pra comprar no fim.`,
    );

    // NÃO cite o segundo em que a fala deve acabar. Já erramos isso duas vezes:
    // qualquer número vira META e o modelo estica a fala pra chegar nele, mesmo
    // quando a frase é curta. O que segura a fala dentro do tempo é o orçamento
    // de palavras (2,0 por segundo, em lab-video.ts), não um prazo no prompt.
    // Aqui só dizemos o ritmo e que sobrar silêncio é o resultado certo.
    partes.push(
      `Ritmo de conversa normal, sem esticar as palavras nem alongar as pausas. Ela termina de falar antes do fim do vídeo, com a última palavra inteira, e o tempo que sobrar ${
        o.pov ? "segue sem fala" : "fica só no olhar pra câmera"
      }.`,
    );
  }

  // ---------- 5. nitidez ----------
  partes.push("Imagem nítida em 4K, cenário de fundo em foco do início ao fim.");

  // ---------- 6. negativa técnica ----------
  // As únicas negativas que sobrevivem: não têm objeto visual pra ser plantado.
  partes.push("Sem legenda, sem texto na tela, sem logo e sem música.");

  // ---------- 7. pedido livre da pessoa ----------
  if (o.instrucoes?.trim()) {
    partes.push(`Pedido de quem está gravando, cumpra à risca: ${o.instrucoes.trim()}`);
  }

  // ---------- 8. trava de preservação, sozinha no fim ----------
  // Restrição estática é a única coisa que ganha ficando no fim do prompt.
  const preservar = semNinguem
    ? "o produto, a superfície e o cenário"
    : o.pov
      ? "as mãos, o produto e o cenário"
      : "o rosto, o cabelo, a roupa, o produto e o cenário";
  partes.push(
    `Mantenha idênticos à foto, em todos os quadros: ${preservar}.${
      o.produtoFicha?.trim() ? ` O produto é: ${o.produtoFicha.trim()}` : ""
    }`,
  );

  return partes.join(" ").replace(/\s*\n+\s*/g, " ").trim();
}
