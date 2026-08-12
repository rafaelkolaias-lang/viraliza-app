Tanto Claude quanto Codex/Antigravity podem adicionar, editar ou remover
lembretes neste arquivo a pedido do usuário.

**Como este arquivo é organizado:** o que ainda precisa de ação fica em
**PENDENTES**. O que já foi resolvido desce pra **HISTÓRICO**, que não deve ser
apagado: é lá que estão as armadilhas e os motivos das decisões, contexto pra
quem chegar depois. Ao concluir um item, mova pro histórico em vez de deletar.

Última revisão: 06/08/2026.

---

# PENDENTES

## 🔴 Urgente: dinheiro parado (é no painel da Cakto, não é código)

- **Ligar o webhook na Cakto nos pacotes de 2.500 e 14.000 créditos.**
  Quem compra esses dois pacotes **paga e não recebe os créditos**: nada entra no
  saldo, nem no extrato, e alguém precisa creditar na mão. O de 1.000 créditos
  funciona normal, então o problema é a configuração do webhook desses dois
  produtos no painel da Cakto (o código reconhece os dois nomes sem problema).
  Conferido em 04/08/2026 cruzando a API da Cakto com o banco: **9 pacotes pagos
  no período, só 4 creditados**; os 5 que falharam somam **35.500 créditos
  (R$355,00)** e são exatamente todos os de 2.500 e 14.000. Os 4 clientes foram
  compensados na mão, um deles depois de 3 dias esperando. Catalogado como o
  problema **#19 do `auditoria.md`** (com a lista dos pedidos afetados).

- **Descobrir o que gerou o pedido de R$15,00 num produto de R$100.**
  Pedido `b332e0d6` (refId `4KNxPjM`, 29/07/2026): o cliente pagou **R$15,00** no
  produto "Viraliza 14.000 Créditos", que custa R$100,00. Como a plataforma
  entrega crédito pelo **nome do produto** e não pelo valor pago, esse pedido
  daria direito a 14.000 créditos, ou seja **R$140,00 em API por R$15,00**.
  Ver na Cakto se foi cupom, link promocional, order bump ou preço editado, e se
  esse caminho ainda está ativo. Catalogado como o problema **#20 do
  `auditoria.md`**.

- **🔺 MANDAR O CNPJ: as 3 páginas legais estão escritas mas NÃO podem ir pro ar.**
  Termos de Uso, Política de Privacidade e Política de Reembolso ficaram prontas
  em 06/08/2026, mas falta **razão social, CNPJ e endereço**. Enquanto faltar, as
  três páginas mostram uma tarja vermelha dizendo que não são publicáveis. É um
  arquivo só pra preencher: `src/lib/legal.ts`, no topo. Preencheu, a tarja some
  das três de uma vez e elas estão liberadas.

- **Colar os links das políticas no checkout da Cakto e do Mercado Pago.**
  É configuração de painel, não é código, e é o item que **ganha disputa de
  cartão**: o contrato nasce no pagamento, então é lá que a prova precisa estar.
  Na Cakto tem campo pra isso no cadastro do produto. O Mercado Pago **não tem**
  campo de termos do vendedor (é gateway, não plataforma de infoproduto): lá o
  jeito certo é o Checkout Transparente, com o aceite na sua própria página antes
  do botão de pagar. Plano do dono: Mercado Pago pra assinatura, Cakto pro
  primeiro pagamento vindo de afiliado.

- **Passar as 3 páginas por um advogado antes de publicar.** Foram escritas por
  IA seguindo CDC, LGPD e Marco Civil, e a estrutura está certa, mas tem
  pagamento recorrente e dado de rosto envolvidos. Uma lida profissional é barata
  perto do risco.

