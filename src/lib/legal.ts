/**
 * Dados e versões dos documentos legais (/termos, /privacidade, /reembolso).
 *
 * Ficam TODOS aqui de propósito: os três documentos repetem os mesmos campos
 * (razão social, CNPJ, e-mail de contato) e documento legal divergindo de
 * documento legal é o pior tipo de erro pra ter. Mudou aqui, mudou nos três.
 *
 * PENDENTE: razão social, CNPJ e endereço ainda não foram informados. Enquanto
 * estiverem como PENDENTE, as três páginas mostram um aviso vermelho no topo e
 * NÃO devem ir pro ar. Preencher aqui remove o aviso das três de uma vez.
 */

export const PENDENTE = "PENDENTE" as const;

export const EMPRESA = {
  nome: "Viraliza",
  razaoSocial: PENDENTE,
  cnpj: PENDENTE,
  endereco: PENDENTE,
  email: "oficialonossouniverso@gmail.com",
} as const;

/** true enquanto faltar qualquer dado de identificação da empresa. */
export const dadosDaEmpresaPendentes =
  EMPRESA.razaoSocial === PENDENTE ||
  EMPRESA.cnpj === PENDENTE ||
  EMPRESA.endereco === PENDENTE;

/**
 * Versão de cada documento. É o que o aceite do usuário grava junto da data:
 * sem a versão você prova que a pessoa aceitou alguma coisa, mas não o quê.
 * Mudou o texto de um documento de um jeito que muda direito ou obrigação,
 * suba a versão dele e a data abaixo.
 */
export const VERSAO_TERMOS = "1.0";
export const VERSAO_PRIVACIDADE = "2.0";
export const VERSAO_REEMBOLSO = "1.0";

export const ATUALIZADO_EM = "6 de agosto de 2026";

/** Prazo de arrependimento (art. 49 do CDC). */
export const REEMBOLSO_PRAZO_DIAS = 7;

/**
 * Validade de cada pacote de crédito comprado (fora da assinatura).
 *
 * ATENÇÃO: isso está PROMETIDO nos documentos mas AINDA NÃO EXISTE em código.
 * O saldo hoje é um número só (`User.saldoCentavos`), sem pacote e sem data, e
 * crédito nenhum expira. A implementação é a tarefa 29 do `!executar.md`.
 * Enquanto ela não sair, o documento é mais generoso do que a realidade (o
 * crédito simplesmente não vence), então ninguém é prejudicado.
 */
export const CREDITO_VALIDADE_DIAS = 90;

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
