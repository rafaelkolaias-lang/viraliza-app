import "server-only";

import {
  duracaoPorChave,
  TONS_LAB,
  VOZES_LAB,
  TONALIDADES_LAB,
} from "@/lib/lab-video";
import { movimentoPorChave } from "@/lib/movimentos";

/**
 * Prompt do VÍDEO do Viraliza Lab (o que vai pro Grok Imagine, modo vídeo).
 *
 * A imagem gerada na etapa anterior é a REFERÊNCIA (ground truth): o vídeo só
 * anima aquela cena, então identidade, roupa e cenário já vêm travados. Em vídeo
 * com vários TAKES, cada take é uma geração separada.
 *
 * Regras que vieram da análise de plataformas concorrentes e caíram bem aqui:
 *  1. estrutura fixa GANCHO -> CONTEXTO -> CHAMADA, distribuída entre os takes;
 *  2. take 1 é o vídeo PRINCIPAL, os outros são continuações (prompt mais curto,
 *     sem redefinir cena/produto, senão o modelo "recria" tudo e quebra a linha);
 *  3. nenhuma palavra pode ser cortada na virada do take: começa e termina frase
 *     completa (é o que faz parecer um corte de edição, e não outro vídeo);
 *  4. integridade anatômica (2 braços, 2 pernas, 5 dedos): o modelo erra muito
 *     mão quando a pessoa gesticula segurando produto;
 *  5. saída limpa: sem legenda, sem texto, sem efeito sonoro e sem música.
 *
 * Prompt em PORTUGUÊS de propósito: o Grok segue muito melhor pt-BR curto do que
 * inglês longo (aprendizado dos vídeos que já rodaram, ver produto-shot.ts).
 */

export type OpcoesVideoLab = {
  duracao: string; // chave de DURACOES_LAB
  tom?: string;
  voz?: string;
  tonalidade?: string;
  falas: string[]; // uma por take; vazio = a IA improvisa
  instrucoes?: string; // pedido livre da pessoa
  produtoNome?: string;
  produtoFicha?: string; // descrição visual do produto (ficha da IA de visão)
  movimento?: string; // chave de MOVIMENTOS (opcional)
};

function enDe<T extends { chave: string; en: string }>(lista: readonly T[], chave?: string) {
  return lista.find((i) => i.chave === chave)?.en ?? "";
}

/** Papel narrativo do take: gancho, contexto ou chamada. */
function papelDoTake(indice: number, total: number): string {
  if (total === 1) {
    return "Estrutura do vídeo: comece com um GANCHO que prende nos 2 primeiros segundos, depois mostre o CONTEXTO (o que o produto resolve) e termine com a CHAMADA pra comprar.";
  }
  if (indice === 0) {
    return "Papel deste take: GANCHO. Prende a atenção logo no primeiro segundo e já entra no assunto do produto.";
  }
  if (indice === total - 1) {
    return "Papel deste take: CHAMADA. Fecha o assunto e termina mandando a pessoa comprar (carrinho laranja ou link), com energia no final.";
  }
  return "Papel deste take: CONTEXTO. Desenvolve o que o produto resolve e a experiência de usar, sem repetir o que já foi dito.";
}

/** Monta o prompt de UM take. `indice` é 0-based. */
export function montarPromptVideoTake(o: OpcoesVideoLab, indice: number): string {
  const dur = duracaoPorChave(o.duracao);
  if (!dur) return "";
  const total = dur.takes;
  const continuacao = total > 1 && indice > 0;
  const linhas: string[] = [];

  // ---------- base (o take 1 e o vídeo de take único levam tudo) ----------
  if (!continuacao) {
    linhas.push(
      "Anime esta foto em um vídeo vertical 9:16 realista, no estilo dos vídeos de criador de conteúdo (UGC) que vendem produto na Shopee e no TikTok. Gravado de celular na mão, luz natural, nada de comercial de TV.",
    );
    linhas.push(
      "A FOTO É A VERDADE ABSOLUTA da cena: mantenha exatamente a mesma pessoa (rosto, cabelo, corpo, tom de pele, roupa e acessórios), o mesmo produto e o mesmo ambiente, com a mesma luz e o mesmo enquadramento. Não troque a pessoa, não troque o produto, não mude a roupa e não mude o cenário.",
    );
    if (o.produtoFicha?.trim()) {
      linhas.push(`O produto que aparece é: ${o.produtoFicha.trim()}`);
    }
  } else {
    // Continuação: prompt curto de propósito. Repetir tudo faz o modelo recriar a
    // cena e o vídeo vira "outro vídeo".
    linhas.push(
      `Continue o MESMO vídeo desta foto: este é o TAKE ${indice + 1} de ${total}, gravado na sequência, no mesmo lugar, na mesma hora, com a mesma pessoa, mesma roupa, mesmo penteado, mesma luz e mesmo enquadramento do take anterior. Não recrie a cena, não mude nada do visual: é um corte de edição do mesmo vídeo.`,
    );
  }

  // ---------- fala ----------
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

    const fala = (o.falas[indice] ?? "").trim();
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

    linhas.push(papelDoTake(indice, total));

    // regra de ouro dos takes: nada de palavra cortada na virada
    if (total > 1) {
      const anterior = (o.falas[indice - 1] ?? "").trim();
      linhas.push(
        `A fala deste take começa e termina com FRASE COMPLETA, cabendo inteira nos ${dur.segundos} segundos: nenhuma palavra pode ficar cortada no fim nem começar pela metade.`,
      );
      if (indice === 0) {
        linhas.push(
          "Termine no meio do assunto, deixando gancho pro próximo take: sem despedida e sem encerrar.",
        );
      } else {
        linhas.push(
          `Comece já falando, sem cumprimentar de novo e sem se apresentar${
            anterior ? ` (o take anterior terminou dizendo: "${anterior}")` : ""
          }.`,
        );
      }
    }
  }

  const mov = movimentoPorChave(o.movimento);
  if (mov) linhas.push(`Movimento da cena: ${mov.en}`);

  if (o.instrucoes?.trim()) {
    linhas.push(`Pedido de quem está gravando: ${o.instrucoes.trim()}`);
  }

  // ---------- travas finais (o Grok obedece muito o fim do prompt) ----------
  if (!continuacao) {
    linhas.push(
      "Anatomia correta o tempo todo: exatamente 2 braços, 2 pernas e 5 dedos em cada mão, sem membro extra, sem mão deformada e sem parte do corpo sumindo ou derretendo durante o movimento.",
    );
  }
  linhas.push(
    "Vídeo LIMPO: sem legenda, sem texto na tela, sem logo, sem marca d'água, sem música e sem efeito sonoro. Só a voz dela e o som natural do ambiente.",
  );
  linhas.push("Formato vertical 9:16, imagem realista de celular.");

  // uma linha só: no campo do Grok cada quebra de linha vira Enter (envia antes)
  return linhas.join(" ").replace(/\s*\n+\s*/g, " ").trim();
}

/** Todos os prompts do vídeo, na ordem dos takes. */
export function montarPromptsVideoLab(o: OpcoesVideoLab): string[] {
  const dur = duracaoPorChave(o.duracao);
  if (!dur) return [];
  return Array.from({ length: dur.takes }, (_, i) => montarPromptVideoTake(o, i));
}
