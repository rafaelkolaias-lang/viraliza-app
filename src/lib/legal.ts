/**
 * Dados e versões dos documentos legais (/termos, /privacidade, /reembolso).
 *
 * Ficam TODOS aqui de propósito: os três documentos repetem os mesmos campos
 * (razão social, CNPJ, e-mail de contato) e documento legal divergindo de
 * documento legal é o pior tipo de erro pra ter. Mudou aqui, mudou nos três.
 *
 * PENDENTE: enquanto razão social ou CNPJ estiver como PENDENTE, as três páginas
 * mostram um aviso vermelho no topo e NÃO devem ir pro ar. Preencher aqui remove
 * o aviso das três de uma vez.
 *
 * ENDEREÇO: não existe mais neste arquivo, por decisão do dono (13/08/2026). Os
 * documentos identificam a empresa por razão social e CNPJ, e o canal de contato
 * é o e-mail abaixo mais o WhatsApp oficial. Quem quiser o endereço da sede acha
 * pelo CNPJ. Se um dia for pra voltar, o campo entra aqui e nos três documentos
 * ao mesmo tempo, nunca em um só.
 */

export const PENDENTE = "PENDENTE";

/** Sem `as const` de propósito: com os campos travados no valor exato, o
 *  TypeScript passa a considerar a comparação com PENDENTE aqui embaixo como
 *  impossível e recusa o build assim que alguém preenche um dos dados. */
type DadosEmpresa = {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  email: string;
};

export const EMPRESA: DadosEmpresa = {
  nome: "Viraliza",
  razaoSocial: "RK Producoes Digitais LTDA",
  cnpj: "32.868.571/0001-39",
  email: "oficialonossouniverso@gmail.com",
};

/** true enquanto faltar qualquer dado de identificação da empresa. */
export const dadosDaEmpresaPendentes =
  EMPRESA.razaoSocial === PENDENTE || EMPRESA.cnpj === PENDENTE;

/**
 * Versão de cada documento. É o que o aceite do usuário grava junto da data:
 * sem a versão você prova que a pessoa aceitou alguma coisa, mas não o quê.
 * Mudou o texto de um documento de um jeito que muda direito ou obrigação,
 * suba a versão dele e a data abaixo.
 */
export const VERSAO_TERMOS = "1.1";
export const VERSAO_PRIVACIDADE = "2.1";
export const VERSAO_REEMBOLSO = "1.1";

export const ATUALIZADO_EM = "13 de agosto de 2026";

/** Prazo de arrependimento (art. 49 do CDC). */
export const REEMBOLSO_PRAZO_DIAS = 7;

/*
 * REMOVIDA em 13/08/2026: `CREDITO_VALIDADE_DIAS` (90 dias).
 *
 * Os documentos prometiam que cada pacote de crédito expirava em 90 dias, e isso
 * NUNCA existiu em código: o saldo é um número só (`User.saldoCentavos`), sem
 * pacote e sem data, e crédito nenhum vence. Ou seja, o documento avisava de uma
 * regra contra o cliente que a plataforma não aplicava, e ainda contradizia a
 * Central de Ajuda e o robô de suporte, que dizem "crédito não vence".
 *
 * Decisão do dono: documento diz o que o sistema faz. Se um dia o vencimento for
 * implementado de verdade, o texto volta pros Termos e pra Política de Reembolso
 * JUNTO com a subida de versão dos dois documentos, nunca depois.
 */

/**
 * Teto de consumo que ainda admite devolução: acima disso não há reembolso.
 *
 * A devolução é sempre PROPORCIONAL ao crédito não usado (vale pra pacote e pra
 * assinatura), então quem abusa já não ganha nada: gastou 90%, receberia 10%.
 * O teto não existe pra punir, existe porque abaixo do resíduo dele a devolução
 * não paga o próprio custo de processar (taxa da processadora + atendimento).
 * É assim que ele está redigido na página, e é essa redação que o sustenta.
 *
 * ATENÇÃO: hoje essa regra é APLICADA NA MÃO por quem decide o reembolso no
 * painel da processadora. O código não calcula esse percentual sozinho nem faz
 * devolução parcial automática; ele só trata o DEPOIS do reembolso
 * (`src/lib/reembolsos.ts`). Se um dia virar automático, o número sai daqui.
 */
export const REEMBOLSO_CONSUMO_MAXIMO = 0.8;

export const REEMBOLSO_CONSUMO_MAXIMO_PCT = `${Math.round(
  REEMBOLSO_CONSUMO_MAXIMO * 100,
)}%`;

/** Os três documentos, na ordem em que aparecem na navegação de cada página. */
export const DOCUMENTOS = [
  { href: "/termos", titulo: "Termos de Uso" },
  { href: "/privacidade", titulo: "Política de Privacidade" },
  { href: "/reembolso", titulo: "Política de Reembolso" },
] as const;
