# Bugs críticos descobertos — varredura colaborativa multi-IA

> **Como usar este arquivo:**
> - Múltiplas IAs estão varrendo a plataforma em paralelo procurando bugs e problema de segurança.
> - **Antes de adicionar um bug/problema**, faça `grep` aqui pra ver se já está documentado (mesmo arquivo/linha/sintoma).
> - **Critério "crítico":** mistura dados entre tenants, dado que deveria salvar e não salva, dado que deveria ser deletado e fica órfão, estados incoerentes, botões que não funcionam, falhas de segurança.
> - **Ignorar:** bugs já listados em `!executar.md` e os que estão como "concluído" aqui.
> - Cada bug deve descrever **QUANDO acontece** (linguagem leiga), arquivo/linha, severidade, e detalhe técnico opcional, e **qual o impacto** disso no usuário.
> - **Não corrigir nada** aqui — só catalogar pro humano testar e então pedir explicitamente depois para corrigir o bug.
> - **Status** Bugs achados devem colocar como pendente de correção e bugs arrumados colocar status concluido

---

## Convenção de severidade
> Cada um recebe uma nota onde nota 0 = indiferente não vai mudar nada pro usuario final nem pra segurança do sistema e 10 = Crítico ou muito grave para o sistema onde vai impedir o uso correto da plataforma.

- 🔴 **Crítico — Nota 9-10**
  Bugs que colocam o sistema, os dados ou os usuários em risco grave.  
  Inclui: vazamento ou mistura de dados entre tenants/usuários, falhas de segurança exploráveis, perda permanente de dados, arquivos/dados que deveriam ser excluídos e permanecem no banco/servidor, valores monetários incorretos, cobranças erradas, ações importantes que parecem funcionar mas não persistem, dados que somem do sistema, corrupção de dados ou qualquer falha que possa gerar prejuízo financeiro, jurídico ou de segurança.

- 🟠 **Alto — Nota 7-8**
  Bugs que quebram funcionalidades importantes em cenários comuns, mas sem causar vazamento grave, perda permanente de dados ou risco crítico imediato.  
  Inclui: botões ou fluxos principais que não funcionam, usuário impedido de concluir uma ação importante, dados exibidos de forma errada mas recuperável, permissões incorretas sem vazamento crítico, falhas frequentes em produção, erros que exigem intervenção manual, duplicação de registros, race conditions ativas com impacto real, ou bugs que afetam muitos usuários.

- 🟡 **Médio — Nota 5-6**
  Bugs que causam inconsistência, confusão ou falha parcial, mas possuem contorno simples e não impedem o uso principal do sistema.  
  Inclui: edge cases reproduzíveis, validações incompletas, mensagens de erro ruins, filtros/paginação/ordenação com falhas pontuais, dados temporariamente inconsistentes, problemas visuais que atrapalham um pouco, falhas que ocorrem apenas em combinações específicas de ações, ou comportamentos errados que não causam perda de dados, falha de segurança ou bloqueio do usuário.

- 🟢 **Baixo — Nota 0-4**
  Bugs pequenos, cosméticos ou de baixa prioridade, sem impacto relevante no usuário final, na segurança, nos dados ou no funcionamento principal do sistema.  
  Inclui: textos errados, desalinhamentos visuais leves, ícones incorretos, pequenos problemas de espaçamento, logs desnecessários, mensagens pouco claras mas não bloqueantes, inconsistências visuais raras ou melhorias que não afetam o uso real.

Regra geral:
A nota deve considerar o pior impacto realista do bug, não apenas o erro visível na tela.

Se envolver segurança, dinheiro, perda de dados, mistura de dados entre usuários/tenants ou falha de exclusão/persistência de dados sensíveis, a severidade deve subir automaticamente para Alto ou Crítico.

Se o bug tiver contorno simples, afetar poucos usuários e não envolver dados sensíveis, segurança ou dinheiro, a severidade pode ser reduzida.

---

## Bugs em catalogação:

### Pendente de correção:

