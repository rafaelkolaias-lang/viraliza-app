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
 * usa pra cobrar. `garantiaDias` chega de fora porque mora em `lib/niveis.ts`,
 * que é server-only; quem passa é o layout do painel.
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

export function respostasProntas(garantiaDias: number): Pronta[] {
  return [
    {
      pergunta: "Comprei crédito e só entrou uma parte",
      resposta:
        "Hoje toda compra cai 100% no saldo na hora da confirmação do pagamento.\n\n" +
        `Se a sua compra foi antiga e aparece um "crédito liberando" com data, é o resto da regra antiga de garantia de ${garantiaDias} dias: ele cai sozinho na data mostrada, sem precisar pedir. Pelos botões abaixo você confere o saldo e o extrato.`,
      links: [
        { rota: "/painel/creditos", nome: "Créditos" },
        { rota: "/painel/extrato", nome: "Extrato" },
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
