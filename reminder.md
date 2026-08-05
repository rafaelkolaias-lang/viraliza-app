Tanto Claude quanto Codex/Antigravity podem adicionar, editar ou remover
lembretes neste arquivo a pedido do usuário.

---

## Lembretes ativos

- **PRODUÇÃO: pôr `META_ADS_TOKEN` e `META_ADS_ACCOUNT_ID` no EasyPanel.**
  O card **"Anúncios"** da aba Finanças (quanto você gastou de tráfego no
  período escolhido) já está **funcionando no local** - token criado e testado
  em 04/08/2026, respondeu certo. Só que as duas variáveis existem **apenas no
  `.env` da sua máquina**: enquanto não forem copiadas pro EasyPanel, em
  produção o card fica com "-". Copiar do `.env` local (o token NÃO está no
  git, tem que ser na mão). Valores: `META_ADS_ACCOUNT_ID` = `2278455769598122`
  (conta BM VIRALIZA) e `META_ADS_TOKEN` = o token de usuário do sistema com
  permissão `ads_read`.
  Se um dia o card voltar a dar erro, o token se recria em business.facebook.com
  > Configurações do negócio (BM Viraliza) > Usuários > Usuários do sistema >
  admin > Adicionar ativos (a conta de anúncios, acesso total) > Gerar novo
  token > marcar `ads_read`. Esse tipo de token não vence sozinho.
  Nada a ver com `META_PIXEL_ID`/`META_CAPI_TOKEN`, que são pra atribuição de
  venda e seguem sem configurar. Obs.: o gasto de anúncios **ainda não entra no
  "Lucro real"** do painel, é card separado.

- **URGENTE - Ligar o webhook na Cakto nos pacotes de 2.500 e 14.000 créditos.**
  Quem compra esses dois pacotes **paga e não recebe os créditos**: nada entra no
  saldo, nem no extrato, e alguém precisa creditar na mão. O de 1.000 créditos
  funciona normal, então o problema é a configuração do webhook desses dois
  produtos no painel da Cakto (o código reconhece os dois nomes sem problema).
  Conferido em 04/08/2026 cruzando a API da Cakto com o banco: **9 pacotes pagos
  no período, só 4 creditados**; os 5 que falharam somam **35.500 créditos
  (R$355,00)** e são exatamente todos os de 2.500 e 14.000. Os 4 clientes foram
  compensados na mão, um deles depois de 3 dias esperando. Catalogado como o
  problema **#19 do `auditoria.md`** (com a lista dos pedidos afetados).

- **URGENTE - Descobrir o que gerou o pedido de R$15,00 num produto de R$100.**
  Pedido `b332e0d6` (refId `4KNxPjM`, 29/07/2026): o cliente pagou **R$15,00** no
  produto "Viraliza 14.000 Créditos", que custa R$100,00. Como a plataforma
  entrega crédito pelo **nome do produto** e não pelo valor pago, esse pedido
  daria direito a 14.000 créditos, ou seja **R$140,00 em API por R$15,00**.
  Ver na Cakto se foi cupom, link promocional, order bump ou preço editado - e se
  esse caminho ainda está ativo. Catalogado como o problema **#20 do
  `auditoria.md`**.

- **Configurar o link de checkout da ASSINATURA (`CAKTO_CHECKOUT_ASSINATURA`).**
  A aba `/painel/assinatura` tem o botão Renovar/Assinar, mas o link do checkout
  da entrada/assinatura na Cakto ainda NÃO foi preenchido. Sem ele, o botão hoje
  mostra um ERRO ("renovação ainda não disponível") em vez de levar ao pagamento.
  Pegar o link do produto de entrada no painel da Cakto (algo como
  `https://pay.cakto.com.br/xxxxx`), pôr em `.env` (local) e no EasyPanel (prod)
  como `CAKTO_CHECKOUT_ASSINATURA`. Assim que existir, o botão vira "Renovar/
  Assinar agora" indo direto ao checkout (a página já lê o env, é só preencher).

- **Aviso órfão "biblioteca exclusiva pra assinantes" na tela de Créditos.**
  A tela `/painel/creditos` ainda mostra aquele aviso âmbar quando chega com
  `?bloqueio=biblioteca`. Só que a biblioteca agora mostra o erro NA PRÓPRIA
  tela (componente `BibliotecaBloqueada`) em vez de redirecionar pra Créditos,
  então ninguém mais chega lá por esse motivo e o aviso virou código morto.
  Limpar: remover o bloco `sp.bloqueio === "biblioteca"` em
  `src/app/(app)/painel/creditos/page.tsx` (e o `searchParams` `bloqueio` se
  não for usado em mais nada). Não é urgente, não atrapalha.

- **Seção "Como os créditos funcionam" (aba Créditos) está DESATUALIZADA.**
  Ela só fala de texto/áudio e BYO key; não menciona o sistema de níveis
  (bronze/prata/ouro), a liberação em duas partes (garantia da compra) nem o
  saldo devedor de reembolso. Atualizar os 3 cards em
  `src/app/(app)/painel/creditos/page.tsx`.

- **Prévias de voz (play do Estúdio).** JÁ RODADO pra lista curada atual (8 vozes).
  Rodar de novo quando **mudar a lista** (`src/lib/vozes.ts`) ou **após deploy**:
  `cd "bot shopee" && python gerar_previews_voz.py` (`--force` refaz todas). Gasta
  um pouco da cota ElevenLabs.
