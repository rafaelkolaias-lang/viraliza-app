# Plano de Execução

> **Como usar:** Pendentes ficam no topo de cada seção do Claude correspondente. Concluídas ficam abaixo, em formato enxuto, ou seja, ao concluir, transforme a tarefa em formato enxuto e mova ela para a sessão de concluídas do Claude correspondente.

---

# Claude 1

## Tarefas Pendentes — Claude 1:

(nenhuma)

---

## Tarefas Concluídas — Claude 1:

### ✅ 5. "Viraliza Labs" em menu retrátil + rotas separadas (2026-08-05)
**Quem fez:** passo 1 (menu lateral) foi do Claude 1 junto com a tarefa 4; passos 2 a 5 foram do **Claude 2**, pra dois Claudes não escreverem o `nav-links.tsx` ao mesmo tempo.
**Solução aplicada:**
- **[NEW] 3 rotas:** `/painel/lab/imagens` (`<LabGaleria comCabecalho={false} />`), `/painel/lab/livre` (`<VideoLivre />`, com os avatares do usuário vindos do servidor) e `/painel/lab/prompt` (`<GeradorPrompt />`). São páginas de servidor com `metadata` própria; o login já é exigido pelo layout do painel.
- **[NEW] `src/components/app/lab-cabecalho.tsx`:** o cabeçalho (etiqueta + título + frase) era montado dentro do funil e trocava junto com a aba do dock. Virou componente pra as 4 telas do Labs continuarem com a mesma cara. O `children` é onde o funil põe a trilha e a barra de progresso.
- **`viraliza-lab.tsx`:** fora o `<LabDock />`, o estado `modo`, o array `FERRAMENTAS` e os 3 blocos das outras ferramentas. Sobrou só o funil guiado (cena -> imagem -> vídeo). A folga de rodapé que existia pro dock (`pb-24`) virou `pb-8`.
- **[NEW] `src/lib/lab-handoff.ts` (a parte não óbvia):** dois atalhos cruzavam telas por estado do React e agora cruzam ROTAS: "Novo vídeo" da galeria (leva a imagem + o contexto pro funil abrir no passo do vídeo, sem cobrar de novo) e "Usar no Vídeo livre" do gerador (leva o prompt + as fotos). O recado fica em **memória do módulo**, não em `sessionStorage`: o do gerador carrega até 3 fotos em base64, que estouram a cota e fariam o atalho falhar calado. Como a navegação do painel é do lado do cliente, o módulo sobrevive entre as telas.
- **Armadilha do recado:** ele é lido na MONTAGEM do estado (`useState(espiar...)`) e apagado num `useEffect` depois. Ler e apagar são passos separados de propósito: o ESLint do projeto proíbe `setState` dentro de efeito (`react-hooks/set-state-in-effect`) e consumir durante a renderização quebraria no modo estrito. Sem o "apagar", entrar no Labs pelo menu na vez seguinte cairia de novo no vídeo da imagem anterior.
- **`lab-galeria.tsx` e `gerador-prompt.tsx`:** perderam os callbacks `onNovoVideo`/`onUsarNoLivre` (não existe mais uma tela-mãe pra recebê-los) e passaram a navegar sozinhos com `router.push`. O `video-livre.tsx` perdeu os props `textoInicial`/`midiasIniciais` e lê o recado direto.
- Conferido com `tsc --noEmit`, ESLint e `next build`: as 4 rotas do Labs entram na lista de rotas.

### ✅ 1. Navegação de vídeos e melhoria de UX no Acervo de Cortes (2026-08-05)
**Solução aplicada** em `src/components/app/acervo-grid.tsx`:
- Grid trocado para o mesmo padrão de "Meus vídeos": `grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4` (capas maiores).
- Criado o subcomponente `AcervoCard` com prévia muda no hover: o `<video>` só recebe o `src` (`driveDownload`) quando o mouse chega, toca em loop e volta pro início ao sair. `preload="none"` pra não baixar tudo ao abrir a página.
- Modal ganhou navegação: `irParaAnterior`/`irParaProximo` calculados pelo índice do item aberto, com setas no cabeçalho (ao lado do X, desabilitadas nas pontas), setas flutuantes grandes nas laterais (só desktop, `md:`) e teclado `ArrowLeft`/`ArrowRight` (o `Escape` continua fechando).
- `key={aberto.id}` no iframe pra o player recarregar de fato ao trocar de vídeo.