#### 1. 🟡 (Nota 5) Cortes: a página do vídeo não atualiza sozinha na fase final
- **Quando acontece:** ao abrir um job de "Cortes de qualquer vídeo" que ainda está recebendo os cortes (fase de upload/streaming), a página para de atualizar sozinha; os cortes novos só aparecem apertando F5.
- **Onde:** `src/app/(app)/painel/videos/[id]/page.tsx:33-34`
- **Impacto:** usuário acha que travou ou que faltam cortes, quando só precisa recarregar.
- **Detalhe técnico:** a variável `processando` considera só `na_fila` e `renderizando`; falta o status `"processando"` (fase em que o worker sobe cada corte). O painel principal (`/painel/page.tsx`) já foi corrigido; essa página ficou.
- **Status:** pendente.

#### 3. 🟢 (Nota 2) Estúdio: prévia de voz continua tocando ao fechar o seletor
- **Quando acontece:** clica no play de uma voz e fecha o dropdown clicando fora - o áudio segue tocando até o fim.
- **Onde:** `src/components/app/seletor-voz.tsx`
- **Impacto:** pequena confusão sonora; sem impacto funcional.
- **Detalhe técnico:** o `pointerdown` de fora fecha o painel mas não pausa o `audioRef`.
- **Status:** pendente.

#### 6. 🔴 (Nota 9) Reembolso de pacote de crédito da Cakto aplica a regra errada: cliente fica com os créditos e perde a biblioteca
- **Quando acontece:** sempre que um pedido de PACOTE de crédito comprado na Cakto é reembolsado (pelo webhook ou pela varredura de 10 em 10 min). O sistema não reconhece o produto como pacote e trata como reembolso da plataforma: em vez de remover os créditos daquele pacote, remove os créditos de brinde, desliga a assinatura e tira o e-mail da lista que permite cadastro.
- **Onde:** `src/lib/reembolsos.ts:7` (importa o identificador de pacote da Kiwify) e `src/lib/reembolsos.ts:155`; chamado por `src/app/api/cakto/webhook/route.ts:72` e `src/lib/reembolsos.ts:355`.
- **Impacto:** prejuízo duplo. (a) Golpe: a pessoa compra pacote (ex.: R$100), pede reembolso, recebe o dinheiro de volta e os 10.000 créditos FICAM no saldo pra gastar em API; a parte presa na quarentena nem é cancelada (o cancelamento só roda no ramo de pacote) e libera normalmente no 8º dia. (b) Cliente honesto que reembolsa só um pacote perde biblioteca e brinde que não tinham relação com o pedido.
- **Detalhe técnico:** `aplicarReembolsoAceito` usa `creditosDoPacote` do `kiwify.ts` (regex `editor automatico N`), mas os pacotes da Cakto se chamam "Viraliza N Créditos" (regex própria em `cakto.ts:159`). Resultado: `creditosPacote` = 0 pra todo pedido Cakto e o fluxo sempre cai no ramo "reembolso da entrada"; `cancelarLiberacoesDoPedido` nunca roda.
- **Status:** pendente.

#### 7. 🔴 (Nota 9) Chargeback na Cakto é ignorado: quem contesta no cartão fica com créditos, biblioteca e login
- **Quando acontece:** o cliente contesta a compra no cartão e a Cakto marca o pedido como "chargedback". O webhook responde "ignorado", a varredura pula em silêncio e nada é aplicado: créditos continuam gastáveis, assinatura fica e o login NÃO é bloqueado (a regra de bloquear chargeback nunca dispara). O pedido também some do painel Finanças: não conta como venda nem como estorno.
- **Onde:** `src/lib/cakto.ts:184` (conjunto de estorno sem "chargedback"; o `pedidoChargeback` da linha 195 não é usado em lugar nenhum), `src/app/api/cakto/webhook/route.ts:71`, `src/lib/reembolsos.ts:351`, `src/lib/financas.ts:42-43`.
- **Impacto:** prejuízo direto: dinheiro devolvido no cartão + créditos seguem utilizáveis + conta segue ativa. Na Kiwify (legado) funcionava porque "chargedback" estava no conjunto de estorno (`kiwify.ts:81`); a migração pra Cakto perdeu isso.
- **Status:** pendente.

