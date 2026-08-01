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
 * Regras que vieram da análise de plataformas concorrentes e caíram bem aqui:
 *  1. estrutura fixa GANCHO -> BENEFÍCIO -> CHAMADA dentro do mesmo vídeo;
 *  2. a fala precisa caber inteira no tempo: frase completa, sem palavra cortada
 *     no fim (é o que separa um vídeo pronto de um pedaço solto);
 *  3. integridade anatômica (2 braços, 5 dedos): o modelo erra muito mão quando
 *     a pessoa gesticula segurando produto;
 *  4. saída limpa: sem legenda, sem texto, sem efeito sonoro e sem música.
 *
 * Prompt em PORTUGUÊS de propósito: o Grok segue muito melhor pt-BR curto do que
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
};

function enDe<T extends { chave: string; en: string }>(lista: readonly T[], chave?: string) {
  return lista.find((i) => i.chave === chave)?.en ?? "";
}

export function montarPromptVideoLab(o: OpcoesVideoLab): string {
  const dur = duracaoPorChave(o.duracao);
  if (!dur) return "";
  const linhas: string[] = [];

  linhas.push(
    "Anime esta foto em um vídeo vertical 9:16 realista, no estilo dos vídeos de criador de conteúdo (UGC) que vendem produto na Shopee e no TikTok. Gravado de celular na mão, luz natural, nada de comercial de TV.",
  );
  linhas.push(
    "A FOTO É A VERDADE ABSOLUTA da cena: mantenha exatamente a mesma pessoa (rosto, cabelo, corpo, tom de pele, roupa e acessórios), o mesmo produto e o mesmo ambiente, com a mesma luz e o mesmo enquadramento. Não troque a pessoa, não troque o produto, não mude a roupa e não mude o cenário.",
  );
  if (o.produtoFicha?.trim()) {
    linhas.push(`O produto que aparece é: ${o.produtoFicha.trim()}`);
  }

  // ---------- fala ----------
  const fala = (o.fala ?? "").trim();
  if (!dur.comFala) {
    linhas.push(
      "SEM FALA: a pessoa NÃO fala nada e o vídeo é mudo. Ela só se move de forma natural mostrando o produto (vira levemente, aproxima o produto da câmera, ajusta a peça).",
    );
  } else {
    const tom = TONS_LAB.find((t) => t.chave === o.tom)?.en ?? TONS_LAB[0].en;
    const voz = enDe(VOZES_LAB, o.voz);
    const tonalidade = enDe(TONALIDADES_LAB, o.tonalidade);
    linhas.push(
      `A pessoa FALA olhando para a câmera, SEMPRE em português do Brasil, com sotaque brasileiro natural e jeito de conversa: nenhuma palavra em inglês, em nenhum momento. Tom: ${tom}.${
        voz ? ` Voz: ${voz}.` : ""
      }${tonalidade ? ` Tonalidade: ${tonalidade}.` : ""}`,
    );

    if (fala) {
      linhas.push(
        `Ela fala EXATAMENTE este texto, palavra por palavra, sem reescrever, sem resumir e sem acrescentar nada: "${fala}"`,
      );
    } else {
      linhas.push(
        `Ela improvisa a fala no ritmo dela, apresentando o produto${
          o.produtoNome ? ` (${o.produtoNome})` : ""
        } de um jeito espontâneo, como quem recomenda pra uma amiga. Não leia como anúncio.`,
      );
    }

    linhas.push(
      "Estrutura da fala: comece com um GANCHO que prende nos 2 primeiros segundos, depois mostre o BENEFÍCIO (o que o produto resolve) e termine com a CHAMADA pra comprar (carrinho laranja ou link).",
    );
    linhas.push(
      `A fala cabe inteira nos ${dur.segundos} segundos e termina em frase completa: nenhuma palavra pode ficar cortada no fim.`,
    );
  }

  const mov = movimentoPorChave(o.movimento);
  if (mov) linhas.push(`Movimento da cena: ${mov.en}`);

  if (o.instrucoes?.trim()) {
    linhas.push(`Pedido de quem está gravando: ${o.instrucoes.trim()}`);
  }

  // ---------- travas finais (o Grok obedece muito o fim do prompt) ----------
  linhas.push(
    "Anatomia correta o tempo todo: exatamente 2 braços, 2 pernas e 5 dedos em cada mão, sem membro extra, sem mão deformada e sem parte do corpo sumindo ou derretendo durante o movimento.",
  );
  linhas.push(
    "Vídeo LIMPO: sem legenda, sem texto na tela, sem logo, sem marca d'água, sem música e sem efeito sonoro. Só a voz dela e o som natural do ambiente.",
  );
  linhas.push("Formato vertical 9:16, imagem realista de celular.");

  // uma linha só: no campo do Grok cada quebra de linha vira Enter (envia antes)
  return linhas.join(" ").replace(/\s*\n+\s*/g, " ").trim();
}