- **Produção: persistir as prévias.** Adicionar `public/voice-previews` aos
  volumes do EasyPanel (hoje só `videos/virais/downloads`), senão um redeploy
  apaga as prévias e precisa rodar o gerador de novo. Vozes BYO (chave do usuário)
  ainda não têm prévia (escopo foi só as vozes do servidor).

- **Integrar a Kiwify (pagamento).** Hoje o botão "Comprar" (`planos-creditos.tsx`)
  é placeholder e o saldo só entra pelo painel de teste admin (`actions/creditos.ts`).
  Falta: checkout Kiwify creditar o saldo + ativar/renovar assinatura.

- **BYO key (chave própria do usuário).** ElevenLabs PRONTO, mas **GATED ("Em breve")**:
  a seção em `/painel/conta` está travada por `const BYO_LIBERADO = false`
  (`conta/page.tsx`). Pra liberar pros usuários, virar pra `true` (back-end já
  funciona: cifra em `lib/cripto.ts`, seletor busca `/api/voices`, worker usa a
  chave via env `ELEVEN_USER_KEY` sem debitar crédito da voz). FALTA: Gemini e
  Minimax (mesma estrutura). Minimax foi adiado.

- **Crédito mensal da assinatura = 2.000 (R$20), oferta de lançamento.** Mudado de
  100 pra 2000 em `src/lib/creditos.ts` (`CREDITO_MENSAL_CENTAVOS`). Nesse número o
  brinde mensal ≈ o valor da mensalidade (R$19,90) em custo de API - rever quando
  calibrar preços/definir a oferta final.

- **FEITO (04/08/2026): worker instrumentado de verdade.** O `uso.py` existia mas
  NADA chamava ele (consumo.json nunca era gravado; todo job caía no preço fixo).
  Agora: `gemini_copy.py` (9 chamadas), `narrar_video.py`, `veo_gen.py` (segundos),
  `cortar_youtube.py` e `fabrica.py`/`worker.py` gravam e enviam o consumo. Além do
  débito, tudo vira linha na tabela `GastoApi` (aba Finanças, gasto por API/usuário).

- **Calibrar os valores de crédito (depois do worker + preço das APIs).**
  Falta definir os números reais: (a) quanto é "1 minuto de vídeo texto+áudio"
  (crédito padrão da assinatura) e (b) o preço fixo das ferramentas sem API
  (Lote, Editor manual, MapsLeads) = ≈25% abaixo do "vídeo só com transcrição
  Gemini". A estrutura da carteira fica pronta agora; o número entra quando o
  dono passar o worker Python e a gente confirmar o preço atual do Gemini/ElevenLabs.

- **Ao calibrar preços, atualizar a Central de Ajuda junto.** A tela
  `/painel/ajuda` repete os números na mão pro usuário: 20 créditos a imagem,
  50/70/95 o vídeo por duração (6s/10s/15s), 40 o influenciador, 50 fixos por
  vídeo do Lote e por busca do MapsLeads, e os limites de cada nível (5/12/50
  vídeos por dia, 1/2/3 ao mesmo tempo). Mexeu em `lab-custos.ts`,
  `avatar-modelo.ts`, `precos.ts` ou `niveis.ts`, revisar os textos em
  `src/components/app/ajuda-comecar.tsx` (tabela de preços e tabela de níveis),
  `ajuda-influenciador.tsx`, `ajuda-videos.tsx` e `ajuda-ferramentas.tsx`.
  Senão a ajuda passa a mentir pro usuário.

- **RESPONDIDO (04/08/2026): APIs do "Cortes".** `cortar_youtube.py` usa yt-dlp
  (grátis) + faster-whisper LOCAL pra transcrever (grátis) + UMA chamada Gemini
  pra escolher os momentos (essa é o único custo de API, agora medida e reportada
  no consumo). `legendar_video.py` também é local. Falta só calibrar o preço em
  créditos do corte (entra no item de calibração geral).

- **PENDÊNCIAS DO DONO - painel "Gasto com APIs" (Finanças), feito em 04/08/2026.**
  O que falta VOCÊ fazer pra ativar 100%:
  1. **Criar a `OPENAI_ADMIN_KEY`** em platform.openai.com > Settings > Organization >
     Admin keys (começa com `sk-admin-...`, NÃO é a API key normal) e pôr no `.env`
     local e no EasyPanel. Sem ela o card da OpenAI fica como "estimado".
  2. **Reiniciar o worker do PC** (`bot shopee/`), senão os jobs continuam sem
     reportar consumo (Gemini/Eleven/Veo) e caem no preço fixo.
  3. **Em produção (EasyPanel): rodar `prisma db push`** no deploy, pra criar a
     tabela nova `GastoApi` (no banco local já foi criada).
  4. Opcional, ajustar preços no `.env` (já documentados lá comentados):
     `GROK_CUSTO_10S_CENTAVOS=61` (R$0,61/10s, já setado no .env local), `VEO_USD_SEG=0.35`, `USD_BRL=5.50`,
     `GROK_CUSTO_IMAGEM_CENTAVOS=0` (imagem do Grok hoje conta R$0),
     `OPENAI_TXT_USD_MTOK=0.6`.
  Lembrete extra: o histórico por usuário e das APIs estimadas começa a contar do
  dia que entrar no ar; só a OpenAI mostra gasto retroativo (fatura por período).