#### 8. 🟠 (Nota 7) Dá pra gastar mais crédito do que tem gerando vídeos em paralelo
- **Quando acontece:** a pessoa tem saldo pra UM vídeo e dispara vários ao mesmo tempo (nível Prata permite 2 simultâneos, Ouro 3). Cada pedido checa o saldo no início (todos veem o mesmo saldo) e a cobrança só acontece no fim; a cobrança nunca deixa o saldo negativo, então o primeiro débito consome o saldo e os demais cobram só o que sobrou (podendo ser 0).
- **Onde:** `src/app/api/lab/video/route.ts:80` e `:209`, `src/app/api/boost/video/route.ts:79` e `:180`, `src/app/api/avatar/video/route.ts:147` e `:293` (o comentário da linha 291 registra o comportamento: "se o saldo mudou, cobra o que der").
- **Impacto:** com 75 créditos e conta Ouro dá pra tirar 3 vídeos de 15s (225 créditos de valor) pagando 75. Repetível todo dia dentro do teto de vídeos; cada geração consome recurso real do motor de IA.
- **Detalhe técnico:** modelo pós-pago com `debitarClamp` (falha não cobra), mas sem reserva do valor na criação do job os débitos excedentes viram 0 em vez de virar dívida/bloqueio.
- **Status:** pendente.

#### 9. 🟠 (Nota 7) Carteira aceita "lost update": dois lançamentos no mesmo instante podem se atropelar
- **Quando acontece:** dois débitos/créditos do MESMO usuário no mesmo instante (ex.: dois vídeos ficam prontos juntos, ou o webhook credita na hora em que o bônus mensal cai). Cada lançamento lê o saldo, calcula o novo valor e grava o número absoluto; o segundo grava por cima do primeiro e o efeito de um deles some do saldo, embora o extrato registre os dois (com "saldo após" inconsistente).
- **Onde:** `src/lib/creditos.ts:121-145` (`lancar`) e `:203-228` (`debitarClamp`); `garantirCreditoMensal` (`:268-289`) tem o mesmo padrão e a re-checagem dentro da transação não segura duas execuções realmente simultâneas.
- **Impacto:** saldo diverge do extrato pra mais ou pra menos: dá pra perder débito (usuário sai ganhando) ou perder crédito (cliente sai perdendo e reclama).
- **Detalhe técnico:** read-then-write sem lock (SELECT sem FOR UPDATE e UPDATE com valor absoluto em REPEATABLE READ). Increment/decrement atômico ou update condicional resolve.
- **Status:** pendente.

#### 10. 🟡 (Nota 6) Conta congelada por reembolso volta a ter saldo quando a quarentena vence
- **Quando acontece:** a pessoa compra pacote (parte fica presa na quarentena de 8 dias), pede reembolso antes do 8º dia (saldo congelado) e espera: no 8º dia a varredura libera a parte presa DIRETO no saldo da conta suspensa, e dá pra gastar em API enquanto o reembolso ainda está em análise.
- **Onde:** `src/lib/liberacao-creditos.ts:140-168` (a liberação não olha se a conta está suspensa) vs `src/lib/reembolsos.ts:74-109`.
- **Impacto:** fura exatamente a proteção que a quarentena criou (gastar dentro da garantia e receber o dinheiro de volta). O rombo vira saldo devedor depois, mas o custo de API já aconteceu.
- **Status:** pendente.

#### 11. 🟡 (Nota 5) Devolução de cortesia (vídeo com defeito) conta como reembolso real e trava a subida de nível
- **Quando acontece:** o admin aceita um reporte de vídeo com problema (ou usa o estorno manual do Diagnóstico). A devolução é registrada como "estorno", e as regras de nível tratam qualquer "estorno" como reembolso de verdade: a conta nunca mais chega ao Ouro e a promoção pra Prata fica adiada por 30 dias.
- **Onde:** `src/app/api/reportes/route.ts:95` e `src/app/api/admin/estorno/route.ts:53` (gravam tipo "estorno" com valor positivo); `src/lib/niveis.ts:350-354` (qualquer "estorno" bloqueia o Ouro) e `:306-314` (segura a Prata por 30 dias).
- **Impacto:** cliente bem atendido é punido pra sempre na progressão de nível, sem ninguém perceber o porquê.
- **Detalhe técnico:** os bloqueios deviam considerar só estorno negativo vindo de gateway (com `kiwifyOrderId`), ou a cortesia devia usar um tipo próprio.
- **Status:** pendente.