### ✅ 2. Custo de geração de avatar para 20 créditos (2026-08-05)
**Solução aplicada:**
- `src/lib/avatar-modelo.ts`: `CUSTO_AVATAR` de 40 para 20. A constante já é a fonte única, então os 3 endpoints (`/api/avatar/criar`, `/da-foto`, `/com-produto`) e os botões/avisos das telas (`avatar-criar`, `avatar-da-foto`, `avatar-com-produto`, `ajuda-influenciador`) passaram a cobrar e mostrar 20 automaticamente.
- `src/components/app/ajuda-comecar.tsx`: a tabela "Quanto custa cada coisa" tinha o 40 escrito na mão na linha "Criar um influenciador com IA"; trocado pra 20, senão a Central de Ajuda ficaria mentindo (ver lembrete de manter a ajuda em sincronia com os preços).

### ✅ 4. "Personalize com IA" em menu retrátil + rotas separadas (2026-08-05)
**Solução aplicada:**
- **`nav-links.tsx` refatorado:** o bloco fixo de "Ferramentas" virou um componente `GrupoRetratil` + hook `useGrupoAberto(chave)`, e os grupos passaram a sair de um array `GRUPOS`. Agora são três: **Personalize com IA** (`nav_personalize_aberto`), **Viraliza Labs** (`nav_lab_aberto`) e **Ferramentas** (`nav_ferramentas_aberto`, chave antiga preservada pra ninguém perder o estado). O evento do localStorage virou `nav-grupo` (era `nav-ferramentas`). **O grupo do Labs foi feito aqui de propósito**, porque é o passo 1 da tarefa 5 e os dois Claudes iam escrever o mesmo arquivo.
- **Ajustes pedidos depois de testar (05/08/2026):**
  1. Clicar no NOME de QUALQUER grupo não navega mais, só abre/fecha os atalhos (o clique pega a linha inteira, não só a setinha). O `href` do grupo virou `raiz`, usada só pro destaque e pro modo compacto.
  2. **A tela `/painel/ferramentas` (grade de cards) foi APAGADA** junto com sua pasta: com o submenu no menu lateral, ela virou um clique a mais pros mesmos 4 destinos. A `raiz` do grupo Ferramentas passou a ser `/painel/novo`.
  3. O botão "Ferramentas" do hero da tela Início (`src/components/hub/hero-hub.tsx`) apontava pra essa grade e ia dar 404: virou "Editor automático" apontando pra `/painel/novo`.
  4. O destaque do grupo agora acende quando a pessoa está em QUALQUER tela dele (`raiz` OU algum sub-item), senão com a lista recolhida ela ficaria sem pista de onde está.
  5. Se `tsc` acusar `Cannot find module '.../painel/ferramentas/page.js'`, é o `.next/types/validator.ts` velho: apagar o arquivo (ele é gerado).
