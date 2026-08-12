## Claude 3 | inicio: 2026-08-12 17:37 (era "Claude 2 das 17:37"; renumerei ao ver a colisao com o Claude 2 das 17:38)
- investigacao git a pedido do dono (o que o main do Lucas tem que aqui nao
  tem). Somente leitura: fetch + log/diff, nenhum arquivo do projeto tocado.

## Claude 1 | inicio: 2026-08-12 17:10 (atualizado 17:50)
- ocioso. ENTREGA 2: tom padrao do Editor virou EQUILIBRADO (era agressivo), em
  TRES lugares do site: `editor-estudio.tsx` (o estado inicial, que e o que a
  pessoa ve), `api/jobs/route.ts` (fallback de pedido montado por fora) e
  `lib/jobs.ts` (fallback de job antigo sem tom gravado). Nenhum texto de ajuda
  citava qual era o padrao, entao nada ficou mentindo.
- NOTA (Claude 1): os DOIS workers e o `gui.py` seguem com `'agressivo'` de
  fallback, DE PROPOSITO. No worker (`job.get('tom', 'agressivo')`) esse padrao
  e inalcancavel: o `lib/jobs.ts` sempre manda a chave preenchida. Mexer neles
  obrigaria a reiniciar os 3 containers por zero mudanca de comportamento, e o
  deploy de hoje e so `fabrica.py` + `gemini_copy.py`. O `gui.py` e o app local
  do dono, outra ferramenta, nao a plataforma.
- ENTREGA 1: gancho da legenda palavra-por-palavra agora pega a primeira FRASE,
  nao a primeira palavra. Arquivos liberados: `bot shopee/fabrica.py`,
  editor-estudio.tsx. `py_compile` ok, `npx tsc --noEmit` limpo, 11 casos em
  `teste_gancho.py` (scratchpad) incluindo o ASS de verdade escrito em disco.
- CAUSA: `ass_montagem` marca `estilo = "Gancho" if k == 0` (caixa preta, letras
  amarelas, pra parar o scroll). Com `estilo_leg == "palavra"` cada bloco e UMA
  palavra, entao o bloco 0 era uma palavra solta dentro da caixa.
- COMO FICOU: `_gancho_em_frase(blocos)` junta os primeiros blocos ate o fim da
  1a frase (`.!?`) ou ate `GANCHO_MAX_PALAVRAS = 6`, o que vier antes. Chamado
  em DOIS lugares, os dois caminhos que geram legenda da fala: narracao
  (`_montar_sequencial`, depois do `agrupar_em_frases`) e transcricao
  (`_montar_com_principal`, depois do `_frases_legenda`). **Mexeu num, mexa no
  outro.**
- NOTA (Claude 1): o teto de 6 palavras nao e chute, e o mesmo que a copy da IA
  segue nas legendas de tela ("max ~6 palavras", REGRAS DE FORMATO do
  `gemini_copy.py`). Gancho e chamada curta, nao paragrafo.
- **PYTHON PENDENTE DE DEPLOY: so o `fabrica.py`** (soma com as outras mudancas
  do dia; ver reminder.md).

## (registro anterior desta MESMA sessao, 14:00-16:05)
- ocioso (4a entrega: AVISO na narracao de que o video vai ser cortado no
  tamanho da fala). Arquivos liberados: editor-estudio.tsx, lib/montagem.ts.
  `npx tsc --noEmit` limpo, eslint nos MESMOS 3 pre-existentes, e a conta do
  alcance testada com tsx (`teste_narracao.ts` no scratchpad, 6 casos).
- COMO FICOU: `NARRACAO_IA_SEG = [12, 18]` e `segundosDaNarracao(texto)` novos em
  `lib/montagem.ts`; o `Plano` (componente SO da narracao) ganhou `falaPor` +
  `roteiroFala` e desenha duas tarjas ambar: "vai ser cortado" (midias somam mais
  que a fala) e "ultimo quadro congela" (somam menos). As cenas que nao entram
  aparecem APAGADAS e riscadas na tirinha.
- ARMADILHA (Claude 1): o `NARRACAO_IA_SEG` e espelho do pedido que a fabrica faz
  a IA em `gemini_copy.py` ("texto falado natural de ~12 a 18 segundos", so no
  formato voz). **Mexeu no pedido la, mexa aqui**, senao a tela promete um
  tamanho e o render entrega outro.
- NOTA (Claude 1): o `PALAVRAS_POR_SEG = 2.5` e ESTIMATIVA (locucao ~150 ppm),
  nao ha constante equivalente no codigo do render: o tempo real so existe
  depois do TTS (`gerar_voz_com_tempos`). Por isso a tela fala "perto de".
- ENTREGUE (5a): na narracao as cenas DIVIDEM o tempo da fala em vez de o video
  ser cortado no fim, e a IA escolhe o melhor pedaco de cada uma. O dono escolheu
  as duas opcoes recomendadas: a escolha acontece NO RENDER (sem passo novo na
  tela) e o tempo e dividido PELA FALA (a IA diz ate que frase cada cena fica).
  Arquivos: `bot shopee/fabrica.py`, `bot shopee/gemini_copy.py`,
  editor-estudio.tsx, lib/montagem.ts. Testado com dubles: 10 casos em
  `teste_plano_cenas.py` (scratchpad). `npm run build` passou.
- ENTREGUE (6a, pedido do dono logo depois): midia MAIS CURTA que a fala agora
  faz o video REPETIR do comeco em vez de congelar o ultimo quadro. Mesmo
  `_plano_das_cenas`, ramo `soma < total`. Teto `MAX_CENAS_MONTAGEM = 40` conta
  repeticoes (0,4s de midia com 60s de fala daria 150 entradas no ffmpeg).
- ARMADILHA (Claude 1): com o loop, **o plano deixou de ser 1 pra 1 com a lista
  de clipes** (clipe repetido aparece varias vezes, cena que nao coube some).
  Por isso ele passou a devolver `(clipe, dur, inicio)` e o `_montar_sequencial`
  reatribui `clipes` a partir dele. Quem for mexer: nao volte a indexar o plano
  pela posicao do clipe original.
- ARMADILHA (Claude 1), a maior desta rodada: **a ordem do `_montar_sequencial`
  INVERTEU**. A voz agora e gerada ANTES de montar as entradas do ffmpeg, porque
  e ela que decide quanto tempo cada cena fica. Antes dava pra gerar depois
  porque o unico ajuste possivel era cortar o fim. Mexeu ali: `durs`, `ins` e
  `cortes` dependem do `plano`, e `clipes` e REATRIBUIDO (cena com duracao 0 sai
  da lista, senao entraria no ffmpeg como entrada sem quadro).
- ARMADILHA (Claude 1): o `ss` do som original passou a sair do PLANO, nao do
  `in` do clipe. Sem isso a imagem vinha de um trecho e o audio de outro.
- ARMADILHA (Claude 1): com MAIS CENAS QUE FRASES o rodizio pedia a frase 9 de
  uma fala que tem 6 e o render morria. Achei isso montando o teste, antes de
  rodar. Tem saida propria agora (divide por igual), e o `_cortes_por_frase`
  ganhou clamp de indice por cima disso.
- NOTA (Claude 1): `_cortes_por_frase` NUNCA confia na IA (indice fora da faixa,
  repetido ou fora de ordem viraria duracao negativa). O teste cobre o caso de a
  IA devolver lixo puro.
- NOTA (Claude 1): a chave `trechoInteligente` da etapa 4 virou o liga/desliga da
  parte CARA na narracao (desligada = zero chamada de IA, divisao por igual). O
  rotulo dela passou a mudar por modo: na narracao nao existe "apoio".
- (3a entrega) a fabrica descrevia cenas com IA a toa quando a fala e
  escrita pela pessoa. `py_compile` ok e testado de verdade
  com dubles (6 casos, script `teste_descricoes.py` no scratchpad da sessao).
- CAUSA: `processar` passava `com_copy` pro `completar_descricoes`, e `com_copy`
  significa "este job TEM copy" (formato voz/legenda), nao "a IA vai ESCREVER a
  copy". Com `roteiro_fala` preenchido o `gerar_copy` e pulado logo abaixo,
  entao o `contexto_cenas` nao tinha leitor nenhum: descrevia e jogava fora.
- COMO FICOU: `copy_da_ia = com_copy and not (fala_propria and formato ==
  "voz")` no chamador, e o `completar_descricoes` ganhou o guarda `tem_base`
  (sem clipe principal o video e sequencial e a descricao NAO e usada em lugar
  nenhum: `_montar_sequencial` nao chama `planejar_apoios`/`plano_broll` nem
  `_inicio_apoio`). Os dois juntos: so descreve quem vai ser LIDO.
- ARMADILHA (Claude 1): o guarda antigo era `if not com_copy and c.get("entra")
  is not None`, que **so protegia cena com momento fixo**. Na narracao o `entra`
  e sempre nulo (as midias tocam em sequencia), entao ele nunca pegava. Por isso
  o `tem_base` foi preciso: trocar so o valor do flag NAO resolveria.
- NOTA (Claude 1): `roteiro_fala` so existe na narracao. A rota `api/jobs` so
  aceita ele com `formato === "voz"` e recusa `voz` quando ha clipe principal
  (400). Ou seja o caminho corrigido e exatamente "narracao + Eu escrevo".
