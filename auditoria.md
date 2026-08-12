# Bugs críticos descobertos - varredura colaborativa multi-IA

> Arquivo resetado a pedido do dono em 12/08/2026: ficou só o bug abaixo, pra
> verificação depois. O catálogo anterior (bugs #1 a #62, corrigidos e pendentes)
> continua no histórico do git deste arquivo, caso precise recuperar.

---

## Bugs em catalogação:

### Pendente de correção:

#### 42. 🟡 (Nota 5) Gerar imagem do Lab ou do Boost em paralelo subcobra
- **Quando acontece:** com saldo pra 1 imagem, disparando várias ao mesmo tempo a pessoa recebe todas pagando só uma; o excedente evapora.
- **Onde:** `src/app/api/lab/imagem/route.ts:167` (checa `saldo < CUSTO_IMAGEM_LAB`) e `:216` (`debitarClamp` sem `faltaViraDivida` e sem reserva); mesmo padrão em `src/app/api/boost/imagem/route.ts:44` e `:73`.
- **Impacto:** é o #8 aplicado a imagem, nunca blindado. Cada requisição paralela passa na checagem, gera, e o total debitado fica limitado ao saldo (clamp em 0, sem dívida). A reserva de saldo (`custoReservado`) só enxerga jobs de vídeo.
- **Status:** pendente (aguardando verificação).