- **`isActive` ganhou `exato`:** sem isso, estar em `/painel/meus-avatares/criar` acendia também "Galeria de avatares", já que a comparação normal é por começo do endereço. Usado na raiz de cada grupo (`/painel/meus-avatares` e `/painel/lab`).
- **[NEW] `src/app/(app)/painel/meus-avatares/criar/page.tsx` + `src/components/app/criar-influenciador.tsx`:** tela de escolha com os 3 caminhos de IA em cartões iguais (quiz, a partir de foto real, junto com produto), cada um com o custo em `CUSTO_AVATAR`. Antes dois desses caminhos eram link de texto miúdo embaixo dos botões e quase ninguém achava. Ao criar, volta pra galeria com toast.
- **[NEW] `src/app/(app)/painel/meus-avatares/cenarios/page.tsx`:** renderiza `<MeusCenarios />` com cabeçalho próprio.
- **`meus-avatares.tsx` virou só a galeria:** saíram as abas Influenciadores/Cenários, os modos `zero`/`foto`/`produto` e a prop `admin` (não usada mais aqui). "Criar com IA" agora é um `<Link>` pra rota nova. O **"Enviar imagem" continua na galeria** de propósito: não usa IA, não cobra e o resultado entra na lista logo abaixo, então mandar a pessoa pra outra tela seria caminho a mais por nada.
- Testado com o servidor de pé: as 3 rotas respondem (307 pro login sem sessão) e uma rota inventada dá 404, confirmando que existem de verdade.
- **Ajuste pedido no chat depois (Claude 2, 05/08/2026):** o primeiro cartão da tela de criar também se chamava "Criar com IA", igual ao item de menu que leva até ela, e clicar no menu e cair num botão de mesmo nome dava a sensação de que a tela não tinha aberto. O cartão virou **"Do zero, sem foto"**, que segue o padrão dos outros dois (dizem de onde a pessoa está PARTINDO). O nome do menu e o título da tela continuam "Criar com IA".
- **2º ajuste pedido no chat (Claude 2, 05/08/2026):** o botão **"Criar com IA" saiu da Galeria de avatares**. Ele era um segundo caminho pro mesmo lugar que o atalho do menu, e o menu já é o caminho oficial. Na galeria sobrou só o "Enviar imagem", que é o único que não usa IA e devolve o resultado na própria tela. O texto da lista vazia deixou de dizer "crie um com IA" sem ter botão pra isso: agora aponta o menu da esquerda.
- **Sincronia obrigatória junto (ver lembrete de manter a ajuda coerente):** `ajuda-influenciador.tsx` e `src/lib/suporte-base.ts` ainda ensinavam o caminho ANTIGO, de antes desta tarefa: mandavam clicar num "botão verde no topo" e procurar links miúdos embaixo dos botões, e citavam uma "aba Cenários" que não existe mais. Os dois foram reescritos pro caminho novo (menu abre atalhos -> Criar com IA -> os 3 cartões), o atalho da ajuda passou a apontar pra `/painel/meus-avatares/criar`, e o `ROTAS_SUPORTE` do robô ganhou as 6 rotas novas das tarefas 4 e 5 (`meus-avatares/criar`, `meus-avatares/cenarios`, `lab/livre`, `lab/imagens`, `lab/prompt`) e passou a chamar `/painel/meus-avatares` de "Galeria de avatares". Sem isso a Central de Ajuda e o robô ficariam dando instrução que não bate com a tela.

### ✅ 7. Não perder o progresso do Viral Boost ao fechar a aba (2026-08-05)
**Escolha do usuário:** soluções A + B juntas. **Solução aplicada** em `src/components/app/viral-boost.tsx`:
- **A:** `beforeunload` ativo SÓ enquanto `gerandoCena` é true (a cena é o que não dá pra recuperar: o crédito já saiu e a imagem só existe no fim da chamada). O vídeo não segura a saída de propósito, porque ele termina no servidor e avisa no sininho (ver tarefa 8).
- **B:** rascunho em `localStorage` (`boost_rascunho`, validade 24h) com passo, formato, personagens, historinha, cenário, historinha própria e a URL da cena. Gravado por `useEffect` a cada mudança, e SÓ quando existe progresso, senão a tela recém-aberta apagaria o que estava salvo.
- Em vez de restaurar sozinho, a tela mostra um bloco "Você tinha uma historinha em andamento" com Retomar / Começar do zero. Restaurar sozinho ressuscitaria historinha que a pessoa já tinha desistido; o banner deixa a escolha com ela e ainda evita mexer com hidratação (leitura via `useSyncExternalStore`, mesmo padrão do `nav-links.tsx`).
- Rascunho é apagado quando o vídeo fica pronto e no "Fazer outra".

