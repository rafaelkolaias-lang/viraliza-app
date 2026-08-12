# Proposta de Gamificação do Viraliza (arquitetura, sem código)

> Escrita pelo Claude 1 em 11/08/2026, como parte da tarefa 35 do `!executar.md`.
> É PROPOSTA: nada daqui foi implementado e nada mexe no banco. Toda tabela nova
> citada abaixo precisa de autorização explícita do dono antes de existir
> (regra de ouro do projeto).

## Ponto de partida (o que já existe e é reaproveitável)

A reforma dos níveis (tarefa 35) deixou o terreno pronto:

- `User.nivel` (bronze/prata/ouro) continua no banco e o motor de subida
  automática segue rodando (`recalcularNivel` em `src/lib/niveis.ts`), agora sem
  efeito de limite. É a semente do sistema de "patentes".
- `AtividadeDia` marca um registro por dia de uso (fuso SP). Serve direto pra
  metas de frequência ("entrou 5 dias na semana") sem query pesada.
- `Notificacao` (sininho) já entrega aviso com link. É o canal de "conquista
  desbloqueada".
- `CreditoTransacao` aceita tipos novos de lançamento; um tipo `recompensa`
  paga os prêmios em créditos com extrato transparente (mesma mecânica do
  `bonus_assinatura`).
- `GastoApi` e `Job` já contam produção real por usuário (quantos vídeos, por
  ferramenta, via `contarUsoPorUsuario` em `lib/admin.ts`).

## Desenho proposto (3 camadas)

### 1. Eventos (fonte da verdade)

Não criar contador manual por conquista. Derivar TUDO de dados que já existem:
jobs prontos, dias ativos, compras, indicações, sugestões aceitas. Uma função
`medirProgresso(userId)` calcula os números de uma vez (mesmo espírito do
`getResumoNivel`). Vantagem: zero migração pra começar e nenhum estado que possa
dessincronizar.

### 2. Catálogo de conquistas (código, não banco)

Arquivo client-safe `src/lib/gamificacao.ts` com o catálogo, no mesmo padrão de
`uso-ferramentas.ts` (catálogo puro + consulta em `lib/admin.ts`):

```
type Conquista = {
  id: string;            // "primeiro_video", "streak_7", "dez_videos"...
  rotulo: string;
  descricao: string;     // o que a pessoa fez
  grupo: "producao" | "frequencia" | "comunidade" | "compra";
  meta: number;          // alvo numérico (ex.: 10 vídeos)
  premioCentavos: number;// 0 = só selo
  medir: (m: Medidas) => number; // progresso atual a partir das medidas
};
```

Sugestão de conquistas iniciais (valores a decidir com o dono):

| Grupo | Conquista | Meta | Prêmio sugerido |
|---|---|---|---|
| Produção | Primeiro vídeo pronto | 1 | 100 créditos |
| Produção | 10 vídeos prontos | 10 | 300 créditos |
| Produção | 50 vídeos prontos | 50 | 1.000 créditos |
| Produção | Usou 3 ferramentas diferentes | 3 | 200 créditos |
| Frequência | 7 dias seguidos de acesso | 7 | 200 créditos |
| Frequência | 30 dias ativos no total | 30 | 500 créditos |
| Comunidade | 1ª indicação convertida (Indique e Ganhe) | 1 | 500 créditos |
| Comunidade | Sugestão aceita pelo admin | 1 | já existe recompensa manual |
| Compra | 2ª compra de pacote | 2 | selo, sem crédito |

Regras de saúde financeira: prêmio só em crédito (nunca dinheiro), teto mensal
de prêmios por conta e prêmio nunca conta pra base de reembolso (mesma regra do
brinde de assinatura em `reembolsos.ts`).

### 3. Estado persistido (a ÚNICA tabela nova, quando autorizada)

`ConquistaUsuario`: userId, conquistaId, concluidaEm, premioCentavos pago e
`kiwifyOrderId`-like de idempotência (`userId + conquistaId` unique). Sem ela dá
até pra lançar selos "calculados ao vivo", mas o prêmio em créditos precisa de
idempotência durável, então essa tabela é o pré-requisito do pagamento
automático. Migração só com autorização do dono.

## Onde o usuário vê

- Card "Conquistas" na aba Créditos (ao lado do `NivelCard`), com barra de
  progresso das 3 mais próximas de completar.
- Sininho avisa conquista completada (via `Notificacao`, já existe).
- O nível (Bronze/Prata/Ouro) vira o "resumo" da gamificação: subir de nível
  quando fechar grupos de conquistas, no lugar do critério atual de tempo+compra
  (o motor `recalcularNivel` é trocado por dentro, a UI do selo não muda).

## Fases de entrega sugeridas

1. **Fase 0 (sem banco):** catálogo + `medirProgresso` + card com progresso e
   selos calculados ao vivo. Nenhum prêmio pago ainda. Zero migração.
2. **Fase 1 (com a tabela, autorizada):** pagamento automático dos prêmios com
   idempotência + notificação. Varredura no `instrumentation.ts` (mesmo lugar
   das outras rotinas) pra completar conquistas de quem não logou.
3. **Fase 2:** níveis passam a ser consequência das conquistas; admin ganha
   painel de acompanhamento (quantos completaram cada uma, custo total dos
   prêmios no período).

## Riscos e decisões pro dono

- Custo dos prêmios: a tabela acima soma até ~2.800 créditos (R$ 28) por conta
  que completar tudo. Calibrar contra a margem antes de ligar a Fase 1.
- Anti-abuso: conquistas de produção contam só job `pronto` (não `erro`), e o
  teto de 5 simultâneos já limita farm. Conta `demo` e `admin` ficam fora.
- Streak (dias seguidos) usa `AtividadeDia`, que só marca com a pessoa logada
  no painel; abrir o site sem logar não conta (comportamento desejado).