#### 12. 🟡 (Nota 5) Caminho no fechamento do worker entrega vídeo sem cobrar (modo "total")
- **Quando acontece:** quando o worker sobe as partes informando o total: ao chegar a última parte o job vira "pronto" direto, sem passar pelo débito (só os modos "finalizar" e "batch" cobram). O worker atual sempre fecha com "finalizar", então hoje é um buraco latente; qualquer worker antigo/variante que use o campo `total` entrega vídeo de graça, e como não fica registro de débito, nada cobra depois.
- **Onde:** `src/app/api/worker/concluir/[id]/route.ts:179-189` (fecha sem debitar) vs `:103` e `:249` (os outros dois modos debitam).
- **Status:** pendente.

#### 14. 🟢 (Nota 4) Excluir usuário apaga junto todo o histórico financeiro dele
- **Quando acontece:** o admin exclui um usuário em /admin/usuarios: todas as transações de crédito (compras, débitos, estornos) somem em cascata. Os totais do painel (ex.: "créditos gastos") encolhem sem aviso, a trilha de auditoria daquelas vendas se perde e um reembolso que chegar depois não encontra mais a conta.
- **Onde:** `src/app/actions/usuarios.ts:93` + `prisma/schema.prisma:266` (`CreditoTransacao` com `onDelete: Cascade`).
- **Status:** pendente.

#### 15. 🟢 (Nota 4) Se a consulta à Cakto falhar na hora do cadastro, cliente da entrada nasce sem biblioteca e sem brinde
- **Quando acontece:** a pessoa comprou a entrada, mas a allowlist guardou nome de pacote (comprou pacote também) ou está sem nome de produto; na hora do cadastro a confirmação ao vivo na Cakto falha (API fora/instável) e a conta nasce sem assinatura e sem os 1.000 créditos. Nada re-verifica depois.
- **Onde:** `src/lib/registro.ts:71-76` + `src/lib/cakto.ts:307-317` (`emailComprouEntrada` devolve false em qualquer erro).
- **Impacto:** cliente legítimo tratado como comprador de pacote até alguém arrumar na mão (ou a primeira renovação religar a assinatura).
- **Status:** pendente.

#### 16. 🟢 (Nota 3) Reentrega de webhook de reembolso pode apagar de novo a permissão de cadastro
- **Quando acontece:** um reembolso de entrada já processado chega de novo (reenvio da Cakto): a remoção do e-mail da allowlist roda ANTES da checagem de "já processado", então uma recompra recente daquele e-mail pode ter a permissão de cadastro apagada. Mitigado: o cadastro ainda consulta a Cakto ao vivo e recoloca na lista.
- **Onde:** `src/lib/reembolsos.ts:157-159` (deleteMany antes do guard da linha 172).
- **Status:** pendente.

#### 17. 🟢 (Nota 3) Extrato mostra texto interno (JSON) na linha de reembolso em análise
- **Quando acontece:** a pessoa teve reembolso solicitado e abre o extrato: a linha da suspensão mostra o conteúdo bruto, tipo `{"m":"Reembolso solicitado na Kiwify...","assinanteAntes":true,"nivelAntes":"prata"}`, citando "Kiwify" mesmo quando a compra foi na Cakto.
- **Onde:** `src/components/app/extrato-detalhado.tsx:266` (mostra a `descricao` crua) + `src/lib/reembolsos.ts:98-103` (grava JSON na descricao).
- **Impacto:** confuso pro cliente e expõe campos internos.
- **Status:** pendente.

#### 18. 🟢 (Nota 2) Posição no ranking de afiliados pode confundir dois e-mails parecidos
- **Quando acontece:** dois afiliados cujo e-mail mascarado fica igual (ex.: "marcos•••@gmail.com"): a tela "minhas indicações" procura a posição comparando a máscara e pode mostrar a posição do outro.
- **Onde:** `src/lib/afiliados.ts:164-166`.
- **Status:** pendente.