### ✅ 9. Robô de suporte no canto do painel, sem custo de API (2026-08-05)
**Escolha do usuário:** usar o LLM PRÓPRIO do servidor dele (qwen2.5:14b em Ollama + Open WebUI), que não tem custo por chamada. Isso substituiu os 3 caminhos propostos originalmente.
**Solução aplicada:**
- `.env` (local): `LLM_BASE_URL=https://llm.univershoop.com/ollama/v1`, `LLM_API_KEY` e `LLM_MODEL=qwen2.5:14b`. O cliente `src/lib/llm.ts` já existia (era usado pelo Minerador) mas NUNCA tinha sido configurado, então o Minerador também estava morto no local. **Falta pôr as 3 no EasyPanel** (registrado no `reminder.md`).
- **[NEW] `src/lib/suporte-base.ts`:** base de conhecimento (o conteúdo da Central de Ajuda em texto corrido) + mapa de telas + prompt do sistema + `separarLinks()`. Os preços e limites NÃO são escritos na mão: vêm de `CUSTO_IMAGEM_LAB`, `custoVideoLab`, `CUSTO_AVATAR`, `JANELA_GARANTIA_DIAS` e `NIVEIS`, então mexer no preço não deixa o robô mentindo.
- **[NEW] `src/app/api/suporte/chat/route.ts`:** exige login, freio de 12 perguntas por minuto por usuário (memória do processo), manda as últimas 6 mensagens, 503 se o LLM não estiver configurado. Não debita crédito.
- **[NEW] `src/components/app/suporte-chat.tsx`:** boia flutuante no canto de baixo à direita, com saudação, 4 perguntas sugeridas e botões que levam pra tela citada.
- **Comportamento de WhatsApp (pedido do usuário):** cabeçalho com "Suporte Viraliza", bolinha verde e status "Online" / "digitando..."; vistinho de enviado (1 risco) / entregue (2 riscos) / lido (2 riscos azuis) na mensagem da pessoa; balão de três pontinhos antes da resposta; hora em cada mensagem. O `fetch` dispara ANTES das esperas, então os vistinhos correm por cima da latência real do LLM em vez de somar com ela (só o "digitando" no fim acrescenta de 0,5s a 1,4s, proporcional ao tamanho da resposta). A saudação continua dizendo que é o suporte da plataforma: a imitação é de ritmo, não de identidade.
- `src/app/(app)/layout.tsx` monta o robô pra todo mundo; `chat-widget.tsx` (conversa com a equipe) subiu pra `bottom-20` pra não cobrir a boia.
- **Roteiro "que tipo de vídeo" (pedido no chat, 05/08/2026):** "quero fazer um vídeo" é a pergunta mais comum e a que mais tem caminho na plataforma; a resposta binária de antes ("do zero ou já gravado?") escondia metade deles. O prompt ganhou um bloco `=== ROTEIRO "QUE TIPO DE VÍDEO" ===` com a resposta pronta apresentando os 4 caminhos (Labs, Viral Boost, Editor automático, Cortes) com a diferença de cada um em uma linha, terminando em pergunta. **É a ÚNICA exceção permitida à regra das 2 frases**, e está dito assim na própria regra 1. O `maxTokens` subiu de 180 pra 280 por causa dele: no teto antigo a lista sairia cortada no meio. Testado no LLM: sai idêntico ao roteiro, e as respostas curtas continuam curtas. Vira 3 balões (abertura, a lista inteira, a pergunta), porque `partirResposta` nunca quebra lista.
- **As 4 sugestões têm resposta PRONTA (pedido no chat, 05/08/2026):** **[NEW] `src/lib/suporte-prontas.ts`**. Clicar numa sugestão NÃO chama o modelo: são as dúvidas mais comuns e as mais caras de errar (dinheiro e preço), então a resposta é escrita à mão, sempre igual e sem risco de número inventado. A ordem começa por "Comprei crédito e só entrou uma parte". Espera de **10s** antes de responder (descontando o tempo dos vistinhos), senão chegar em 1 segundo entregaria que é automático; depois segue o mesmo ritmo de balões e digitação. Os preços saem das constantes; o prazo de garantia chega como **prop do layout**, porque `lib/niveis` é server-only e não pode ser importado no componente cliente.
- **Respostas curtas e conversa de gente (pedido no chat, 05/08/2026):** o robô respondia textão em tópicos. Agora o alvo é **2 frases, ~35 palavras**, com o modelo autorizado a **perguntar de volta** quando a dúvida for vaga e a dar **um passo de cada vez**. `maxTokens` caiu de 400 pra 180 como segunda trava.
  - **A ORDEM DO PROMPT VIROU: material primeiro, regras por último.** Com as regras no começo de um prompt de 12k caracteres o qwen simplesmente as ignorava. Modelo pequeno presta muito mais atenção no FIM do prompt. Não inverter isso de novo.
  - **Ficha de "NÚMEROS EXATOS" no fim do prompt (correção de bug real):** nos testes o modelo respondeu **30 créditos** pro vídeo de 15s (é 95) e **50** pra imagem e pro influenciador (são 20), pescando o número errado no meio do material. Com a tabela compacta repetida no fim, os 6 casos testados passaram a bater. Os valores da ficha também vêm das constantes, nunca escritos na mão.
  - Testado direto no LLM do dono a cada rodada, não só no papel.