- **RESOLVIDO em 06/08/2026: sobraram DOIS brindes, o de boas-vindas acabou.**
  - **Mensal da assinatura: 3.000 créditos** (era 2.000). Custa R$30,00 de API
    numa mensalidade de R$98,90, então sobram R$68,90.
  - **Bônus de seguir o Instagram: 300 créditos, CONTINUA VALENDO**, uma vez por
    conta, com aprovação na mão pela tela do admin. Nada mudou nele.
  - **Boas-vindas no cadastro: DESLIGADO** (era 1.000 créditos). Religar é trocar
    o `CREDITO_INICIAL` de volta pra 1000 em `lib/registro.ts`: nada foi apagado.
  - As telas, a Central de Ajuda e o robô de suporte já foram alinhados com isso.
    **Pendente só de deploy.**
  Como você disse que o valor vai mudar, os documentos legais **não citam número
  nenhum** de propósito (falam "a quantidade vigente informada na plataforma"),
  então nada mente. Mas a Central de Ajuda e a tela de Créditos citam números na
  mão e precisam bater com o que for decidido.

- **Passo 2 (depois do deploy): gravar o aceite no banco.** Três campos na conta
  do usuário (qual versão aceitou, quando e de qual IP) e uma caixinha no
  cadastro. Não é exigência legal, é prova: sem isso você depende só de "o link
  estava na tela". Precisa de `prisma db push`, então pega carona no mesmo passo
  do `GastoApi` que já está na lista de deploy.

## 🚀 Deploy: o que trava produção

- **Conferir na tela depois do deploy: o "Posicionar cenas por IA" (Editor,
  etapa 5).** É novo e usa uma peça que nunca rodou antes: o navegador tira o
  áudio do seu vídeo e manda pra IA ouvir. Vale testar com um vídeo com fala de
  verdade e ver se os segundos que ela devolve batem com o que está sendo falado.
  Se o seu vídeo for mudo (ou o navegador não abrir o áudio dele), a tela avisa e
  a IA distribui pelas descrições: isso é esperado, não é bug.

- **SUBIR O SITE (EasyPanel): nada de 06/08/2026 está em produção ainda.**
  O Editor em 5 etapas, o "Criar um Corte", as telas de apresentação dos grupos, o
  filtro de período do admin, o "Avatar com produto" e o "Gerador de prompt" em
  funil e a Central de Ajuda: **tudo isso só existe na sua máquina**, e nem
  commitado está. Enquanto o site não subir, ninguém consegue usar as telas novas
  (o robô de render já está pronto esperando por elas).