- **PYTHON PENDENTE DE DEPLOY: so o `fabrica.py`** (workers intocados). Sem o
  deploy nada quebra, producao so segue gastando a chamada de visao a toa.
- (entregas anteriores desta sessao abaixo; previa da cena centralizada no
  ajustes finos da etapa 5; e a PREVIA DO EDITOR recolhida no celular).
  Arquivos liberados. `npx tsc --noEmit` limpo, `npm run build` passou, eslint do
  editor-estudio segue com os MESMOS 3 erros pre-existentes (hoje 889/1304/1512;
  os 2 novos que eu tinha criado com efeitos foram desfeitos, ver abaixo).
- COMO FICOU (previa no celular, Opcao A escolhida pelo dono): o palco tem TRES
  casas e so uma existe por vez. (1) acima da timeline no editor PRO; (2) coluna
  da direita, SO no computador; (3) dentro do formulario, logo acima do
  Voltar/Continuar, fechada por padrao, atras do botao "ver a previa e cortar o
  clipe". Quem decide entre (2) e (3) e `telaGrande`, lido por
  `useSyncExternalStore` + `matchMedia` (mesmo idioma do `assinarRascunho`).
- ARMADILHA (Claude 1), a que importa aqui: **nao da pra esconder o palco com
  `hidden lg:block` sozinho.** CSS nao desmonta: os dois palcos ficariam montados
  e seriam DOIS `<video>` disputando a mesma `videoRef` (alem de decodificar em
  dobro). Por isso a escolha e em JavaScript. O `hidden lg:block` FICOU na casa
  (2), mas so pra cobrir o piscar ate a hidratacao: a resposta do servidor e
  "computador" de proposito, senao o desktop pintaria sem previa.
- ARMADILHA (Claude 1): a previa do celular e escondida por CSS, NAO desmontada.
  Desmontar devolvia o clipe pro quadro zero e, pior, deixava o `<video>`
  despejado tocando som por baixo. Fechar chama `pararPrevia()` (extraida do
  `togglePlay`) ANTES de esconder.
- NOTA (Claude 1): eu tinha resolvido isso com dois `useEffect` e o eslint
  reprovou com `react-hooks/set-state-in-effect` (2 erros novos). A regra vale:
  refiz tudo por evento (o clique do botao) e sem efeito nenhum. **Se for mexer
  aqui, nao volte pra efeito.**
- NOTA (Claude 1): as alcas verdes de cortar o clipe VIAJAM COM o palco (viraram
  o bloco `palcoComCorte`). Nao separe os dois: no celular isso e o unico jeito
  de cortar um clipe, e a tela trava o Gerar mandando cortar quando uma cena de
  apoio passa de 1 minuto. As 4 mensagens que mandam usar as alcas passaram a
  dizer "embaixo da previa".
- NOTA (Claude 1): a previa aberta SEGUE aberta nas etapas seguintes, de
  proposito (abrir foi pedido explicito; fechar e o mesmo toque). Se o dono
  quiser que cada etapa comece fechada, o lugar e o `setPasso`, NAO um efeito.
- NOTA (Claude 1): o painel de ajustes finos e `flex flex-wrap`, e quem manda na
  quebra e a largura do PAINEL, nao a da tela. Por isso a centralizacao entrou
  como `justify-center` puro, sem `sm:`: quando a previa (192px) e a coluna de
  texto (`min-w-[12rem] flex-1`) cabem lado a lado, o `flex-1` come a sobra e o
  justify nao muda NADA; so quando quebra e que a previa fica sozinha na linha e
  o centro aparece. Mexeu na largura da previa ou no `min-w` da coluna, e o
  ponto de quebra que muda.

## Claude 4 | inicio: 2026-08-11 (atualizado: v2 entregue)
- ocioso (V2 DO PAINEL ENTREGUE: a etapa 5 virou TIMELINE UNICA estilo editor,
  previa ACIMA da timeline com agulha e scrub, linha 1 = principais SO VISUAL
  com clique-pra-pular, linha 2 = apoios arrastaveis com ima + alcas, painel de
  ajustes finos da cena selecionada com FaixaTrecho e "abrir nas midias"; a
  lista de cartoes por cena MORREU e a coluna da direita some na aprovacao).
  Todos os arquivos liberados. `npx tsc --noEmit` limpo; eslint do
  editor-estudio segue com os MESMOS 3 erros pre-existentes (848/1263/1471).
- ARMADILHA (Claude 4, v2): o palco (player) agora mora em DOIS lugares via a
  variavel `palcoBox` (coluna direita nas etapas 1-4, acima da timeline na
  aprovacao). So um e desenhado por vez, mas a troca REMONTA o <video>: o
  efeito de `previewNaTimeline` conserta currentTime/volume. E o pulo de
  agulha usa `seekPendente` porque o efeito do palco poe `inSec` no
  currentTime quando o src troca - setar direto seria engolido.
- NOTA (Claude 4, v2): `Plano` agora e SO da narracao; `ReguaCena` foi
  APAGADA (virou os blocos do TimelineEditor).
- VISUAL (Claude 4, rodada 4, pedido do dono): timeline com MINIATURA nos
  blocos de apoio (video usa `#t=` do pedaco escolhido e recarrega sozinho
  quando o trecho muda), linhas INVERTIDAS (apoio em cima) e a base virou UM
  bloco "Video base" sem nomes de arquivo (tocar/arrastar nele esfrega a
  agulha, mesmos handlers da regua). Textos de ajuda/robo re-alinhados.
- BUGFIX (Claude 4, rodada 3, relatada pelo dono): TUDO precisa seguir a
  agulha, nao so o video base. (a) overlay do apoio virou `ApoioOverlay` com
  ref: `autoPlay` de atributo so vale na MONTAGEM do elemento, entao play do
  meio da cena deixava o quadro congelado e o scrub nao mexia na imagem;
  tocando, so desvio > 0.4s reposiciona (corrigir sempre travaria a
  reproducao). (b) musica: `seekGlobal`/`togglePlay` poem
  `currentTime = tGlobal * velocidadeMusica % duracao` (a conta do loop do
  render) em vez de sempre 0. (c) fim do video com painel aberto chama
  `seekGlobal(0)`: sem isso o proximo play partia do fim com musica muda.
- (entrega anterior desta sessao mantida abaixo; o motor dura/ima/trecho e da
  fabrica continua valendo identico na v2)
- ocioso (painel de editor da etapa 5 ENTREGUE: mover com ima anti-sobreposicao,
  alcas de tamanho e faixa de pedaco do arquivo, direto na aprovacao). Todos os
  arquivos liberados. `npx tsc --noEmit` limpo; eslint dos mexidos limpo (os 3
  erros do editor-estudio.tsx sao os MESMOS pre-existentes, hoje em
  828/1243/1451); `py_compile` ok. Testado com script de verdade nas DUAS pontas
  (tsx na montagem.ts, python importando a fabrica): 18+21 asserts, tudo ok,
  incluindo a paridade tela/render.
- COMO FICOU (resumo; o detalhe esta no !projeto.md, item "PAINEL DE EDITOR"):
  campo novo `dura` no roteiro (tamanho manual da cena na tela, Opcao A do dono:
  o manual MANDA no render, piso unico DURA_MANUAL_MIN=0.5s nos DOIS lados);
  `useArrastarNaRegua` ganhou gestos esq/dir (alcas) e o ima
  (`vaosLivres`/`acomodarNosVaos`); `FaixaTrecho` edita o `trecho` sem voltar
  pra etapa 3; rota posicionar aceita cena manual < piso automatico via flag
  `manual`. Edicao no painel NAO caduca o posicionamento (dura/trecho/entra
  ficam fora da assinaturaMontagem de proposito).
- **PYTHON PENDENTE DE DEPLOY: so o `fabrica.py`** (de novo; workers intocados,
  eles copiam o roteiro cru). Sem deploy nada quebra: o render so ignora o
  tamanho manual e encolhe pro automatico. Ja anotado no reminder.md.
- ARMADILHA (Claude 4): o piso por tipo virou piso POR CENA em QUATRO espelhos:
  `planejarApoios` (montagem.ts), `encaixar` (api/editor/posicionar),
  `planejar_apoios` (fabrica) e a validacao de entrada da propria rota. Cena
  manual usa DURA_MANUAL_MIN; sem o flag `manual` na rota, o "Posicionar de
  novo" DERRUBAVA a cena redimensionada pra menos de 2s e o pedido inteiro
  falhava com "nao consegui encaixar todas as cenas".
- NOTA (Claude 4): o passo a passo da etapa 5 foi atualizado nos 4 lugares de
  sempre (tela, ajuda-videos, suporte-guia, suporte-base). Os travessoes que a
  varredura acusa em fabrica.py (linhas ~378-745) sao PRE-EXISTENTES de rodadas
  anteriores, nao desta.

## Notas do registro anterior do Claude 1 (sessao de 2026-08-11 encerrada, mantidas como contexto)
- ocioso (entregou as tarefas 21, 31, 33, 35, 36 e 37 do !executar.md; versoes
  enxutas na secao de concluidas). Todos os arquivos liberados. `npx tsc
  --noEmit` limpo; eslint limpo nos arquivos mexidos (os 3 erros do
  editor-estudio.tsx sao os MESMOS de antes, so mudaram de linha: 761/1056/1263;
  o Date.now() da conta/page.tsx:56 tambem ja existia). `py_compile` ok.