- **Sonzinho de enviar e receber (pedido no chat, 05/08/2026):** **[NEW] `src/lib/suporte-som.ts`** SINTETIZA os bipes na Web Audio (dois senoides curtos com envelope: subindo ao enviar, descendo ao receber). Não é arquivo de áudio de propósito: nada pra hospedar, nada que um redeploy do EasyPanel possa perder, nada que a CSP bloqueie. O `AudioContext` é criado na primeira necessidade e o navegador não barra, porque o 1º som só sai depois de um clique da pessoa. Tem botão de silenciar no cabeçalho (lembrado em `suporte_som` no localStorage) e o estado é lido por uma **ref**, senão desligar o som no meio de uma resposta longa não faria efeito nos balões que ainda faltam.
- **Varredura de bugs do chat (pedida no chat, 05/08/2026). Achados e corrigidos:**
  1. **GRAVE, campo travava pra sempre:** `perguntar()` não tinha `try/finally`. Qualquer erro no meio (rede, JSON estranho, localStorage cheio) deixava `ocupado` preso em `true`, o campo de escrever desabilitado e a pessoa obrigada a recarregar a página. Agora o `finally` sempre solta `ocupado`, `digitando`, `parcial` e `demorando`.
  2. **Botões de tela aparecendo sem ninguém chamar** (reclamação do dono, em duas rodadas): o modelo grudava rota em quase toda resposta, inclusive embaixo de uma pergunta que ele mesmo fazia de volta. **Regra final: o botão só aparece se a resposta CITAR o botão** ("pelo botão abaixo você abre..."). Três travas:
     - prompt: a linha `LINKS:` é VAZIA por padrão e pergunta de volta nunca leva botão;
     - `podeMostrarBotao()` em `suporte-base.ts`: sem a palavra "botão/botões" no texto, ou terminando em "?", os links caem fora. **Esta não depende do modelo obedecer**;
     - `suporte-chat.tsx`: rota que já apareceu na conversa não aparece de novo.
     As respostas prontas foram reescritas pra também citarem o botão, senão a regra valeria só pra metade do chat.
  3. **Conversa antiga abria no meio:** o efeito de rolagem não tinha `atualId` nas dependências, então trocar pra uma conversa com a MESMA quantidade de mensagens não rolava pro fim.
  4. **Apagar a conversa que esperava resposta** descartava a resposta calada. O botão de apagar agora trava enquanto aquela conversa está aguardando.
  5. **Vazamento de memória no servidor:** o mapa `aquecidos` (throttle do aquecimento) não tinha limpeza e guardaria um registro por usuário pra sempre. Ganhou a mesma limpeza preguiçosa do `usos`.
  6. Comentário de `abrirWidget` estava colado na função errada (`alternarSom`).
  - **Conferido e SEM bug:** troca de conversa no meio da resposta (o id é capturado no envio), som depois da aba em segundo plano (o `AudioContext` é retomado), conversas vencidas, ids de mensagem, limites por janela e sessão de 7 dias.
  7. **Pergunta órfã ao fechar a aba no meio (corrigido depois, a pedido):** quem fechava a aba durante a espera reabria o chat e via a própria pergunta com um risco só e nada embaixo. Agora o `abrirWidget` olha a última mensagem da conversa aberta e, se ela for da PESSOA, **retoma o pedido sozinho**. O `perguntar()` ganhou `opcoes.retomar` (não cria outra mensagem nem toca o som de enviar, reaproveita a que ficou pendente) e `opcoes.conversa` (a retomada roda dentro do `abrirWidget`, antes do React aplicar o `setAtualId`). Não vira laço: se falhar de novo, o erro entra como fala do robô e a última mensagem deixa de ser da pessoa.
  - **Limitação conhecida, NÃO corrigida:** duas abas abertas, a última a enviar sobrescreve a lista de conversas da outra (a conversa em andamento não se perde).
