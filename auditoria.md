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

#### 2. 🟢 (Nota 2) Admin: contador "em produção" não conta os que estão finalizando
- **Quando acontece:** no painel admin (visão geral), enquanto um vídeo está "Finalizando", ele não entra na contagem de "em produção".
- **Onde:** `src/app/(app)/admin/page.tsx:32`
- **Impacto:** número levemente menor que o real; cosmético (só o admin vê).
- **Detalhe técnico:** `status: { in: ["na_fila","renderizando"] }` - falta `"processando"`.
- **Status:** pendente.

#### 3. 🟢 (Nota 2) Estúdio: prévia de voz continua tocando ao fechar o seletor
- **Quando acontece:** clica no play de uma voz e fecha o dropdown clicando fora - o áudio segue tocando até o fim.
- **Onde:** `src/components/app/seletor-voz.tsx`
- **Impacto:** pequena confusão sonora; sem impacto funcional.
- **Detalhe técnico:** o `pointerdown` de fora fecha o painel mas não pausa o `audioRef`.
- **Status:** pendente.

---

### Concluído:


---