- **🔺 SUBIR OS 3 ARQUIVOS DO ROBÔ PRO SERVERRK: `fabrica.py`, `worker.py` e
  `worker_serverrk.py`.** Sem isso **nada quebra**, mas quatro coisas novas não
  acontecem nos vídeos que a sua base gerar:
  - a **cena de apoio que não é 9:16** (foto quadrada, print estreito) continua
    entrando com faixa preta tapando o vídeo de baixo;
  - a legenda sai sempre em **frase inteira**: quem escolher "palavra por
    palavra" na tela é ignorado;
  - o texto escrito por você continua caindo **em cima da legenda** quando os
    dois pedem a mesma faixa;
  - o vídeo que pediu legenda e não conseguiu transcrever continua **saindo sem
    legenda calado**, em vez de avisar no Diagnóstico.
  - **(11/08/2026, tarefa 31) o `fabrica.py` mudou DE NOVO** e soma mais estas ao
    pacote: corte preciso dos pedaços (a voz deixa de escorregar da legenda),
    vídeo de apoio preenchendo a tela inteira (crop-to-fill), foto de apoio
    encostando em cima e embaixo, apoio na tela de 2 a 4s e foto de 1 a 3s, e o
    vídeo narrado terminando exatamente quando a fala acaba. Os workers NÃO
    mudaram nessa rodada: se os 3 de 06/08 já tiverem subido, agora basta copiar
    o `fabrica.py` (ela roda como programa separado a cada vídeo, sem reiniciar
    container).
  - **(12/08/2026) o `fabrica.py` mudou mais uma vez, agora na legenda:** com
    "Palavra por palavra", a primeira legenda do vídeo sai em caixa preta com
    letras amarelas (é o gancho, pra parar o scroll) e esse destaque estava
    caindo numa **palavra solta**: uma caixa preta grande com uma palavrinha
    dentro. Agora a caixa segura a **frase de abertura inteira** e o palavra por
    palavra começa depois dela. Sem o deploy nada quebra, só continua feio.
  - **🔺 (12/08/2026) agora são DOIS arquivos: `fabrica.py` E `gemini_copy.py`.**
    Na narração, quem manda no tamanho do vídeo é a fala: ele termina quando ela
    acaba. Só que o robô resolvia isso **cortando o fim**, então quem subia 3
    vídeos de 1 minuto via só o começo do primeiro e os outros dois **nunca
    apareciam**. Agora as cenas dividem entre si o tempo da narração, na ordem
    que a pessoa montou, e a IA olha os clipes e escolhe de cada um o pedaço que
    combina com o que está sendo falado enquanto ele está na tela.
    E no caso contrário, mídia **mais curta** que a fala: antes o último quadro
    ficava congelado na tela até a narração acabar, parecendo travamento. Agora
    **o vídeo repete do começo**, na mesma ordem, até a fala terminar.
    Quem liga isso é a chave **"A IA escolhe o melhor pedaço"** da etapa 4:
    desligada, as cenas ainda entram todas (o tempo é dividido por igual e nada
    de IA é chamado), ligada, a IA escolhe os cortes e os pedaços. **Sem o deploy
    nada quebra**, a produção só continua sumindo com as cenas que não couberam.
    A tela nova que avisa isso na aprovação já está pronta e vai junto no deploy
    do site.
  - **(12/08/2026) o `fabrica.py` mudou de novo, e este economiza dinheiro:**
    quando a narração é escrita **por você** ("Eu escrevo" na etapa 1), o robô
    estava olhando as cenas com IA e escrevendo uma descrição pra cada uma que
    você tinha deixado em branco, e depois **jogava fora**: essa descrição só
    serve pra IA saber do que falar, e nesse caso quem fala é o seu texto. Era
    uma chamada de IA paga em todo vídeo desse tipo, sem nenhum efeito no
    resultado. Agora ela só acontece quando alguém vai usar a frase. Sem o
    deploy nada quebra, o gasto à toa só continua.
  - **(11/08/2026, painel de editor) o `fabrica.py` mudou MAIS UMA vez:** agora
    ele obedece o TAMANHO que a pessoa escolher pra cada cena de apoio no painel
    novo da etapa 5 (a tela manda o campo `dura`). Sem esse deploy nada quebra,
    mas o tamanho manual é ignorado: o render encolhe de volta pro automático
    (2-4s vídeo, 1-3s foto) e a régua aprovada vira mentira. Workers seguem
    intocados: copiar só a fábrica resolve.

  Copiar e conferir (o md5 tem que bater com o daqui):

  ```
  cd "E:/Automacoes-Outras/viralizaV2-main/bot shopee"
  scp fabrica.py worker.py worker_serverrk.py serverrk-cf:/opt/viraliza-worker/app/
  ssh serverrk-cf "md5sum /opt/viraliza-worker/app/{fabrica,worker,worker_serverrk}.py"
  md5sum fabrica.py worker.py worker_serverrk.py
  ```

  - **DESTA VEZ PRECISA REINICIAR OS 3 CONTAINERS.** Os *workers* mudaram, e eles
    ficam de pé o tempo todo (a fábrica sozinha bastaria copiar, porque ela é
    disparada como programa separado a cada vídeo). Reinicie com a fila vazia.
  - **Backup:** o `/opt/viraliza-worker/app` é bind mount, então dá pra guardar o
    estado atual antes com
    `mkdir -p /opt/viraliza-worker/bak-20260806b && cp -p /opt/viraliza-worker/app/*.py /opt/viraliza-worker/bak-20260806b/`.
  - **Na sua máquina a fábrica já está valendo** sem fazer nada (o worker do PC lê
    ela a cada vídeo), mas o `worker.py` do PC **precisa ser reiniciado**: esse
    fica carregado na memória.

- **Rodar `prisma db push` no deploy**, pra criar a tabela nova `GastoApi` em
  produção (no banco local já foi criada). Sem ela o painel "Gasto com APIs" da
  aba Finanças não tem de onde ler.