- **Camadas e posição do canto (auditoria pedida no chat, 05/08/2026):**
  - **Bug achado:** o botão do suporte estava em `z-50`, o MESMO das telas cheias (player de vídeo, `video-detalhes-modal`, acervo, compra concluída, bônus IG, produtos TikTok) e do painel da gaveta no celular. No empate quem é montado depois ganha, e o suporte é montado no fim do layout, então a boia aparecia flutuando por cima do vídeo em tela cheia. **Botões do suporte e do chat da equipe foram pra `z-40`**, e o escurecido da gaveta subiu pra `z-[45]` (fica entre os botões e o painel dela, `z-50`).
  - As caixas abertas seguem em `z-[60]`; os seletores de arquivo (`lote-em-massa` `z-[65]`, `acervo-picker-modal` `z-[70]`) continuam por cima delas de propósito, porque são abertos de dentro de um formulário.
  - **Posição:** no desktop a folga de baixo passou a ser IGUAL à da direita (5rem nas duas). No celular continua menor, senão come a área útil da conversa.
  - **Colisão corrigida (opção A escolhida pelo dono):** a barra flutuante de abas (`lab-dock.tsx`, usada hoje só pelo Indique e Ganhe) ficava no rodapé e encostava na boia em tela estreita. Ela sobe no celular (`bottom-28`) e volta ao pé no desktop (`sm:bottom-6`), onde não há conflito.