#### 19. 🔴 (Nota 9) Pacotes de 2.500 e 14.000 créditos: cliente paga e não recebe nada (confirmado em produção)
- **Quando acontece:** sempre que alguém compra o pacote de 2.500 ou o de 14.000 créditos. O pagamento é aprovado na Cakto e os créditos nunca entram na conta: nem no saldo, nem como crédito pendente, nem no extrato. O cliente fica esperando até reclamar e alguém colocar na mão.
- **Onde:** não é o código do `webhook/route.ts` (a regex `PACOTE_RE` de `src/lib/cakto.ts:159` reconhece "2.500" e "14.000" normalmente). O sintoma é do **webhook não estar configurado nesses dois produtos no painel da Cakto** - a chamada nunca chega na plataforma. Confirmar lá.
- **Impacto:** verificado no período 29/06 a 04/08 cruzando a API da Cakto com o banco. **9 pacotes pagos (R$223,91), só 4 creditados.** Os 5 que falharam somam **35.500 créditos (R$355,00)** e são exatamente todos os de 2.500 e 14.000; todos os de 1.000 funcionaram (separação 100% limpa por produto, o que aponta pra configuração e não pra código). Os 4 clientes atingidos foram compensados na mão pelo admin, um deles depois de **3 dias de espera**. Enquanto não resolver, toda venda desses pacotes vira trabalho manual e risco de reembolso.
- **Pedidos afetados:** `b285d125` (Carla, 04/08), `399d86e7` (Marcilene, 03/08), `b332e0d6` e `765ada42` (Ricardo, 29/07), `0cea8f3b` (Raquel, 28/07).
- **Status:** pendente.