- **Adicionar `public/voice-previews` aos volumes do EasyPanel** (hoje só
  `videos/virais/downloads`), senão um redeploy apaga as prévias de voz do
  Estúdio. Depois do deploy, rodar de novo:
  `cd "bot shopee" && python gerar_previews_voz.py` (`--force` refaz todas; gasta
  um pouco da cota ElevenLabs). Também rodar sempre que a lista de vozes mudar
  (`src/lib/vozes.ts`). Vozes BYO (chave do usuário) ainda não têm prévia.

- **Reiniciar o worker do PC** (`bot shopee/`), senão os jobs dele continuam sem
  reportar consumo (Gemini/Eleven/Veo) e caem no preço fixo.

## ✅ Conferir na tela depois do redeploy (é só olhar)

As variáveis de ambiente estão todas postas, mas só valem depois de
redeploy/restart do container. Quatro conferências rápidas:

- **Finanças > card "Anúncios"** tem que mostrar valor em reais. Se mostrar erro
  da Meta, provavelmente as **aspas** dos valores foram junto pro container: salve
  `META_ADS_TOKEN`/`META_ADS_ACCOUNT_ID` sem aspas e redeploy. Se mostrar "falta
  META_ADS_TOKEN e META_ADS_ACCOUNT_ID no env", não salvou ou não redeployou.
- **`/painel/assinatura`**: o botão tem que levar ao checkout da Cakto. Se ainda
  disser "renovação ainda não disponível", o `CAKTO_CHECKOUT_ASSINATURA` não
  chegou no container.
- **Finanças > card da OpenAI**: não pode mais trazer o aviso "(pendente: falta a
  OPENAI_ADMIN_KEY no env...)". Se trouxer, ou a chave não chegou, ou puseram a
  API key normal (`sk-proj-...`) no lugar da de administrador (`sk-admin-...`).
- **Ver um vídeo real com fala de verdade.** Na máquina de teste o transcritor
  (faster-whisper) não está instalado, então o abaixamento do som do apoio durante
  a fala foi conferido pela conta e pelo ffmpeg, mas nunca ponta a ponta com uma
  gravação sua. É a única parte da edição avançada que não foi vista funcionando.

**Obs. do `.env` local:** `CAKTO_CHECKOUT_ASSINATURA` e `OPENAI_ADMIN_KEY` foram
pro EasyPanel mas **não estão na sua máquina**. Testando local, o botão de
assinatura segue dando erro e o card da OpenAI segue "estimado". Isso é esperado,
não é bug. Vale copiar pra lá pra próxima IA não achar que quebrou.

## 💰 Preços e calibração

- **Calibrar os valores de crédito (depois do worker + preço das APIs).**
  Falta definir os números reais: (a) quanto é "1 minuto de vídeo texto+áudio"
  (crédito padrão da assinatura) e (b) o preço fixo das ferramentas sem API
  (Lote, Editor manual, MapsLeads) = ≈25% abaixo do "vídeo só com transcrição
  Gemini". A estrutura da carteira já está pronta; falta o número. Entra aqui
  também o preço em créditos do **corte** do "Cortes".

- **Ao calibrar preços, atualizar a Central de Ajuda junto.** A tela
  `/painel/ajuda` repete os números na mão pro usuário: 20 créditos a imagem,
  50/70/95 o vídeo por duração (6s/10s/15s), 20 o influenciador e os limites de
  cada nível (5/12/50 vídeos por dia, 1/2/3 ao mesmo tempo). Mexeu em
  `lab-custos.ts`, `avatar-modelo.ts` ou `niveis.ts`, revisar os textos em
  `src/components/app/ajuda-comecar.tsx` (tabela de preços e tabela de níveis),
  `ajuda-influenciador.tsx`, `ajuda-videos.tsx` e `ajuda-ferramentas.tsx`.
  Senão a ajuda passa a mentir pro usuário. (Os preços das 3 ferramentas sem IA
  não precisam mais disso: a ajuda, o robô de suporte e a tela do Lote leem de
  `CREDITOS_FIXO`.)

- **Rever o crédito mensal da assinatura = 2.000 (R$20), oferta de lançamento.**
  Mudado de 100 pra 2000 em `src/lib/creditos.ts` (`CREDITO_MENSAL_CENTAVOS`).
  **ATENÇÃO, esta anotação nasceu com o preço errado:** ela dizia que o brinde
  mensal empatava com a mensalidade porque partia de R$19,90. **A mensalidade é
  R$98,90** (corrigido pelo dono em 06/08/2026), então 2.000 créditos custam
  R$20,00 de API e deixam R$78,90 de margem. Rever ao calibrar preços / definir
  a oferta final, mas sem a urgência que este item sugeria.