- A tarefa 29 (validade 90 dias por pacote) FICOU DE FORA de proposito: exige
  migracao de banco (proibida sem autorizacao) e tem 3 "DECIDIR COM O DONO" sem
  resposta. Nota escrita no proprio !executar.md. DETALHE: com a tarefa 35 a
  liberacao gradual morreu, entao a duvida "90 dias contam da compra ou da
  liberacao" se resolveu sozinha (agora e a mesma data).
- **PYTHON PENDENTE DE DEPLOY: so o `fabrica.py`** (workers NAO mudaram nesta
  rodada; nao precisa reiniciar container por causa deles, mas o bind mount +
  restart do container da fabrica vale como sempre). Sem deploy nada quebra: o
  render segue com o comportamento antigo (corte impreciso, apoio com faixa,
  APOIO_MIN antigo etc.).
- ARMADILHA (Claude 1), a mais importante da rodada: **a tarefa 31 pedia "-ss
  depois do -i" no ffmpeg, e isso NAO EXISTE no CLI** - opcao depois de um -i
  vale pro PROXIMO arquivo da linha, entao o exemplo literal do enunciado
  desligaria o corte de um input e cortaria o vizinho. A implementacao que
  entrega a INTENCAO (decodificacao precisa) e: -ss de entrada mirando
  SEEK_FOLGA=2s ANTES do alvo + trim/atrim exato dentro do filtro (decoder
  aquece na folga; keyframe e priming do AAC deixam de deslocar o corte).
  Validado com ffmpeg real: pedacos de video e audio com 3.000s exatos.
- NOTA (Claude 1): a reforma dos niveis (35) NAO apagou o motor de
  subida/queda de nivel - ele segue rodando como semente da gamificacao
  (proposta em `gamificacao-proposta.md` na raiz). O que morreu: teto diario,
  simultaneos por nivel (agora SIMULTANEOS_UNIVERSAL=5 pra todo mundo) e a
  quarentena de compra (100% na hora). `aplicarLiberacoesVencidas` continua na
  varredura SO pra escoar o legado; quando zerar, vira no-op.
- NOTA (Claude 1): "mexeu em limite/brinde, cace o numero cru" valeu DE NOVO:
  os limites de nivel estavam escritos em 8 lugares (suporte-base, mais os
  NUMEROS EXATOS e DOIS exemplos de resposta do proprio prompt, suporte-prontas,
  nivel-card, ajuda-comecar, ajuda-conta, conta/page). Todos passaram a citar a
  regra universal.
- NOTA (Claude 1): entrada dos jobs agora fica 24h em `data/uploads` (tarefa
  21). Quem apaga e `limparEntradasVencidas` na varredura de 10min do
  instrumentation.ts (job em status ativo NUNCA perde a entrada; excluir o video
  segue apagando na hora). Rota nova `GET /api/jobs/[id]/entrada/[arquivo]`
  serve a midia SO pro dono logado (stream, sem carregar o arquivo em memoria).
  No envio do reuso viajam so NOMES (`reusarEntradaDe` + `reusarArquivos`) e o
  servidor copia disco a disco - aceitar caminho/URL da tela seria SSRF, mesmo
  motivo do "Cortar".
- NOTA (Claude 1): o grafico-vendas.tsx virou "use client" (seletor
  Total/Separado/Assinaturas/Creditos). O tipo `DiaVendaGrafico` e copia local
  do `DiaVenda` do financas.ts DE PROPOSITO (financas e server-only; mesmo
  padrao do financas-usuarios.tsx). Mexeu num, mexa no outro.
- NOTA (Claude 1): recorrencia de assinante no /admin usa `bonus_assinatura`
  com kiwifyOrderId preenchido = renovacao PAGA (mesmo criterio da promocao pro
  Ouro); reembolso de assinatura = estorno com descricao "Reembolso da
  plataforma...". Admin/demo ficam fora das contas.

## Claude 2 | inicio: 2026-08-12 17:38 (atualizado 18:30)
- AVISO (12/08/2026): o dono pediu pra RESETAR o auditoria.md, ficou SO o bug
  #42 (imagem Lab/Boost subcobra em paralelo), pra verificacao depois. O
  catalogo inteiro (bugs 1 a 62) esta no historico do git do arquivo; nao foi
  perdido, so tirado da vista.
- ocioso. CORRIGIDOS os bugs 36/37/40/51 (pedido do dono). #35 REMOVIDO do
  auditoria.md (decisao do dono: nao e bug; numero 35 nao sera reaproveitado).
  Arquivos liberados: worker/concluir (36:
  `debitarJob` ganhou `faltaViraDivida`), src/middleware.ts (37: reescreve os
  enderecos crus pra /api/midia), api/reportes (40: guard de estorno duplicado
  por job), lib/reembolsos.ts (51: `brindeDoPedido` no lugar de `totalBrinde`).
  `npx tsc --noEmit`, eslint dos 4 arquivos e `npm run build` limpos.
- ARMADILHA (Claude 2): o #37 depende do middleware INTERCEPTAR os caminhos de
  public/ (era como o #31 ja funcionava). Reescreve pra /api/midia; NAO adicionar
  /api/midia ao matcher, senao vira loop. voice-previews so exige login la.
- NOTA (Claude 2): `totalBrinde` continua exportado mas sem uso agora (so
  `brindeDoPedido` e chamado). Deixei pra nao arriscar quebrar uso externo.
- NOTA (Claude 2): o #51 corrigiu SO o excesso de credito removido; o
  desligamento da assinatura no reembolso foi mantido (politica existente).
- (abaixo: registro da varredura de auditoria desta mesma sessao)
- Nenhum arquivo de codigo tocado na varredura; so
  o `auditoria.md` (problemas 35 a 62 novos + reforco do 51). Todos verificados
  no codigo antes de catalogar (nada corrigido, so catalogo).
- NOTA (Claude 2): os achados que mais doem sao seguranca/dinheiro:
  #52 (qualquer produto Cakto sem "creditos" no nome libera a biblioteca - furo
  do #4 reaberto por upsells), #35/#36 (#28/#8 nunca cobriram o pipeline
  Grok/fabrica: excluir no meio volta+cobra, e da pra gerar caro com 1 credito),
  #37 (middleware so checa login, nao dono nem assinatura - o #31 mentia ao
  dizer que aplica a regra fina nos enderecos crus) e #38 (SSRF+path traversal
  em avatar/video, que reimplementou sem o helper `imagem-entrada.ts`).
- REGRA pra proxima IA: "mexeu numa blindagem (#8 reserva, #28 updateMany
  condicional, #31 gate de midia, dedup), confira TODOS os pipelines" - varias
  correcoes so entraram nas 3 rotas Grok de video e deixaram fabrica, cortes,
  imagem e os enderecos estaticos crus de fora.

## Notas do registro anterior do Claude 2 (2026-08-11, abandonado, mantidas como contexto)
- ocioso (varredura entregue). Nenhum arquivo de codigo tocado; so o
  `auditoria.md` (problemas 25 a 33 novos + complemento no 1).
- NOTA (Claude 2): o achado que mais dói e o 25 - a reforma dos niveis
  (SIMULTANEOS_UNIVERSAL=5) quebrou o lote de 12 videos. Regra pra proxima IA:
  **mexeu em limite global, cace quem chama a trava com `quantos > 1`** (hoje so
  o `api/lote-acervo`).
- NOTA (Claude 2): o `!projeto.md:211` afirma que TODAS as rotas de video tem a
  trava anti-cobranca-dupla. Nao tem: `api/avatar/video` (Novo influenciador e
  Video livre) esta sem. Problema 26.

## Claude 3 | inicio: 2026-08-11 14:12 (atualizado 15:20)
- TAMBEM entregue: revisao do `!projeto.md` a pedido do dono (marca AGUARDE
  ALTERANDO posta e ja retirada). Nao foi so a secao do bug: conferi o mapa
  contra o codigo e corrigi o que estava MENTINDO. O que estava errado:
  brinde de cadastro (dizia 1.000, `CREDITO_INICIAL` e 0), mensal da assinatura
  (dizia 2.000, e 3.000), modelo do Gemini (dizia 2.5 Flash, e
  `gemini-3.5-flash-lite` no site e 2.5 no `bot shopee/`), 26 models (sao 28),
  13 telas de admin (sao 15), instrumentation com 1 varredura (sao 4) e a
  **trava anti-cobranca-dupla dita como "todas as rotas de video"** (o achado do
  Claude 2: `api/avatar/video` esta sem, problema 26). Entraram tambem: preco da
  entrada confirmado em R$98,90, `lib/legal.ts` + as 3 paginas publicas com o
  bloqueio do CNPJ, o `scripts/backfill-gastos-api.mjs` e o que os documentos
  legais PROMETEM e o codigo nao faz (regra de reembolso na mao, 90 dias de
  validade que nao existem, compra antes do cadastro).
- ocioso (entregue). Bug do dono: corte de pausas desalinhava as cenas de apoio
  no Editor automatico. Catalogado como problema 34 do auditoria.md e CORRIGIDO
  na fabrica (opcao escolhida pelo dono: converter no render). Arquivos
  liberados: `bot shopee/fabrica.py`, `auditoria.md`, `!projeto.md`.