- **Memória da conversa (pergunta no chat, 05/08/2026):** o modelo SEMPRE recebeu o histórico, mas a quebra em balões tinha estragado isso sem ninguém notar: como uma resposta virou 2 ou 3 mensagens, o limite de 6 falas do servidor era gasto em ~2 trocas e a conversa "esquecia" o começo. Agora o widget **junta balões seguidos do robô numa fala só** antes de mandar, e o limite subiu pra **10 falas** (~5 idas e voltas). É por isso que "não entendi, explica melhor" funciona. Cada conversa tem memória própria: começar uma nova zera o contexto de propósito.
- **Tempo dos pontinhos (ajuste no chat, 05/08/2026):** ficavam de 0,35s a 1,4s, tempo curto demais pra parecer alguém escrevendo. Agora vão de **1,6s a 4,5s** no 1º balão e de 1,2s a 3,5s nos seguintes, proporcionais ao tamanho do texto (`pausaDigitando`). Pessoa de verdade levaria uns 20s pra digitar 150 caracteres, o que seria espera chata; essa faixa é o meio-termo. **Nas respostas prontas os 10s descontam essa pausa**, senão a resposta pronta demoraria uns 14s pra aparecer em vez dos 10 pedidos.
- **Pontinhos só na hora certa + texto saindo letra por letra (pedido no chat, 05/08/2026):** enquanto o modelo pensa a conversa fica só no "lido", SEM pontinhos (é o que acontece de verdade: leu e ainda não começou a escrever). Os pontinhos aparecem quando a resposta JÁ chegou, logo antes de cada balão, e então o texto é revelado progressivamente com um cursor piscando. O balão em revelação vive num estado `parcial` **fora das conversas**: gravar no localStorage a cada letra seriam dezenas de escritas por resposta. O tempo de revelação é fixo por balão (400ms a 1,6s), não por caractere, senão resposta grande demoraria uma eternidade. O scroll fica SECO durante a revelação (`behavior: "auto"`), porque rolagem suave disparando 35x por segundo treme.
- **Resposta em vários balões (pedido no chat, 05/08/2026):** `partirResposta()` em `lib/suporte-conversas.ts` quebra a resposta e o widget solta um balão de cada vez, com os pontinhos entre eles. Regras: parágrafo é a divisão natural; **lista NUNCA é quebrada** (mandar "- Bronze: 5" e "- Prata: 12" separados fica ilegível, então o bloco com marcadores vira um balão só); parágrafo comprido corta no fim de FRASE, nunca no meio; alvo de 170 caracteres por balão e teto de 4 balões, com o resto entrando no último. Os botões de tela entram só no último balão. Conferido com respostas reais do qwen: curta continua em 1 balão, a de níveis vira 2 (lista inteira + fecho).
- **Histórico e várias conversas (pedido no chat, 05/08/2026):** antes o histórico só vivia na memória do React, então F5 ou fechar a aba apagava tudo. Agora: **[NEW] `src/lib/suporte-conversas.ts`** guarda as conversas no `localStorage` (`suporte_conversas`), cada uma valendo **24h a partir da última mensagem**, teto de 12 guardadas. O widget ganhou botão de **nova conversa** e uma **lista** de conversas (com título tirado da 1ª pergunta, "há X min" e apagar). Escolha do banco: **não** foi pro MySQL de propósito (papo com robô sobre documentação não é dado de negócio, e evita tabela/migração); o preço é não seguir a pessoa entre aparelhos.
  - **Armadilha da hidratação:** o `localStorage` é lido no CLIQUE que abre o widget (`abrirWidget`), nunca durante a renderização, senão o HTML do servidor e o do navegador divergiriam. É lá também que as conversas vencidas somem.
  - **Armadilha da resposta atrasada:** `perguntar()` captura o id da conversa e todas as alterações passam por `mexerNa(id, ...)`. Sem isso, trocar de conversa enquanto o robô responde jogaria a resposta na conversa errada. O `espelho` (ref) existe pra calcular o próximo estado fora do React e não gravar no localStorage de dentro de um `setState`.
- **Conversa parada por muito tempo (pergunta no chat, 05/08/2026):** conferido, não quebra nada. Sessão dura 7 dias, a conversa vale 24h, os limites por usuário são por janela e o `AudioContext` é retomado quando volta do segundo plano. O ÚNICO efeito real é o modelo esfriar: o Ollama descarrega depois de ~5 min parado, então quem deixava a caixa aberta e voltava 10 minutos depois pegava os ~45s de carregamento. Corrigido: além de aquecer ao ABRIR, agora aquece também **ao clicar no campo de escrever** (o servidor ignora repetição dentro de 4 min, que é menos que os 5 min de descarga).
- **Armadilha do servidor lento (medida em 05/08/2026):** o LLM roda na máquina do dono, não numa nuvem. Com o modelo descarregado da memória a primeira resposta leva **~45s**; quente, **~10s**. O timeout inicial de 45s reprovava SEMPRE a primeira pergunta (502 no log). Agora: `maxDuration = 300`, espera de 240s no `chat()`, um `GET /api/suporte/chat` que **aquece o modelo quando a pessoa ABRE a conversa** (dispara e responde 204 na hora, no máximo 1 a cada 4 min por usuário, que é menos que o tempo de descarga do Ollama) e um aviso na tela depois de 15s de espera. Não encurtar esses limites de novo.
- **Armadilha resolvida no teste real:** o qwen às vezes gruda o "LINKS:" no fim do parágrafo em vez de pôr em linha própria, e cita a rota crua no meio da frase. Por isso `separarLinks` procura a marca por POSIÇÃO (não por início de linha) e `limparTexto` troca `/painel/x` pelo nome da tela e tira o `**` de markdown. Sem isso o usuário via "LINKS: /painel/..." na bolha.

