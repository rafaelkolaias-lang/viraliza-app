import { CUSTO_IMAGEM_LAB, CUSTO_PROMPT_LAB, custoVideoLab } from "@/lib/lab-custos";
import { CUSTO_AVATAR } from "@/lib/avatar-modelo";
import type { LinkTela } from "@/lib/suporte-conversas";

/**
 * As 4 perguntas sugeridas do chat de suporte, com resposta ESCRITA À MÃO.
 *
 * Por que não deixar o modelo responder também estas: são as dúvidas mais
 * comuns e as mais caras de errar (dinheiro e preço). Resposta pronta é
 * instantânea, sempre igual e nunca inventa número. O modelo continua cuidando
 * de tudo que a pessoa digitar por conta própria.
 *
 * Os preços NÃO são escritos na mão: vêm das mesmas constantes que a plataforma
 * usa pra cobrar. `creditoMensal` chega de fora porque mora em `lib/creditos.ts`,
 * que é server-only; quem passa é o layout do painel.
 *
 * O atalho "Comprei crédito e só entrou uma parte" saiu daqui em 13/08/2026: ele
 * ocupava a primeira vaga pra explicar a quarentena de crédito, que morreu em
 * 11/08/2026 (ver `creditarCompra`, que credita integral). Entrou no lugar a
 * dúvida que o modelo 2 em 1 realmente gera, e que a base do robô já marca como
 * "a mais comum".
 *
 * As linhas em branco são o que separa os balões (ver `partirResposta`).
 *
 * Toda resposta que tem botão CITA o botão na frase, igual à regra imposta ao
 * modelo: botão que aparece sem ninguém chamar polui a conversa.
 */

export type Pronta = {
  pergunta: string;
  resposta: string;
  links: LinkTela[];
};

export function respostasProntas(creditoMensal: number): Pronta[] {
  return [
    {
      pergunta: "Qual a diferença entre assinatura e crédito?",
      resposta:
        "São duas coisas separadas. A ASSINATURA libera a biblioteca: acervo de cortes, vídeos virais, produtos da Shopee e do TikTok, Minerador e área de membros. Ela vence e precisa renovar todo mês.\n\n" +
        `O CRÉDITO é o que paga cada imagem e cada vídeo que a IA gera. Assinando você já ganha ${creditoMensal.toLocaleString("pt-BR")} créditos na hora, e mais ${creditoMensal.toLocaleString("pt-BR")} a cada renovação paga. O que sobrar fica na conta e não vence. Pelos botões abaixo você vê sua assinatura e seu saldo.`,
      links: [
        { rota: "/painel/assinatura", nome: "Assinatura" },
        { rota: "/painel/creditos", nome: "Créditos" },
      ],
    },
    {
      pergunta: "Como faço meu primeiro vídeo?",
      resposta:
        "Comece pelo Viraliza Labs: ele vai te perguntando uma coisa de cada vez até o vídeo sair pronto.\n\n" +
        "Dica pro primeiro teste: use um dos influenciadores prontos da plataforma, que são de graça. Pelo botão abaixo você já abre o Labs.",
      links: [{ rota: "/painel/lab", nome: "Viraliza Labs" }],
    },
    {
      pergunta: "Quanto custa gerar um vídeo?",
      resposta:
        `Depende da duração: ${custoVideoLab("6s")} créditos com 6 segundos, ${custoVideoLab("10s")} com 10 e ${custoVideoLab("15s")} com 15. O preço é o mesmo com ou sem o influenciador falando.\n\n` +
        `A imagem da cena custa ${CUSTO_IMAGEM_LAB} créditos à parte. Os textos que a IA escreve dentro do funil (cena, fala, roteiro) são de graça; só o Gerador de prompt cobra, ${CUSTO_PROMPT_LAB} créditos. Pelo botão abaixo você vê seu saldo.`,
      links: [{ rota: "/painel/creditos", nome: "Créditos" }],
    },
    {
      pergunta: "Onde crio meu influenciador?",
      resposta:
        "No menu Personalize com IA, em Novo influenciador. Lá tem os três jeitos: do zero, a partir de uma foto real ou já segurando o seu produto.\n\n" +
        `Criar o influenciador com IA custa ${CUSTO_AVATAR} créditos. Se você já tem a foto da pessoa, enviar é de graça. Use os botões abaixo pra ir direto.`,
      links: [
        { rota: "/painel/meus-avatares/criar", nome: "Novo influenciador" },
        { rota: "/painel/meus-avatares", nome: "Galeria de avatares" },
      ],
    },
  ];
}