- CAUSA: a tela posiciona na linha do tempo COM as pausas (`durBase` = soma dos
  cortes, audio contínuo) e a fabrica remonta a base SEM as pausas
  (`_linha_da_base`), aplicando o `entra` aprovado nessa escala menor. As duas
  pontas nao tinham conversao de tempo. O desvio CRESCE ao longo do video
  (pausa cortada acumula take a take), por isso doi mais com varios principais.
- COMO FICOU: `_corte_da_base` (extraida, fonte unica do corte), `_linha_bruta`
  (a regua da tela), `_pra_linha_cortada` (traduz um segundo) e
  `_apoios_na_linha_cortada` (aplica nos apoios, em COPIAS: o roteiro original
  nao e mexido). Chamada em `_montar_com_principal` so quando
  `_silencio_min(cfg) > 0`. Os pedacos de `_linha_da_base` ganharam o campo `bi`
  (indice do principal): sem ele, o mesmo arquivo usado duas vezes com cortes
  diferentes era indistinguivel na hora de achar o pedaco.
- **PYTHON PENDENTE DE DEPLOY: so o `fabrica.py`** (workers intocados). Sem o
  deploy nada quebra, producao so continua com o desalinhamento de antes.
- TESTADO DE VERDADE com ffmpeg: dois videos sinteticos de 20s com fala/pausa
  alternadas, `_linha_da_base` real (silencedetect) e 9 momentos conferidos de
  volta pelo `_fatias_da_base`: **erro de 0 ms** nos 9, mais 3 casos de momento
  em cima de pausa (cai no comeco da fala seguinte) e a garantia de que sem
  corte de pausa nada muda. Script no scratchpad da sessao (`teste_conversao.py`).
- NAO RESOLVIDO de proposito (dono nao pediu, fica pra decisao dele): a regua da
  tela segue mostrando a duracao COM pausas (video final sai mais curto que o
  numero na tela) e o teto de 1 cena a cada 5s e recalculado na duracao cortada,
  entao corte agressivo ainda derruba as ULTIMAS DA LISTA (`apoios[:cabem]` em
  `planejar_apoios`, que poda por ordem de lista, nao por ordem de tempo).
- NOTA (Claude 3): `assinaturaMontagem` (editor-estudio.tsx:753) nao inclui o
  `cortarSilencio` e, com a conversao no render, NAO PRECISA mesmo: o `entra`
  fica sempre na escala bruta, entao mexer no corte de pausas depois de
  posicionar deixou de invalidar o posicionamento.

## Notas do registro anterior do Claude 3 (abandonado 2026-08-06 21:55, mantidas como contexto)
- ocioso (entregou a "opcao A": motivo REAL da falha do Google no Diagnostico).
  Arquivos liberados: `src/lib/gemini-vision.ts`,
  `src/app/api/editor/posicionar/route.ts`,
  `src/app/api/editor/descrever-cenas/route.ts`. `npx tsc --noEmit` limpo e
  eslint limpo nos tres. Testado DE VERDADE contra a API do Google, pelo dev
  server, por uma rota temporaria (ja apagada).
- COMO FICOU: o `gerar()` recebe uma `CaixaFalha` opcional e preenche
  `{cota, detalhe}` quando todas as chaves falham; as duas rotas do Editor
  passam a caixa e escrevem o motivo real no Diagnostico. Quem NAO passa caixa
  (avatar, gerador de prompt) segue identico. Falha de cota devolve 429 e a
  mensagem da tela deixa de dizer "tente de novo" (nao adianta, so vira amanha).
- **DESCOBERTA QUE IMPORTA MAIS QUE A TAREFA: o `gemini-2.5-flash` esta
  APOSENTADO PRA CHAVE NOVA.** O detalhe agora sai assim, medido:
  `chave 1: HTTP 429 - ... limit: 20, model: gemini-2.5-flash |
   chave 2: HTTP 404 - This model models/gemini-2.5-flash is no longer available
   to new users.` Ou seja, chave criada hoje NAO consegue usar o modelo que o
  projeto inteiro usa (`MODELO` em gemini-vision.ts e os `.py` da fabrica).
- **A cota de 20/dia e por PROJETO + MODELO, nao por projeto.** Testado: a MESMA
  chave velha que da 429 no `gemini-2.5-flash` responde 200 no `gemini-3.5-flash`
  no mesmo minuto. Trocar de modelo destrava na hora.
- **FEITO (dono aprovou 22:40): o MODELO do site virou `gemini-3.5-flash-lite`**
  (`MODELO` em gemini-vision.ts). Escolhido por PRECO: entrada/saida iguais ao
  2.5-flash ($0,30 / $2,50 por milhao) e o AUDIO a $0,30 em vez de $1,00, e o
  audio e o que pesa no "Posicionar cenas". Conferido pelo proprio site: volta
  com as posicoes e `diag` nulo.
- **MEDIDO, nao chutado: o lite acertou MAIS que o `gemini-3.5-flash` completo.**
  Teste com fala real (video de 75s de `public/videos/cmshnrv350006u6twilllov1j`,
  WAV 16k mono, o prompt `INSTRUCAO_POSICIONAR` lido do proprio codigo) e 3 cenas
  ancoradas em trechos conhecidos da fala: **lite = 1,7s de erro medio**
  (1,3 / 0,3 / 3,4), **flash completo = 5,7s** (errou 13s numa cena e voltou sem
  justificativa). O 2.5-flash nao entrou na comparacao: 429.
- NAO mexi nos modelos de IMAGEM, por decisao do dono. Eles sao do `bot shopee/`
  (`gemini-2.5-flash-image`, desligamento marcado pra 02/10/2026) e tem plano B:
  se a chamada falhar a fabrica usa a foto original, entao nada quebra.
- CORRECAO minha, pra ninguem repetir: **a imagem do Lab NAO usa API paga.** Ela
  vem do robo do Grok (`lib/imagem-robot.ts`, `GROK_INGEST_URL`), custo ~zero. Eu
  tinha dito ao dono que os 20 creditos da imagem davam prejuizo: ERRADO. O
  Gemini de imagem so aparece dentro da `fabrica.py` (marca d'agua, variante
  anti-duplicado e vestir modelo pro Veo).
- PENDENTE, nao aprovado ainda: a conta de custo do `precos.ts` esta errada em
  DOIS pontos, medidos na tabela oficial do Google. Audio do 2.5-flash e $1,00
  por milhao e o comentario da linha 47-53 usou $0,30; a saida de imagem e $30 e
  a `geminiImgPorMTokens` (linha 95) tem 15. So afeta o calculo de lucro da aba
  Financas, nao o que o usuario paga.
- NOVO: pasta `politicas/` com os 3 documentos em .txt (`termos-de-uso.txt`,
  `politica-de-privacidade.txt`, `politica-de-reembolso.txt`), extraidos das
  paginas de verdade pelo dev server. Sao pra colar no checkout da Cakto/MP.
  Cada um comeca com um bloco `[AVISO INTERNO]` porque o CNPJ ainda esta
  PENDENTE. Preencheu o `lib/legal.ts`, gere de novo.
- NAO mexi no `bot shopee/.env` de proposito: os `.py` (`gemini_copy.py`,
  `analisar.py`, `cortar_youtube.py`) tambem pedem `gemini-2.5-flash` e
  `gemini-2.5-flash-image`, entao chave nova la so daria 404.
- Investigou antes o erro "A IA nao conseguiu posicionar as cenas agora" do
  Editor etapa 5.