### ✅ 3 e 6. Reordenar o menu lateral: Minerador em Ferramentas, Academy no fim (2026-08-05)
**Solução aplicada** em `src/components/app/nav-links.tsx`:
- "Minerador" saiu de `navTopo` e entrou no fim de `ferramentasSub` (submenu retrátil de Ferramentas).
- "Viraliza Academy" saiu de `navTopo` e entrou como primeiro item de `navFim`, logo depois do bloco de Ferramentas.
- Armadilha conhecida: com a barra lateral RECOLHIDA o `ferramentasSub` não é renderizado (só o ícone de Ferramentas, que leva pra grade `/painel/ferramentas`). Ou seja, o Minerador agora só aparece na barra expandida, igual aos outros itens do submenu. A rota `/painel/minerador` continua existindo normalmente.

### ✅ 8. Aviso de geração em segundo plano no Viral Boost e no Labs (2026-08-05)
**Solução aplicada:**
- `src/components/app/viral-boost.tsx` e `src/components/app/lab-gerando.tsx`: o textinho cinza "pode fechar a aba" virou um bloco destacado (borda e fundo na cor primária, ícone de sino) com o aviso completo de 3 a 5 minutos + notificação no sininho + onde achar o vídeo, e o botão "Acompanhar em Meus vídeos" apontando pra `/painel`.
- No Labs o bloco aparece em `rodando` (enviando + gerando), não só em "gerando", pra não ter um vago em que a tela fica sem explicação.
- Confirmado que a promessa do sininho é verdadeira: `/api/boost/video` e `/api/lab/video` chamam `criarNotificacao` com `video_pronto` e `video_erro`.

### ✅ 10. Removido o botão repetido "Novo vídeo" do cabeçalho de Meus vídeos (2026-08-05)
**Solução aplicada:** `src/app/(app)/painel/page.tsx` sem o `<Button>` pra `/painel/novo` no cabeçalho (o acesso já está no menu Ferramentas > Editor automático). O wrapper flex do cabeçalho, que existia só pra separar título e botão, foi simplificado. O botão "Criar primeiro vídeo" da lista vazia continua como está.

### ✅ Sessão jun/2026 — Sistema de créditos "2 em 1" (via chat, não estava aqui)
- **Carteira no banco:** `CreditoTransacao` + campos em `User` (`saldoCentavos`, `assinante`, `assinaturaAte`, `creditoMensalEm`). Libs `creditos.ts` + `precos.ts`.
- **Travas de acesso:** `requireAssinatura` (biblioteca); crédito + limite de 3 jobs simultâneos (`/api/jobs`, `/api/cortes`, `/api/leads`).
- **Débito por custo real:** worker (`bot shopee/`) instrumentado (`uso.py`, `gemini_copy._call`, `narrar_video`, `consumo.json`) → `/api/worker/concluir` debita (clamp em 0, idempotente). Job que falha não paga.
- **Telas:** `creditos` (pacotes + painel teste admin, sem extrato), `conta` (dados, plano, trocar senha, BYO "em breve"), `extrato` (resumo + gráfico + filtros + busca). Saldo + barra "% disponível" na sidebar.
- **Editor:** "Editar esse vídeo" (`?video=`, em cópia) e "Reutilizar ajustes" (`?reutilizar=`). Estimativa "no máximo X créditos".
- **Menu:** "Meus vídeos" dedicado; "Ferramentas" abre a grade + submenu sempre visível; "Sair" só no menu do nome.
- **Limpeza/correções:** travessões "—" removidos (regra em `temporary_rules.md`); worker forçado a UTF-8; fix `DropdownMenuLabel`/Group; `suppressHydrationWarning`; fuso fixo no extrato; apagados `novo-video-form.tsx` e `logout-button.tsx`.
- **Pendente:** ver `reminder.md` (Kiwify, calibrar preços, instrumentar Cortes, BYO key, Minimax).

---

# Claude 2

## Tarefas Pendentes — Claude 2:


---

## Tarefas Concluídas — Claude 2:


---

*Última atualização: 2026-06-30*