#### 20. 🟠 (Nota 8) Crédito entregue segue o NOME do produto, não o valor que a pessoa pagou
- **Quando acontece:** qualquer venda de pacote com preço abaixo do cheio (link promocional, cupom, order bump, preço editado no checkout). A plataforma lê o número que está no nome do produto e entrega essa quantidade, sem olhar quanto entrou de verdade.
- **Onde:** `src/lib/cakto.ts:163-173` (`creditosDoNomeProduto` / `creditosDoPacote`) usado por `src/app/api/cakto/webhook/route.ts:133`; o valor pago (`pedido.payment.charge_amount`) só é usado pro pixel da Meta, nunca pra decidir o crédito.
- **Impacto:** o pedido `b332e0d6` (29/07) pagou **R$15,00 num produto de R$100,00** ("Viraliza 14.000 Créditos") e daria direito a 14.000 créditos, ou seja R$140,00 em API por R$15,00 pagos. Nesse caso o crédito automático não rodou (problema #19) e o admin acabou lançando 29.000 créditos na mão pelos R$116,98 do cliente. Confirmar na Cakto o que gerou esse preço de R$15,00; enquanto o crédito não acompanhar o valor pago, qualquer promoção vira prejuízo direto.
- **Status:** pendente.

#### 21. 🟡 (Nota 5) Voz com chave própria (BYO): o worker recebe a chave do usuário mas nunca usa
- **Quando acontece:** quando um usuário com chave ElevenLabs própria cadastrada gera um vídeo narrado. A plataforma manda a chave dele pro renderizador, só que o renderizador ignora essa chave e narra com as chaves da casa do mesmo jeito.
- **Onde:** `bot shopee/worker.py:264` põe a chave do usuário no ambiente (`ELEVEN_USER_KEY`), mas `bot shopee/narrar_video.py:105-114` (`_carregar_keys`) só lê as chaves do servidor e nenhum arquivo do worker lê `ELEVEN_USER_KEY`. O `reminder.md` descreve o BYO de voz como "PRONTO", o que não bate com o worker.
- **Impacto:** hoje é baixo porque o BYO está travado pros usuários (`BYO_LIBERADO = false` na tela Conta). Mas se liberar do jeito que está, o usuário informa a chave dele, acha que gasta a cota dele, e na verdade continua gastando a cota (e o dinheiro) da casa, sem cobrar o crédito da voz dele (a web já pula esse débito no BYO). Vira prejuízo silencioso por usuário.
- **Detalhe técnico:** a correção provável é `_carregar_keys()` colocar `ELEVEN_USER_KEY` na frente da lista quando existir (e não contar esses caracteres no consumo, o registro de gasto novo em `_tts_uma_chave` já ignora essa chave).
- **Status:** pendente.

---

### Concluído:

#### 2. 🟢 (Nota 2) Admin: contador "em produção" não contava os que estão finalizando
- **Quando acontecia:** no painel admin (visão geral), enquanto um vídeo estava "Finalizando", ele não entrava na contagem de "em produção".
- **Onde:** a contagem hoje vive em `src/lib/admin.ts:76`.
- **Status:** CORRIGIDO (verificado em 05/08/2026): a lista de produção agora é `["na_fila", "renderizando", "processando"]`, incluindo a fase de finalização.

#### 13. 🟡 (Nota 5) Renovação paga da assinatura não atualizava a validade antiga
- **Quando acontecia:** conta com DATA de assinatura já vencida pagava a renovação na Cakto: o webhook creditava o bônus mensal e ligava "assinante", mas não mexia na data vencida, então a biblioteca continuava bloqueada mesmo com a mensalidade paga.
- **Onde:** `src/app/api/cakto/webhook/route.ts:167`.
- **Status:** CORRIGIDO (verificado em 05/08/2026): o webhook agora chama `estenderAssinatura(user.id, DIAS_ASSINATURA)`, que atualiza `assinaturaAte` a partir do maior entre hoje e o vencimento atual (`src/lib/creditos.ts:50-62`).

#### 22. 🟠 (Nota 8) Editor automático: tudo que a pessoa monta na tela é jogado fora na hora de gerar
- **Quando acontecia:** sempre que alguém usava o Editor automático. A pessoa colocava os clipes na ordem que queria, cortava cada um pelas alças verdes, escrevia os textos e via a prévia. Ao clicar em "Gerar vídeo", nada disso ia junto: só os arquivos soltos e as configurações. O renderizador então decidia sozinho quais fotos entravam, em que ordem, quanto tempo cada uma ficava e escrevia as próprias legendas.
- **Onde:** `src/components/app/editor-estudio.tsx:469-486` montava os campos `textos` e `roteiro`, e `src/app/api/jobs/route.ts` nunca lia nenhum dos dois.
- **Impacto:** o editor prometia uma coisa e entregava outra. Cortar um clipe não adiantava nada, mudar a ordem não adiantava nada e o texto escrito à mão nunca aparecia no vídeo. Como o preço é por consumo real, a pessoa pagava por um vídeo que ela não montou.
- **Status:** CORRIGIDO em 05/08/2026. A montagem agora viaja no job (`opcoes.roteiro` e `opcoes.textos`) e o renderizador monta por ela (`roteiro.json` -> `build_montagem` na fábrica). Sem roteiro, o comportamento antigo continua valendo (fábrica avulsa e jobs antigos).

#### 23. 🟡 (Nota 6) Controle de volume da música não fazia nada no vídeo final
- **Quando acontecia:** sempre. A pessoa arrastava o controle de volume da música no Editor, o valor era salvo no pedido, e o renderizador nunca lia esse valor: a música saía sempre no volume fixo do código.
- **Onde:** `src/app/api/jobs/route.ts:173` gravava `volumeMusica` em `opcoes`, mas nem `bot shopee/worker.py` nem `bot shopee/worker_serverrk.py` repassavam pra fábrica, que usava as constantes fixas `VOL_LEGENDA`/`VOL_VOZ`/`VOL_MANTER_MUS` em `bot shopee/fabrica.py:62-64`.
- **Impacto:** música abafando a narração sem a pessoa ter como resolver, e um controle na tela que dava a sensação de estar funcionando.
- **Status:** CORRIGIDO em 05/08/2026. Os volumes (música, narração e som original) agora viajam no job e viram parâmetro da fábrica.

#### 24. 🟡 (Nota 6) Formato "Voz narrada": só o primeiro vídeo entrava, o resto era descartado sem avisar
- **Quando acontecia:** ao gerar no formato "Voz narrada" com mais de um vídeo. O primeiro entrava, os outros sumiam. Com fotos não acontecia (elas entravam normalmente).
- **Onde:** `bot shopee/fabrica.py:602` (`video = videos[0]`) usava só o primeiro item da lista.
- **Impacto:** a pessoa subia 3 clipes, esperava o render e recebia um vídeo com o primeiro clipe em loop, sem nenhuma mensagem explicando. Era o formato mais usado da plataforma.
- **Status:** CORRIGIDO em 05/08/2026. Os vídeos agora entram todos em sequência e o loop só acontece se o conjunto não cobrir a narração.

#### 4. 🔴 (Nota 9) Comprar só um pacote de crédito dava acesso vitalício à biblioteca
- **Quando acontecia:** a pessoa nunca comprava o produto de entrada. Comprava só o pacote de crédito mais barato (R$10), criava a conta com esse mesmo e-mail e entrava com a biblioteca inteira liberada para sempre (Acervo, Virais, Shopee, Produtos TikTok, Área de membro), mais 1.000 créditos de boas-vindas de brinde.
- **Onde:** `src/lib/registro.ts` (a conta nascia `assinante: true` com `assinaturaAte: null`, ou seja, permanente, para qualquer compra).
- **Impacto:** o produto de entrada deixava de ser necessário e a assinatura virava item opcional. A conta ainda saía no negativo: entravam R$10 (R$7,51 líquido depois da taxa da Cakto) e saíam 1.000 créditos de brinde mais os 1.000 comprados, ou seja, R$20 em crédito.
- **Solução aplicada:** `criarContaLiberada` passou a decidir assinatura e brinde pelo produto que foi comprado, via a nova `comprouEntrada(email)` (`registro.ts`). A decisão usa o nome do produto guardado na allowlist e, se ele for de pacote, confere ao vivo na Cakto se existe algum outro pedido pago que não seja pacote (`emailComprouEntrada` em `cakto.ts`, apoiada em `ehPacoteDeCredito`/`creditosDoNomeProduto`). Quem comprou só pacote entra sem biblioteca e sem brinde, recebendo apenas os créditos que pagou; quem comprou a entrada segue como antes. Nome de produto desconhecido conta como entrada de propósito, para não barrar cliente legítimo: a compra de pacote sempre carrega o nome dela. O dono (primeiro cadastro) continua passando direto. O webhook não precisou mudar, então o `AcessoPago` segue liberando o cadastro de quem pagou qualquer coisa, que é o certo: quem comprou crédito precisa da conta para usar o que pagou.
- **Atenção:** a correção vale daqui pra frente. Contas que já entraram por pacote continuam assinantes e precisam ser revistas na mão em `/admin/usuarios`.
- **Status:** concluído.

#### 5. 🟠 (Nota 7) Minerador entregava os vídeos da biblioteca para quem não é assinante
- **Quando acontecia:** a conta perdia a assinatura (reembolso, chargeback ou o admin tirava o acesso) e continuava com crédito. Era barrada ao abrir Virais, mas abria o Minerador, digitava o nicho e recebia os mesmos vídeos, com link que toca e baixa.
- **Onde:** `src/app/(app)/painel/minerador/page.tsx` (a página não tinha gate nenhum além do login do layout) e `src/app/api/minerador/route.ts` (só `getCurrentUser`).
- **Impacto:** a trava da biblioteca ficava furada: o conteúdo que justifica a assinatura saía por outra porta.
- **Solução aplicada:** a página passou a chamar `requireAssinatura()`, igual às outras telas de acervo. Como redirecionar não serve para rota de API, foi criada a `assinaturaAtiva(user)` em `src/lib/dal.ts` (mesma regra, sem redirect, com admin e demo passando), usada pela rota do Minerador para responder 403. O `requireAssinatura` foi reescrito em cima dela, então as duas portas compartilham a mesma regra.
- **Status:** concluído.


---

