# Plano de Execução

> **Como usar:** Pendentes ficam no topo de cada seção do Claude correspondente. Concluídas ficam abaixo, in formato enxuto, ou seja, ao concluir, transforme a tarefa em formato enxuto e mova ela para a sessão de concluídas do Claude correspondente.

---

# Claude 1

## Tarefas Pendentes — Claude 1:

### 29. Validade de 90 dias por pacote de crédito, com gasto do mais velho pro mais novo

Solicitado pelo dono em 06/08/2026, anotado pelo Claude 1. **Status: PENDENTE.**

> **NOTA (Claude 1, 11/08/2026): deixada de fora DE PROPÓSITO nesta rodada.**
> Ela exige tabela nova no banco (migração só com autorização explícita do dono)
> e tem 3 decisões marcadas "DECIDIR COM O DONO" no texto abaixo (brinde expira?
> lote de migração expira? 90 dias contam da compra ou da liberação?). Sem as
> respostas, qualquer implementação seria chute. **Atenção: a reforma dos níveis
> (tarefa 35) DESATIVOU a liberação gradual**, então o item sobre
> `CreditoLiberacao` abaixo virou legado (compra nova cai 100% na hora) - a
> pergunta "conta da compra ou de quando cai" morreu sozinha: agora é a mesma
> data.

**O que o dono quer:** cada pacote de crédito comprado (fora da assinatura) vale
**90 dias** a partir da compra. O consumo sempre sai **do pacote mais velho pro
mais novo**: comprou um pacote no dia 1 e outro no dia 5, o do dia 1 é gasto
primeiro. Passados os 90 dias, o que sobrou daquele pacote expira.

**Isso NÃO existe hoje, e não é um ajuste: é estrutura nova.** O saldo do usuário
é **um número só** (`User.saldoCentavos`, um inteiro em centavos). Não existe
"pacote" em lugar nenhum do saldo, não existe data de validade e não dá pra saber
de qual compra saiu cada débito. O `CreditoTransacao` guarda o histórico, mas o
débito nunca aponta pra a compra que ele consumiu, então nem dá pra reconstruir
isso olhando o extrato antigo com segurança.

**Regra de ouro do projeto: isso mexe no banco.** Antes de rodar qualquer
migração, descrever a alteração e **pedir autorização explícita do dono**.

**Como deve funcionar:**

1. **Lotes de crédito (tabela nova).** Criar um modelo tipo `CreditoLote` com:
   dono, valor original, valor que ainda resta, origem (compra / brinde de
   assinatura / ajuste do admin), o pedido que originou (pra casar com reembolso),
   data de criação e **data de expiração** (null = não expira).
   - Pacote comprado: expira em criação + 90 dias.
   - **DECIDIR COM O DONO:** o crédito de brinde da assinatura expira também? O
     pedido dele foi explícito sobre "pacote de crédito usado FORA da
     assinatura", então o brinde provavelmente segue outra regra (não expirar, ou
     expirar no fim do mês). Não assumir: perguntar.

2. **Débito consome os lotes em ordem (FIFO).** Todo débito passa a percorrer os
   lotes do mais velho pro mais novo, abatendo até completar o valor. Um débito
   pode atravessar vários lotes.
   - Ordenar por **data de expiração** (o que vence antes sai antes) e, empatando,
     pela data de criação. Com validade igual pra todos dá no mesmo, e assim a
     regra continua certa se um dia existir pacote com validade diferente.
   - O `User.saldoCentavos` deve continuar existindo como **espelho** da soma dos
     lotes válidos. É ele que a plataforma inteira lê hoje (carteira, telas,
     workers): trocar todo mundo de uma vez é o caminho mais arriscado possível.
     Manter os dois em sincronia dentro da mesma transação.

3. **Expiração.** Rotina periódica que zera o que restou nos lotes vencidos e
   lança a saída no extrato com um tipo próprio (ex.: `expiracao`), pra o usuário
   ver o que aconteceu em vez de o saldo sumir sozinho.
   - O projeto já tem onde pendurar isso: o `src/instrumentation.ts` roda uma
     varredura de 10 em 10 minutos pra reembolso. Reaproveitar esse lugar.

4. **Avisar antes de expirar.** Notificação faltando 7 dias (a tabela
   `Notificacao` já existe). Crédito sumindo sem aviso é reclamação certa.

5. **Telas.** A `/painel/creditos` e o `/painel/extrato` precisam mostrar os
   pacotes com data de vencimento e quanto resta em cada um. Hoje as duas mostram
   só um número total.

**Cuidado com o que já existe e encosta nisso (não quebrar):**

- **`CreditoLiberacao`** (liberação escalonada por nível, 8 dias): é crédito
  comprado que ainda **não caiu** no saldo. Definir se os 90 dias contam da
  **compra** ou de **quando o crédito cai no saldo**. Contando da compra, quem é
  bronze perde dias de validade sem ter recebido o crédito. **Perguntar ao dono**,
  e a resposta mais justa provavelmente é contar de quando cai.
- **`src/lib/reembolsos.ts`**: hoje o reembolso perde o crédito de brinde e
  preserva o comprado. Com lotes isso fica mais fácil e mais correto (dá pra
  cancelar o lote exato do pedido reembolsado, pelo `orderId`), mas o caminho
  atual precisa continuar funcionando pros usuários antigos.
- **`dividaCentavos` e `quitarDivida`**: saldo devedor pós-reembolso. Conferir que
  a quitação passa a abater dos lotes na mesma ordem.
- **Usuários que já têm saldo hoje**: precisam de um lote inicial de migração com
  o saldo atual. **DECIDIR COM O DONO:** esse lote de migração expira em 90 dias a
  partir da migração, ou não expira? Fazer o saldo antigo de todo mundo começar a
  vencer sem aviso é o tipo de coisa que gera reclamação em massa.

**Já feito, não refazer:** os 90 dias **já estão escritos nas políticas**
(`/termos`, seção "Créditos", e `/reembolso`), lendo a constante
`CREDITO_VALIDADE_DIAS` de `src/lib/legal.ts`. Se o número mudar, muda lá e os
documentos acompanham. **Enquanto a tarefa não for feita, o documento promete uma
regra que o sistema não cumpre**, e nesse caso a promessa é mais generosa do que a
realidade (hoje o crédito não expira nunca), então ninguém sai prejudicado. Mesmo
assim, quanto antes, melhor.

---

## Tarefas Concluídas — Claude 1:

(nenhuma)

---

# Claude 2

## Tarefas Pendentes — Claude 2:

(nenhuma)

---

## Tarefas Concluídas — Claude 2:

(nenhuma)

---

# Claude 5

## Tarefas Pendentes - Claude 5:

(nenhuma)

---

## Tarefas Concluídas - Claude 5:

(nenhuma)

---

*Última atualização: 2026-08-11*