- **Opcional e sem pressa: variáveis de preço no EasyPanel.** Só o
  `GROK_CUSTO_10S_CENTAVOS=61` foi pra produção; as outras (`VEO_USD_SEG=0.35`,
  `USD_BRL=5.50`, `GROK_CUSTO_IMAGEM_CENTAVOS=0`, `OPENAI_TXT_USD_MTOK=0.6`) não
  estão lá, mas o código já usa exatamente esses mesmos valores como padrão. Só
  vale mexer se algum desses preços mudar de verdade lá fora. Detalhe: esses
  campos são NÚMERO, e um valor entre aspas que chegue com as aspas vira lixo e
  cai no padrão de novo.

## 💡 Ideias e melhorias

- **DECISÃO SUA: o rascunho do Editor deve guardar as MÍDIAS também?**
  O Editor agora guarda o que você preencheu por 5 minutos, então F5 ou aba
  fechada por engano não perde mais nada do que foi digitado: ajustes, textos,
  cortes de cada cena e **as descrições das cenas** (que é o que custa crédito).
  O que NÃO volta sozinho são os arquivos de vídeo e foto: você escolhe eles de
  novo e o resto se encaixa sozinho, pelo nome e tamanho de cada um.
  Isso é limitação de onde o rascunho é guardado (o mesmo lugar do rascunho do
  Viral Boost, que só aceita texto e não aguentaria um vídeo de 300 MB).
  **Opção A - deixar como está:** você reescolhe os arquivos, o resto volta
  pronto. Simples e sem risco.
  **Opção B - guardar os arquivos também** (outra área do navegador, que aceita
  vídeo): aí a tela volta 100% pronta, sem reescolher nada. Custa mais código e
  tem um risco novo: navegador cheio pode recusar guardar um vídeo grande, e aí
  precisa de um plano B de qualquer jeito.
  **Recomendação: A por enquanto.** O que dói perder é a descrição das cenas
  (custa crédito) e os cortes, e isso já está resolvido; reescolher arquivo é um
  clique. Se você testar e sentir falta, a B é feita depois sem desfazer nada.

- **"Lore" (várias cenas) no Gerador de prompt.**
  Ideia: em vez de escrever 1 prompt de 1 cena só, a pessoa conta a história e
  escolhe quantas cenas quer (ex.: 3 vídeos de 15 segundos sobre o mesmo produto
  ou sobre a plataforma), e a IA escreve um prompt por cena com continuidade:
  mesma pessoa, mesma roupa, mesmo cenário, e a fala dividida em partes que
  encaixam uma na outra. Uso pretendido: **criativo de Facebook Ads** e
  **sequência de stories do Instagram**.
  Hoje NÃO existe: o gerador só escreve 1 prompt de 1 cena (6/10/15s) e cada
  geração é independente, então 3 vídeos seguidos não contam história nenhuma.
  Também falta a ponta final: o Editor automático só aceita arquivo do
  computador, então hoje seria gerar os 3, baixar e subir de novo na mão. Emendar
  as cenas em sequência o Editor **já sabe fazer** (é só não marcar clipe
  principal), então o render não precisa mudar.
  Custo: escrever os prompts é **grátis** pro usuário; o que pesa é gerar os
  vídeos (3 x 15s = 285 créditos, R$2,85). Se sair, mostrar esse total somado na
  tela ANTES de mandar gerar.
  Conversado com o dono em 05/08/2026. Caminho sugerido: primeiro a lore no
  gerador, depois o atalho "escolher dos meus vídeos" no Editor automático.