- CAUSA CONFIRMADA por chamada real na API: a `GEMINI_API_KEY` do `.env` da RAIZ
  e valida, mas o projeto Google esta com a **cota gratuita do dia estourada**
  (HTTP 429, `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, quotaValue 20
  pro `gemini-2.5-flash`). Sao 20 chamadas por DIA por PROJETO (nao por chave).
- ARMADILHA (Claude 3): o `gerar()` do `src/lib/gemini-vision.ts` faz
  `if (!res.ok) continue` e devolve "" quando TODAS as chaves falham, sem
  guardar o status nem o corpo do erro. Por isso as rotas do Editor anotam no
  Diagnostico "Gemini respondeu, mas nada aproveitavel", que e MENTIRA quando o
  caso e 429/400/403: o Gemini nem respondeu. Quem for depurar isso de novo:
  o erro real so aparece chamando a API na mao.
- NOTA (Claude 3): o `.env` da raiz tem UMA chave so; o EasyPanel tem 6. Se as 6
  forem do MESMO projeto Google, elas dividem a mesma cota de 20/dia, entao
  rotacionar chave nao resolve nada (a cota e por projeto+modelo).

## Notas do registro anterior do Claude 1 (abandonado 18:20, mantidas como contexto)
- ocioso (entregou as 3 paginas legais + os links). Todos os arquivos liberados.
  `npx tsc --noEmit` limpo; eslint limpo nos arquivos mexidos (o unico erro e o
  `Date.now()` da `assinatura/page.tsx:36`, que JA EXISTIA: conferido com
  `git show HEAD`, meu diff so envolve o JSX num `div`). As 3 rotas testadas de
  verdade no dev server: 200 nas tres e os links aparecem no /login.
- NOTA (Claude 1, 18:35): os 3 documentos ganharam atalho VERMELHO no fim da
  barra do admin (`docsLegaisItems` + prop `perigo` do `Item`, em
  `nav-links.tsx`). Vermelho de proposito: sao paginas PUBLICAS, nao telas de
  admin, e misturar as duas coisas no mesmo menu confunde. Elas ficam FORA do
  layout `(app)`, entao clicar sai do painel e a barra some (a volta e pelo
  "Voltar pro inicio" no rodape do documento).
- NOVO: `/termos` e `/reembolso` (nao existiam) e a `/privacidade` reescrita
  (versao 2.0). Os dados da empresa e as VERSOES dos documentos moram em
  `src/lib/legal.ts`, num lugar so, porque os tres repetem os mesmos campos.
- **BLOQUEIO: as 3 paginas NAO PODEM IR PRO AR ainda.** Falta razao social, CNPJ
  e endereco. Enquanto `EMPRESA.razaoSocial/cnpj/endereco` estiverem `PENDENTE`
  em `src/lib/legal.ts`, as tres mostram uma tarja vermelha no topo dizendo isso.
  Preencheu os 3 campos, a tarja some das tres sozinha. Foi feito assim de
  proposito, pra ninguem publicar sem querer uma pagina com "PENDENTE" no CNPJ.
- ARMADILHA (Claude 1), a que importa aqui: **documento legal so vale se a pessoa
  pode ler ANTES de pagar** (art. 46 do CDC). E o Viraliza tem um problema de
  ordem: `podeCriarConta` (actions/auth.ts) exige a compra ANTES do cadastro,
  entao a pessoa **paga sem ver tela nenhuma do site**. Os links que pus no
  login/cadastro/Creditos/Assinatura cobrem a relacao dai pra frente, mas a
  primeira compra so fica coberta configurando os links **no checkout da Cakto e
  do Mercado Pago**. Isso e painel, nao e codigo, e esta no `reminder.md`.
- NOTA (Claude 1): o Mercado Pago **nao tem** campo de "termos do vendedor" no
  Checkout Pro (e gateway, nao plataforma de infoproduto: a personalizacao dele e
  so aparencia + dados da preferencia). Quem tem esse campo e Cakto/Kiwify/
  Hotmart. No MP o caminho certo e Checkout Transparente (Bricks), com o aceite
  na propria pagina do Viraliza antes do botao de pagar. Plano do dono: MP pra
  assinatura, Cakto pro primeiro pagamento vindo de afiliado.
- NOTA (Claude 1): os documentos **nao citam preco nem quantidade de credito de
  proposito** ("o valor vigente informado no checkout"). O dono disse que o preco
  vai mudar, e documento legal com numero velho vira mentira. Detalhe pendente
  anotado no reminder: ele falou 4.000 creditos na assinatura e o codigo esta com
  2.000 (`CREDITO_MENSAL_CENTAVOS`).
- AJUSTE do dono no chat (19:25, corrigido as 21:20): **brinde mensal da
  assinatura = 3.000** (`CREDITO_MENSAL_CENTAVOS`, era 2.000) e **so o crédito de
  BOAS-VINDAS do cadastro foi desligado** (`CREDITO_INICIAL` foi de 1.000 pra 0,
  em `lib/registro.ts`). Nada apagado: religa trocando o numero de volta.
  - **O bonus de seguir o Instagram CONTINUA VALENDO, intocado** (300 creditos,
    `lib/promos.ts`). Eu tinha desligado ele por ler errado o pedido do dono
    ("o bonus de seguir no insta nada mais" era ele LISTANDO o que existe, nao
    "nao tem mais") e revertí com `git checkout` nos 3 arquivos
    (`promos.ts`, `bonus-instagram.ts`, `modal-instagram-bonus.tsx`), que estao
    identicos ao HEAD. **Se algum Claude vir mencao a `BONUS_IG_ATIVO`, e lixo de
    nota antiga: essa constante nao existe.**
  - Sobraram DOIS brindes: mensal da assinatura + bonus do Instagram.
- ARMADILHA (Claude 1): mexer em brinde/preco **nao acaba no `lib/`**. Os numeros
  estavam escritos NA MAO em `ajuda-comecar.tsx` e em DOIS pontos do
  `suporte-base.ts` (o robo de suporte), e o `assinatura-painel.tsx` dizia
  "credito nao vence", o que passou a contradizer os 90 dias dos Termos. Todos
  passaram a LER as constantes (`CREDITO_MENSAL_CENTAVOS`,
  `CREDITO_VALIDADE_DIAS`) em vez de repetir o numero. **Mexeu em preco ou
  brinde, procure o numero cru em `components/` e em `suporte-base.ts`.**
- **CORRECAO DE PRECO (dono, 19:10): a assinatura e R$98,90, NAO R$19,90.** O
  R$19,90 que aparece em comentario de codigo (webhooks Cakto/Kiwify,
  `reembolsos.ts`, `kiwify.ts`) e resquicio do preco antigo e NAO deve ser usado
  como fonte. Eu tinha feito uma conta de margem em cima do R$19,90 e concluido
  "prejuizo": **errado**. Com R$98,90 sobra R$58,90 (4.000 creditos) ou R$78,90
  (2.000). Corrigido no `reminder.md` e na memoria do projeto.
- AJUSTE do dono no chat (19:05): **pacote de credito vale 90 dias** e o gasto
  sai do pacote mais VELHO pro mais novo. Isso NAO existe: o saldo e um numero so
  (`User.saldoCentavos`), sem lote e sem vencimento. Ja esta ESCRITO nas
  politicas (constante `CREDITO_VALIDADE_DIAS` em `lib/legal.ts`) e a
  implementacao virou a **tarefa 29** do `!executar.md`, por pedido do dono, pra
  outra IA fazer. Enquanto nao sair, o documento e MAIS generoso que a realidade
  (hoje credito nao vence), entao ninguem e prejudicado.
- AJUSTE do dono no chat (18:50): o teto subiu pra **80%** e a assinatura passou
  a ser **proporcional igual ao pacote** (gastou 50%, volta 50%; gastou 90%, nao
  volta nada). Antes a assinatura devolvia integral abaixo do teto. Uma regra so
  pros dois agora. O teto tambem foi REDIGIDO de outro jeito: nao e punicao, e
  que abaixo daquele residuo a devolucao nao paga o custo de processar. Como a
  devolucao ja e proporcional, essa e a unica justificativa que se sustenta.
- ATENCAO (Claude 1): a regra de reembolso escrita na `/reembolso` (7 dias, sem
  devolucao acima de 80% de consumo, proporcional abaixo disso) **nao existe em
  codigo nenhum**. Hoje ela e aplicada NA MAO por quem decide o reembolso no
  painel da processadora. O `src/lib/reembolsos.ts` so trata o DEPOIS (perde
  brinde, preserva comprado, chargeback bloqueia login), e isso continua igual.
  Se um dia virar automatico, a constante ja esta em `lib/legal.ts`.
- **CORRECAO (Claude 2, 17:20): o registro das 16:25 NAO estava abandonado, era
  eu.** A sessao era longa (7 tarefas) e eu esqueci de atualizar o horario, entao
  a regra dos 30 min disparou por engano. **As tarefas 22, 23, 24, 25, 26, 27 e
  28 estao TODAS concluidas e validadas** (ver a secao de concluidas do Claude 1
  no `!executar.md`). Nada ficou pela metade. Passei pro numero 2 e o bloco
  abaixo e o meu, atualizado.

## Claude 2 | inicio: 2026-08-06 17:20 (era o "Claude 1 das 16:25")
- ocioso (entregou 22, 23, 24, 25, 26, 27 e 28; a 21 ficou de fora por pedido do
  dono). Todos os arquivos liberados. `npx tsc --noEmit` limpo e o eslint dos
  arquivos mexidos limpo (o `editor-estudio.tsx` tem 3 erros de regra de hooks,
  IGUAIS aos de antes desta rodada: conferido com git stash).
- **PYTHON PENDENTE DE DEPLOY, os TRES:** `fabrica.py`, `worker.py` e
  `worker_serverrk.py`. Sem o deploy: a cena de apoio fora do 9:16 segue com
  faixa preta tapando a base, a legenda sai sempre em frase inteira (o estilo
  "palavra por palavra" chega e e ignorado), o video que pediu legenda continua
  saindo mudo de legenda quando o whisper falha, e o erro que chega no
  Diagnostico continua curto. **Nada quebra**: os workers ignoram chave que nao
  conhecem. Os WORKERS mudaram desta vez, entao PRECISA reiniciar os containers.
- ARMADILHA (Claude 2), a pior desta rodada: no ffmpeg, `pad=...:color=black@0`
  NAO deixa a sobra transparente sozinho. O `pad` so guarda alfa se o quadro JA
  tiver canal alfa quando chega nele, e o `format=yuva420p` do projeto vinha
  DEPOIS do pad. Medindo o pixel: com o format depois sai `000000` (preto), com
  ele na frente sai `fc0000` (o fundo). Conferido tambem ponta a ponta com video
  sintetico de verdade.
- ARMADILHA (Claude 2): quebra de linha de legenda no ASS **nao pode ser escrita
  como `\N`** dentro do `ass_montagem`: o `_esc_ass` troca contrabarra por barra
  e o texto sai com "/N" na tela. Use a quebra de linha de verdade, que o proprio
  `_esc_ass` converte pro `\N` certo.
- BUG DE VERDADE achado (Claude 2): `/api/worker/erro/[id]` tentava
  `req.formData()` e caia pro `req.json()` no catch. **O corpo so pode ser lido
  uma vez**: a primeira tentativa ja consumia a stream, entao todo erro que o
  worker do PC mandava (JSON) virava o generico "Falha no render". Quem decide
  agora e o content-type.
- NOTA (Claude 2): o servidor do site NAO tem transcritor (o faster-whisper mora
  na maquina que renderiza). Por isso o "Posicionar cenas por IA" manda o AUDIO,
  extraido no navegador pelo `lib/audio-navegador.ts` (WAV 16 kHz mono), e o
  Gemini ouve. Se algum dia pedirem "transcricao no site", e este o motivo de
  nao existir.
- NOTA (Claude 2): a tarefa 22 foi feita no `financas-usuarios.tsx`, NAO no
  `admin-uso.tsx` que o enunciado citava: o admin-uso conta USOS, nao tem coluna
  de custo, e todas as colunas dele ja eram ordenaveis.
- NOTA (Claude 2): o "Cortar" de Meus Videos manda so o ID do job na barra de
  endereco, nunca a URL do arquivo. O caminho sai do banco. Aceitar a URL do
  cliente e mandar o servidor buscar seria SSRF.
- NOTA (Claude 2): o render ESTATICO da tarefa 25 nao precisou de mudanca na
  fabrica: o `planejar_apoios` ja obedece quem chega com `entra` preenchido, e
  depois do botao todos chegam. O caminho de decidir no render continua inteiro
  de proposito (job antigo ainda chega com `entra` nulo).
- AJUSTE do dono no chat (17:35): na etapa 5 a ORDEM virou obrigatoria. A regua
  so e desenhada DEPOIS de posicionar (antes mostrava tempo de reserva que o
  render trocava sozinho) e o "Aprovar e gerar" fica desligado ate posicionar
  (`precisaPosicionar`, com guarda no `gerar()` tambem). O posicionamento CADUCA
  quando a montagem muda: guarda-se a `assinaturaMontagem` (durBase + corte de
  cada apoio), NAO um booleano. O `entra` fica de fora da assinatura de
  proposito, senao o proprio posicionamento se invalidaria.
- ATENCAO (Claude 2): com essa trava, Gemini fora do ar (503 na rota de
  posicionar) = ninguem gera video COM cena de apoio ate voltar. Foi pedido
  explicito do dono; se um dia incomodar, o afrouxamento e liberar o Gerar
  quando a falha for de indisponibilidade.
- AJUSTE do dono no chat (18:30): **erro nunca deixa o video sair, e todo erro
  vai pro Diagnostico.** As mensagens das rotas de IA do Editor diziam "ou gere
  assim mesmo", o que a trava anterior ja tinha tornado impossivel: reescritas.
  Resultado PARCIAL tambem nao libera (o servidor completa com distribuicao por
  tempo o que a IA nao decidiu, cena que nao coube vira ERRO, e o cliente confere
  que todas voltaram; cobra so o que a IA decidiu).
- NOVO ARQUIVO (Claude 2): `src/lib/erros-app.ts` + secao "Erros na montagem
  (antes do render)" no /admin/diagnostico. Essas falhas acontecem ANTES de
  existir um `Job`, entao nao tinham onde aparecer. Guardado em
  `data/erros-app.json` (teto 300), **nao em tabela nova**: nenhuma IA mexe no
  banco sem permissao, e o projeto ja guarda coisa assim em `data/`
  (`materiais.json`, `virais.json`). A pasta e volume no EasyPanel.
  `registrarErroApp` NUNCA levanta excecao: falhar ao registrar uma falha viraria
  um segundo erro por cima do primeiro. Rota nova que puder travar o usuario
  deve chamar essa funcao.

## Notas do registro anterior (tarefa 20, mantidas como contexto)
- entregou a tarefa 20 (posicao da legenda, trilha navegavel e rascunho de 5 min).
- NOTA (Claude 1): o item 1 da tarefa 20 (preset do acervo Shopee em narracao +
  "A IA escreve") JA ESTAVA PRONTO, entregue pelo Claude 2 na rodada anterior.
  Conferido linha a linha em `editor-estudio.tsx`, nada precisou mudar. Quem
  anotou a tarefa nao sabia que o pedido ja tinha sido atendido no chat.
- NOTA (Claude 1): a legenda tem posicao PROPRIA agora (`legendaPos`). Antes o
  envio copiava a posicao do PRIMEIRO texto escrito a mao, entao mexer num texto
  arrastava a legenda junto. **O backend inteiro ja aceitava isso desde sempre**
  (coluna `Job.legendaPos`, validacao no `/api/jobs`, `legenda_pos` nos dois
  workers, `cfg.get("legenda_pos")` na fabrica): so a tela nao mandava. Zero
  mudanca de contrato.
- ARMADILHA (Claude 1), a pior desta rodada: no ASS, alinhamento 5 (meio) IGNORA
  a MarginV. Pra tirar o texto de cima da legenda quando os dois estao no meio
  nao adianta mexer na margem: tem que virar ancora de baixo (alinhamento 2,
  margem `H/2 + desvio`). Testado medindo o pixel: matriz 3x3 de legenda x texto
  com zero colisao e 170px de folga nas faixas coincidentes.
- NOTA (Claude 1): trocar de etapa no Editor e SEMPRE pelo `setPasso`, que virou
  wrapper. Chamando o setter cru (`setPassoBruto`) o `maxVisto` fica pra tras e a
  trilha para de liberar o pulo pra frente.
- NOTA (Claude 1): o rascunho do Editor (`editor_estudio_rascunho`, 5 min) NAO
  guarda as midias, so a FICHA de cada cena (corte, momento e descricao), que
  reencontra o arquivo pelo nome + tamanho no `addFiles`. `File` nao vira texto e
  video de 300 MB estoura a cota do localStorage. Guardar os arquivos de verdade
  pede IndexedDB: esta proposto ao dono no `reminder.md`, com recomendacao de
  deixar como esta.
- NOTA (Claude 1): PYTHON PENDENTE DE DEPLOY, **so o `fabrica.py`** (os workers
  nao mudaram nesta rodada). Sem o deploy o texto da pessoa volta a ser desenhado
  em cima da legenda quando os dois pedem a mesma faixa; nada quebra, so sobrepoe.

## Notas do registro anterior do Claude 1 (abandonado 09:10, mantidas como contexto)
- entregou as tarefas 13, 14, 15, 16 e o campo de descrever o video
  principal no Editor. TODOS os arquivos liberados, inclusive o
  `editor-estudio.tsx`.
- NOTA (Claude 1): o campo `descricao` do roteiro SEMPRE valeu pra qualquer
  clipe (o `normalizarRoteiro` nao filtra por papel) e os dois workers copiam o
  roteiro cru pro `roteiro.json`. Quem ignorava o principal era so a fabrica.
  Agora `contexto_cenas` e `plano_broll` usam a descricao da base; sem ela a
  saida continua identica a de antes.
- NOTA (Claude 1): `src/lib/avatares-prontos.ts` ganhou o campo `genero` nos 9
  avatares (conferido olhando as fotos: 7 female, 2 male). Avatar pronto novo
  PRECISA vir com esse campo, senao o TypeScript acusa.
- NOTA (Claude 1): no "Avatar com produto" o genero e HERDADO do avatar
  escolhido. Pode fazer isso sem medo: esse campo nao entra no prompt
  (`promptAvatarComProduto` nem recebe genero), ele so etiqueta a imagem na
  galeria via `registrarAvatar`.
- NOTA (Claude 1): os cards de cenario do "Avatar com produto" reusam as FOTOS do
  Lab, e o nome do arquivo nao bate com a chave do motor (`sala` -> `casa.jpg`,
  `sala_tijolo` -> `casa_simples.jpg`, `quintal` -> `ar_livre.jpg`). O mapa
  `FOTO_CENARIO` fica no topo do componente.
- NOTA (Claude 1): `contarUsoPorUsuario` em `lib/admin.ts` agora recebe DUAS
  pontas (`desde`, `ate`), as duas opcionais. Quem chamar so com `desde`
  continua funcionando igual.
- NOTA (Claude 1): o `gerador-prompt.tsx` virou funil de 5 etapas e passou a
  montar o `LabCabecalho` DENTRO dele. A `lab/prompt/page.tsx` agora e so uma
  linha: nao pôr cabecalho la de novo, senao aparece dois.
- NOTA (Claude 1): PYTHON PENDENTE DE DEPLOY. `bot shopee/fabrica.py`,
  `gemini_copy.py`, `worker.py` e `worker_serverrk.py` mudaram e precisam ir pro
  container do serverrk, senao a edicao avancada nao acontece no render de
  producao (a tela manda as opcoes e o worker antigo ignora, sem quebrar nada).
- NOTA (Claude 1): a transicao entre cena de apoio e base agora e OVERLAY, nao
  concat. A base corre inteira e o apoio e desenhado por cima com fade de alfa.
  Motivo: sobrepor nao muda a duracao; `xfade` encurtaria o video a cada emenda e
  a fala sairia do lugar. `repeatlast=0` no overlay e OBRIGATORIO, senao o ultimo
  quadro do apoio congela por cima da base ate o fim do video. O caminho de corte
  seco continua inteiro, atras da chave "transicoes" (desligue pra voltar ao de
  antes). Testado com ffmpeg de verdade em midia sintetica.
- NOTA (Claude 1): o som do apoio foi misturado na faixa "orig" DE PROPOSITO, e
  nao numa faixa nova. Faixa nova obrigaria a mexer em `remixar`, no upload de
  stems do worker e na rota de remix, e quebraria o "Reajustar audio" dos videos
  antigos.

## Claude 2 | inicio: 2026-08-06 10:54 (atualizado 12:35)
- ocioso (preset Shopee no "Editar esse" entregue: &shopee=1 -> editor abre em
  modo produto pre-selecionado). Todos os arquivos liberados.
- ATUALIZACAO da nota de deploy: o PYTHON PENDENTE DE DEPLOY agora sao QUATRO
  arquivos: worker.py, worker_serverrk.py, fabrica.py e gemini_copy.py
  (plano_broll ganhou contexto de produto + regra de obedecer pedido explicito
  na descricao da base).
- NOTA (Claude 2): PYTHON PENDENTE DE DEPLOY de novo, 4 arquivos: `worker.py` e
  `worker_serverrk.py` (elif que repassa `opcoes.musica` pro config; sem deploy a
  musica escolhida cai no sorteio, sem quebrar) + `fabrica.py` e `gemini_copy.py`
  (plano_broll com contexto do produto e regra de obedecer pedido explicito
  escrito na descricao do video principal; sem deploy o render so ignora o
  contexto novo).
- NOTA (Claude 2): o formato "legenda" (copy queimada) ficou INALCANCAVEL na
  tela do Editor: no modo "Video com fala" so ha transcrever/nenhum (mesmo com
  produto) e na narracao o formato e sempre voz. Backend segue aceitando.
- NOTA (Claude 2): `/api/musicas` le `bot shopee/entrada/musicas`, que NAO vai
  no git. Em producao (container do site) a lista volta vazia e a tela cai no
  "sorteada pela IA" sem quebrar. Pra lista aparecer la, a pasta precisa
  existir/ser montada na maquina do site.
- NOTA (Claude 2): as tarefas 18/19 pendentes tinham NUMERO REPETIDO com as 18/19
  ja concluidas pelo Claude 5 (outra coisa). Marquei como "18 (2ª)"/"19 (2ª)" no
  !executar.md; o Codex/Antigravity devia renumerar ao limpar.

## Notas do registro anterior do Claude 2 (abandonado 02:15, mantidas como contexto)
- entregou as tarefas 11 e 17 + a chave "Usar musicas da plataforma".
  Todos os arquivos liberados.
- DEPLOY FEITO NO SERVERRK (06/08/2026, com autorizacao explicita do dono, 2a
  excecao a regra de so-leitura): `fabrica.py`, `gemini_copy.py`,
  `worker_serverrk.py` e `worker.py` copiados pra `/opt/viraliza-worker/app/`
  (md5 conferido) e os 3 containers reiniciados com a fila vazia. **A NOTA DO
  CLAUDE 1 dizendo "PYTHON PENDENTE DE DEPLOY" esta VENCIDA.** Backup dos 18 `.py`
  anteriores em `/opt/viraliza-worker/backup-20260806-050308-antes-edicao-avancada/`.
- BUG CORRIGIDO (06/08/2026): o `chaves()` do `src/lib/gemini-vision.ts` so aceitava
  chave comecando com `AIza`. O Google AI Studio passou a emitir chave no formato
  `AQ.A...`, e com ela o `geminiConfigurado()` dava FALSE mesmo com chave valida no
  `.env` - a tela dizia "a analise esta fora do ar" como se nao houvesse chave.
  Afetava os 3 usos: analise de cenas do Editor, `analisarProduto` do "Avatar com
  produto" e o plano B do Gerador de prompt. Agora aceita `AIza` e `AQ.`. O
  `bot shopee/` nunca sofreu disso porque o Python nao filtra por prefixo.
- NOTA (Claude 2): o `.env` da RAIZ nao tinha `GEMINI_API_KEY` nenhuma (so o
  `bot shopee/.env` tinha). Site e worker chamam o Google separado, entao a chave
  precisa estar nos DOIS. Copiei a mesma pro `.env` da raiz.
- APRENDIZADO util pro proximo deploy: o `/opt/viraliza-worker/app` e BIND MOUNT
  (`docker inspect -f '{{range .Mounts}}...'`), entao copiar o .py + `docker
  restart` basta. NAO precisa recriar container, que e o que arrisca perder o
  `worker.env`. Os containers rodam `python3 /app/worker_serverrk.py`; o
  `worker.py` que existe la e so espelho do repo, ninguem executa.
- ATENCAO: o serverrk agora esta NOVO e o site em producao ainda esta VELHO. Como
  as melhorias de imagem nascem ligadas, os jobs da producao ja saem com Ken
  Burns, transicao e melhor trecho antes do deploy do site. O som do apoio nao
  muda (nasce desligado).
- NOTA (Claude 2): os textos do Editor NAO falam mais em 1a pessoa ("voce aparece
  falando", "sua fala"). O video costuma ser de OUTRA pessoa. O modo chama
  "Video com fala". Vale pra tela, pra ajuda e pro robo de suporte.
- NOTA (Claude 2): padroes novos da tela (dono, 06/08/2026): "E um produto?"
  comeca no Nao, `cortarSilencio` comeca em 0,5s e o som do apoio comeca
  DESLIGADO. No modo "Video com fala" nao existe mais a opcao Mudo.
- ARMADILHA (Claude 2), a pior desta rodada: inverter um padrao do
  `EDICAO_PADRAO` quebrou o caminho de LIGAR a opcao. Os workers so escreviam a
  chave `ed_*` quando ela era `false` (porque antes tudo era ligado por padrao),
  entao ligar o som do apoio na tela nao escrevia nada e a fabrica desligava de
  volta. Agora os dois workers escrevem SEMPRE que a tela manda um booleano, e o
  `_edicao` da fabrica tem o mesmo padrao do TS. **Mexeu num padrao de um lado,
  confira o outro e teste o caminho inteiro tela -> config -> fabrica.**
- NOTA (Claude 2): a musica agora tem TRES estados, sem o par "com/sem" de antes:
  o arquivo da pessoa, a chave "Usar musicas da plataforma" (`musicaAuto`,
  desligada por padrao) ou nada. `comMusica = musica.length > 0 || musicaAuto`.
  Backend intocado: `achar_musica(None)` ja sorteava da biblioteca.
- NOTA (Claude 2): a etapa 5 tem lista PROPRIA (`RevisaoCenas`), nao reusa a
  `ListaClipes` da etapa 3. Se for mexer na etapa 3, lembre que sao duas listas.
- NOTA (Claude 2): o desenho do cartao das telas de apresentacao virou UM
  componente, `src/components/app/grade-ferramentas.tsx`, e as 3 telas
  (`lab/inicio`, `meus-avatares/inicio`, `ferramentas`) so passam a lista. Se for
  mexer no visual do cartao, mexa la e as tres mudam juntas. A linha de ffmpeg pra
  tratar o video dos cartoes mudou de casa junto (era o topo do `lab-inicio.tsx`).
- NOTA (Claude 2): a `raiz` dos 3 grupos do menu agora e a tela de APRESENTACAO
  (`lab/inicio`, `meus-avatares/inicio`, `ferramentas`), nao mais uma das
  ferramentas. Com a barra recolhida, o icone do grupo tambem leva pra la.
- ARMADILHA (Claude 2): pagina do App Router so aceita os exports que o Next
  conhece (default, metadata e afins). Exportar uma constante qualquer de um
  `page.tsx` QUEBRA a validacao de tipos do build. Por isso o endereco das telas de
  apresentacao mora na barrinha (`FERRAMENTAS_INICIO`, `PERSONALIZE_INICIO`), que e
  quem precisa dele pra sumir naquela tela.
- ARMADILHA (Claude 2): `/painel/meus-avatares` e prefixo de
  `/painel/meus-avatares/inicio`. So nao acende junto porque o item da galeria ja
  tinha `exato: true`. Tela nova filha de um endereco irmao precisa dessa conferencia.

## Claude 3 | inicio: 2026-08-06 02:33
- ocioso (nenhum arquivo em uso)
- NOTA (Claude 3): o `reminder.md` agora tem DUAS secoes fixas: `# PENDENTES` no
  topo (por tema: urgente/deploy/conferir/precos/ideias) e `# HISTORICO` embaixo.
  Ao concluir um item, MOVER pro historico em vez de apagar, e nao criar item novo
  no meio do historico. O cabecalho do arquivo explica a convencao.
- NOTA (Claude 3): a env de PRODUCAO nao falta mais nenhuma variavel. Foram postas
  em 06/08/2026 `META_ADS_TOKEN`, `META_ADS_ACCOUNT_ID`, `GROK_CUSTO_10S_CENTAVOS`,
  `CAKTO_CHECKOUT_ASSINATURA` e `OPENAI_ADMIN_KEY`. **As duas ultimas NAO existem
  no `.env` local**, entao testando local o botao de assinatura da erro e o card da
  OpenAI fica "estimado": isso e esperado, nao e bug.
- ATENCAO (Claude 3): os valores do Meta foram salvos no EasyPanel ENTRE ASPAS. Se
  o card "Anuncios" der erro de token depois do redeploy, e provavelmente as aspas
  chegando junto no container. Nao investigar o codigo antes de conferir isso.

## Claude 4 | inicio: 2026-08-06 02:50
- ocioso (cartoes com foto prontos; as 9 fotos SUBIRAM pro serverrk em 06/08 ~06:01
  UTC com autorizacao do dono). DETALHE: as 6 da tela Ferramentas ficaram com o
  404 PRESO no cache da Cloudflare (algum navegador abriu a tela antes do upload);
  se destrava sozinho ate ~10:00 UTC. As 3 do Personalize ja servem 200.
- NOTA (Claude 4): o `CartaoFerramenta` ganhou `foto?: boolean`: com `chave` +
  `foto: true` o cartao mostra so o `<chave>.jpg` de `lab/ferramentas` (sem
  procurar .mp4). Quando o video de um cartao ficar pronto, sobe o .mp4 e apaga o
  `foto: true` daquele item. As 9 fotos ja tratadas (480x480, 24-44KB) estao no
  scratchpad da sessao do Claude 4, pasta `ferramentas/`.
- ATENCAO (Claude 4): enquanto as fotos NAO subirem, NAO abrir /painel/ferramentas
  nem /painel/meus-avatares/inicio no navegador: a Cloudflare guarda o 404 por 4h
  (armadilha ja conhecida do lab-midia.ts).
- NOTA (Claude 4): existe `scripts/backfill-gastos-api.mjs` (NOVO, ainda nao
  commitado): estima o gasto de API dos jobs antigos (antes da instrumentacao) e
  grava linhas na GastoApi com origem "backfill:..." e criadoEm = data do job.
  Dry-run por padrao; `--aplicar` grava; `--desfazer` apaga tudo que for backfill.
  Idempotente por jobId. Nada foi gravado em banco nenhum ainda.
- NOTA (Claude 4): existe `scripts/backfill-gastos-api.mjs` (NOVO, ainda nao
  commitado): estima o gasto de API dos jobs antigos (antes da instrumentacao) e
  grava linhas na GastoApi com origem "backfill:..." e criadoEm = data do job.
  Dry-run por padrao; `--aplicar` grava; `--desfazer` apaga tudo que for backfill.
  Idempotente por jobId. Avatar antigo (sem marca nas opcoes) e detectado por
  "/avatares/" em saidas/midias, mesma regra do `ferramentaDoJob` de criacoes.ts.
  NAO estima Veo nem imagens (custo 0) nem OpenAI (fatura oficial cobre). Nada
  foi gravado em banco nenhum ainda.

## Claude 5 | inicio: 2026-08-06 02:39
- ocioso (entregou as tarefas 18 e 19: descrever as cenas saiu da etapa 5 e foi
  pras Midias; e a pergunta redundante da etapa 2 virou pergunta de legenda).
  Todos os arquivos liberados.
- NOTA (Claude 5): o `FORMATOS_SEM_PRODUTO` agora e "Sim, legendar a fala" /
  "Nao, sem legenda". Ele SO aparece com `modo === "base"`, ou seja depois de a
  pessoa ter dito "Video com fala" na etapa 1, entao perguntar "seu video tem
  fala?" era pedir de novo a mesma resposta. Os VALORES nao mudaram
  (`transcrever` / `nenhum`): so o rotulo e a pergunta.
- ATENCAO (Claude 5): a `RevisaoCenas` do `editor-estudio.tsx` FOI APAGADA. Ela
  era a lista so-leitura da etapa 5 e virou duplicata da `ListaClipes` quando a
  descricao mudou de casa. Hoje a `ListaClipes` da etapa 3 e a UNICA lista de
  cenas da tela: montar, descrever e escolher o momento acontecem tudo la. A
  nota do Claude 2 dizendo "a etapa 5 tem lista PROPRIA, sao duas listas" esta
  VENCIDA.
- NOTA (Claude 5): o botao "Descrever com IA" e o aviso de cena sem descricao
  agora ficam embaixo da lista de midias (etapa 3). A etapa 5 so avisa e oferece
  o atalho de volta; o aviso NAO trava o Gerar de proposito (sem descricao as
  cenas entram espalhadas pelo ritmo, que e resultado pior, nao erro).
- NOTA (Claude 5): `focarCena` (clique num bloco da regua da etapa 5) agora VOLTA
  pro passo 3 antes de rolar. O `setTimeout` de 60ms nao e frescura: sem ele o
  `scrollIntoView` roda antes de a lista existir e nao acha o item.
- ARMADILHA (Claude 5): o passo a passo do Editor mora em 4 lugares (tela,
  `ajuda-videos.tsx`, `suporte-guia.ts`, `suporte-base.ts`) e havia texto
  espalhado dizendo "na etapa 5 a IA diz onde cada um encaixa". Mexeu na ordem
  das etapas, procure por "etapa 5" nos quatro, senao a ajuda e o robo mandam a
  pessoa procurar botao onde nao tem mais.

## Avisos herdados (registros abandonados, mantidos como contexto)
- (ex-Claude 1) Tela /painel/inicio REFEITA, e o catalogo da plataforma inteira.
  O catalogo (lista de cartoes) mora em `src/components/app/inicio-hub.tsx` e e o
  UNICO lugar a mexer quando entrar ferramenta nova: a `inicio/page.tsx` so busca
  dados. Tambem mexeu em `hero-hub.tsx`, `categoria-card.tsx` (prop `selo`) e
  `lib/jobs.ts` (`contarVideosDoUsuario`).
- (ex-Claude 3) Os 4 cartoes da /painel/lab/inicio tocam video. A pasta
  `public/lab/` FOI APAGADA: os videos estao no serverrk em
  `/mnt/ssd/viraliza/media/lab/ferramentas/<chave>.mp4` + `<chave>.jpg`, via
  `midiaFerramenta` no `lib/lab-midia.ts`. Video cru do Grok (960px, ~8MB) NAO
  pode subir: recomprimir pra 480px sem audio antes (linha de ffmpeg no topo do
  `lab-inicio.tsx`).
- (ex-Claude 3) ARMADILHA: a media.univershoop.com responde com `max-age=14400`
  (4h de Cloudflare) e guarda ate o 404. Se testar a URL ANTES de subir o
  arquivo, ela continua 404 depois de subir ate revalidar. Vale pra TODA midia de
  exemplo do Lab.
- (ex-Claude 2) Robo de suporte: passos guiados com as OPCOES de cada tela
  explicadas; `src/lib/suporte-guia.ts`, `suporte-base.ts`, `api/suporte/chat`.
- (ex-Claude 2) Tela /admin/criacoes ("Criacao dos usuarios") juntando videos +
  imagens + avatares: mexeu em src/lib/criacoes.ts, src/app/actions/criacoes.ts,
  src/app/(app)/admin/criacoes/page.tsx, src/components/app/admin-criacoes.tsx,
  admin-usuarios.tsx, usuarios-admin.tsx e nav-links.tsx (adminItems).
- (ex-Claude 3) Cobranca de 5 creditos do Gerador de prompt + tela
  /painel/lab/inicio com video nos cartoes.
- (ex-Claude 3) ATENCAO ENCODING: o `lab-inicio.tsx` apareceu com os acentos
  corrompidos ("CartAues") depois de uma edicao externa. Se editar .tsx por fora
  do Claude, conferir o encoding do editor: o repo e UTF-8.
- (ex-Claude 2) Worker local rodando em background pra teste do Editor; venc.py
  copiado do serverrk pra bot shopee/.
- (ex-Claude 1) O passo a passo do robo de suporte agora e CODIGO
  (`src/lib/suporte-guia.ts`), nao mais o modelo. A rota `api/suporte/chat` tenta
  a guia antes do LLM. Se mexer nos textos dos passos, os 40 primeiros caracteres
  de cada passo sao a chave que acha onde a conversa parou.
- (ex-Claude 3) Editor automatico mexido de ponta a ponta (tela -> API -> worker
  -> fabrica). A montagem da tela agora CHEGA no render via `opcoes.roteiro` +
  `roteiro.json`. Bugs #22, #23 e #24 do `auditoria.md` corrigidos.
  `bot shopee/fabrica.py`, `gemini_copy.py` e `worker_serverrk.py` precisam ir pro
  container do serverrk. Detalhes no `!projeto.md` (secao "MONTAGEM DO EDITOR").

## Pendencia herdada (deixada pelo Claude 2, registro abandonado)
- 3 COMENTARIOS de codigo desatualizados falando de uma "aba Cenarios do Personalize
  com IA" que nao existe mais (virou a tela /painel/meus-avatares/cenarios):
  `src/lib/cenarios-usuario.ts:7`, `src/app/api/cenarios/route.ts:20` e
  `src/components/app/meus-cenarios.tsx:11`. Os dois primeiros tambem tem travessao,
  proibido pelo temporary_rules.md.