- **BYO key (chave própria do usuário).** ElevenLabs PRONTO, mas **GATED ("Em
  breve")**: a seção em `/painel/conta` está travada por `const BYO_LIBERADO =
  false` (`conta/page.tsx`). Pra liberar pros usuários, virar pra `true` (back-end
  já funciona: cifra em `lib/cripto.ts`, seletor busca `/api/voices`, worker usa a
  chave via env `ELEVEN_USER_KEY` sem debitar crédito da voz). FALTA: Gemini e
  Minimax (mesma estrutura). Minimax foi adiado.

- **Limpar o aviso órfão "biblioteca exclusiva pra assinantes" na tela de
  Créditos.** A tela `/painel/creditos` ainda mostra aquele aviso âmbar quando
  chega com `?bloqueio=biblioteca`. Só que a biblioteca agora mostra o erro NA
  PRÓPRIA tela (componente `BibliotecaBloqueada`) em vez de redirecionar pra
  Créditos, então ninguém mais chega lá por esse motivo e o aviso virou código
  morto. Remover o bloco `sp.bloqueio === "biblioteca"` em
  `src/app/(app)/painel/creditos/page.tsx` (e o `searchParams` `bloqueio` se não
  for usado em mais nada). Não é urgente, não atrapalha.

- **Atualizar a seção "Como os créditos funcionam" (aba Créditos).**
  Ela só fala de texto/áudio e BYO key; não menciona o sistema de níveis
  (bronze/prata/ouro), a liberação em duas partes (garantia da compra) nem o
  saldo devedor de reembolso. Atualizar os 3 cards em
  `src/app/(app)/painel/creditos/page.tsx`.

---

# HISTÓRICO (já resolvido, mantido como contexto)

Não apagar: aqui estão os motivos das decisões e as armadilhas descobertas.

- **06/08/2026: os arquivos do worker subiram pro serverrk.**
  `fabrica.py`, `gemini_copy.py`, `worker_serverrk.py` e `worker.py` foram copiados
  pra `/opt/viraliza-worker/app/` (md5 conferido, iguais aos do repo), os 3
  containers foram reiniciados com a fila vazia e voltaram normais. Backup do
  estado anterior (os 18 `.py`, com as datas originais) em
  `/opt/viraliza-worker/backup-20260806-050308-antes-edicao-avancada/`. Pra voltar
  atrás, se precisar: `cp -p /opt/viraliza-worker/backup-20260806-050308-antes-edicao-avancada/*.py /opt/viraliza-worker/app/`
  e reiniciar os 3 containers.
  **Efeito imediato em produção:** o site em produção ainda é a versão ANTIGA, mas
  o robô de render já é o novo. Como as melhorias de imagem vêm ligadas por
  padrão, os vídeos que a sua base gerar já saem com **zoom lento nas fotos,
  transição suave entre as cenas, foto de apoio limitada a 3 segundos e a IA
  escolhendo o melhor pedaço do vídeo de apoio**, mesmo sem o deploy do site. O som
  das cenas de apoio NÃO muda (nasce desligado, como antes). Se quiser que nada
  disso valha até o site subir, é só restaurar o backup acima.
  Esse pacote incluiu também o campo novo pra **descrever o vídeo principal**: a
  tela manda o texto, e quem usa essa frase pra encaixar as cenas e escrever a copy
  é o `fabrica.py` + `gemini_copy.py`, que já estão lá.

- **06/08/2026: `GEMINI_API_KEY` conferida na env de produção, está lá.**
  São 6 chaves no EasyPanel. As 3 primeiras são do formato antigo (`AIza...`) e já
  valem hoje, então análise de cenas do Editor, análise de produto do "Avatar com
  produto" e o plano B do Gerador de prompt estão ligados em produção. As outras 3
  são do formato novo (`AQ....`) e o site velho as ignora: elas só entram no
  rodízio depois do deploy (a correção que aceita esse formato está na sua máquina,
  não no ar). Lembrete: site e worker chamam o Google separado, a chave precisa
  estar no `.env` da raiz E no `bot shopee/.env`.

- **06/08/2026: `META_ADS_TOKEN` e `META_ADS_ACCOUNT_ID` postos na env de
  produção**, com os mesmos valores do `.env` local (conta BM VIRALIZA). O
  `GROK_CUSTO_10S_CENTAVOS` foi junto. A parte do site que mostra o card
  "Anúncios" da aba Finanças já está no ar desde o commit `aab59a0`.
  Se um dia o card der erro, o token se recria em business.facebook.com >
  Configurações do negócio (BM Viraliza) > Usuários > Usuários do sistema > admin >
  Adicionar ativos (a conta de anúncios, acesso total) > Gerar novo token > marcar
  `ads_read`. Esse tipo de token não vence sozinho.
  Nada a ver com `META_PIXEL_ID`/`META_CAPI_TOKEN`, que são pra atribuição de venda
  e seguem sem configurar. Obs.: o gasto de anúncios **ainda não entra no "Lucro
  real"** do painel, é card separado.

- **06/08/2026: `CAKTO_CHECKOUT_ASSINATURA` posto na env de produção.**
  Com ele, o botão da aba `/painel/assinatura` deixa de mostrar "renovação ainda
  não disponível" e passa a levar direto pro checkout da Cakto. A página já lê a
  variável desde o commit `aab59a0`.

- **06/08/2026: `OPENAI_ADMIN_KEY` posta na env de produção.** Com ela o card da
  OpenAI mostra a fatura REAL em vez de "estimado" (é a única API com gasto
  retroativo; as outras começam a contar do dia que entrarem no ar).

- **06/08/2026: `LLM_BASE_URL`, `LLM_API_KEY` e `LLM_MODEL` estão em produção.**
  O robô de suporte (a boinha de ajuda no canto de baixo do painel) e o Minerador
  usam o SEU servidor de LLM (qwen2.5:14b no Ollama + Open WebUI), então não custa
  nada por chamada. Obs. de segurança: a chave `sk-...` do Open WebUI já foi
  enviada por chat mais de uma vez; se esse histórico sair da sua máquina, vale
  gerar outra no Open WebUI.

- **Pagamento integrado (Cakto, migração da Kiwify).** O botão "Comprar" da tela
  de Créditos não é mais placeholder: abre o checkout da Cakto já com o e-mail do
  usuário como sugestão (o crédito casa pelo e-mail que a pessoa usar na compra).
  Os 4 links (`CAKTO_CHECKOUT_10/20/50/100`) estão em produção, com os da Kiwify
  ainda de reserva no código.

- **04/08/2026: worker instrumentado de verdade.** O `uso.py` existia mas NADA
  chamava ele (consumo.json nunca era gravado; todo job caía no preço fixo).
  Agora: `gemini_copy.py` (9 chamadas), `narrar_video.py`, `veo_gen.py` (segundos),
  `cortar_youtube.py` e `fabrica.py`/`worker.py` gravam e enviam o consumo. Além do
  débito, tudo vira linha na tabela `GastoApi` (aba Finanças, gasto por
  API/usuário).

- **05/08/2026: preços das 3 ferramentas SEM IA, definidos pelo dono.**
  Ficam em `CREDITOS_FIXO` (`src/lib/precos.ts`), e as telas e a ajuda LEEM dessa
  constante em vez de repetir o número na mão:
  - **Marca em lote: 5 créditos POR VÍDEO** carimbado (era 50). Lote cheio de 12
    vídeos saiu de R$6,00 pra R$0,60.
  - **MapsLeads: 50 créditos por busca (MANTIDO).** Foi questionado se fazia
    sentido cobrar por algo que não usa API; as opções levantadas foram manter,
    virar de graça com limite diário, ou virar benefício de assinante. O dono
    escolheu manter. **Não reabrir esse ponto sozinho.**
  - **Editor automático no modo "Nenhum": 30 créditos** (era 50). Vale só quando
    o vídeo não consome IA nenhuma; com IA continua sendo pelo consumo real.
  Junto disso, a tela do Editor foi corrigida: no modo "Nenhum" ela mostrava uma
  estimativa por segundo (2/seg) e prometia MENOS do que seria cobrado em vídeo
  curto. Agora mostra o valor fixo exato.

- **04/08/2026: APIs do "Cortes", respondido.** `cortar_youtube.py` usa yt-dlp
  (grátis) + faster-whisper LOCAL pra transcrever (grátis) + UMA chamada Gemini
  pra escolher os momentos (essa é o único custo de API, agora medida e reportada
  no consumo). `legendar_video.py` também é local.
