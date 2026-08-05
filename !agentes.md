## Claude 1 | inicio: 2026-08-05 19:35
- ocioso
- NOTA (Claude 1): tela /painel/inicio REFEITA, agora e o catalogo da plataforma
  inteira. O catalogo (lista de cartoes) mora em `src/components/app/inicio-hub.tsx`
  e e o UNICO lugar a mexer quando entrar ferramenta nova: a `inicio/page.tsx` so
  busca dados. Tambem mexi em `hero-hub.tsx` (herói novo, com o estado da conta),
  `categoria-card.tsx` (prop opcional `selo`) e `lib/jobs.ts` (novo
  `contarVideosDoUsuario`). Detalhes no `!projeto.md` (secao "Rotas do painel").
  `npx tsc --noEmit` e `npx eslint` limpos; tela conferida renderizando de verdade
  no dev server em 3 casos (com assinatura, sem assinatura e admin).

## Claude 2 | inicio: 2026-08-05 19:15
- ocioso (acabou de entregar /admin/criacoes + botao "Ver criações" na tabela de usuarios)

## Claude 3 | inicio: 2026-08-05 19:20
- ocioso
- NOTA (Claude 3): os 4 cartoes da /painel/lab/inicio tocam video agora. A pasta
  `public/lab/` FOI APAGADA: os videos estao no serverrk em
  `/mnt/ssd/viraliza/media/lab/ferramentas/<chave>.mp4` + `<chave>.jpg`, via
  `midiaFerramenta` no `lib/lab-midia.ts`. Os 8 arquivos JA FORAM SUBIDOS
  (05/08/2026, com autorizacao do dono, unica excecao a regra de so-leitura do
  serverrk) e as 8 URLs conferidas respondendo 200. Video cru do Grok (960px,
  ~8MB) NAO pode subir: recomprimir pra 480px sem audio antes, a linha de ffmpeg
  esta no comentario do topo do `lab-inicio.tsx`.
- ARMADILHA descoberta nisso: a media.univershoop.com responde com
  `max-age=14400` (4h de Cloudflare) e guarda ate o 404. Se voce testar a URL
  ANTES de subir o arquivo, ela continua 404 depois de subir ate revalidar.
  Documentado no topo do `lib/lab-midia.ts`, vale pra TODA midia de exemplo do
  Lab (estilos, movimentos, cenarios), nao so pros cartoes.

## Claude 2 | inicio: 2026-08-05 19:05
- Robo de suporte: passos guiados com as OPCOES de cada tela explicadas e fim do
  limite de 35 palavras da resposta livre. ESCOPO: so o chat de suporte.
  | arquivos: src/lib/suporte-guia.ts, src/lib/suporte-base.ts,
  src/app/api/suporte/chat/route.ts

## Avisos herdados (registros abandonados, mantidos como contexto)
- (ex-Claude 2) Tela /admin/criacoes ("Criacao dos usuarios") juntando videos +
  imagens + avatares: mexeu em src/lib/criacoes.ts, src/app/actions/criacoes.ts,
  src/app/(app)/admin/criacoes/page.tsx, src/components/app/admin-criacoes.tsx,
  admin-usuarios.tsx, usuarios-admin.tsx e nav-links.tsx (adminItems).
- (ex-Claude 3) Cobranca de 5 creditos do Gerador de prompt + tela /painel/lab/inicio
  com video nos cartoes. O `npm run build` pode nao fechar por causa da tela
  /admin/criacoes (importa `criacoes.ts`, que e server-only, dentro de client component).
- (ex-Claude 3) ATENCAO ENCODING: o `lab-inicio.tsx` apareceu com os acentos
  corrompidos ("CartAues") depois de uma edicao externa. Se editar .tsx por fora do
  Claude, conferir o encoding do editor: o repo e UTF-8 e o mesmo estrago aparece
  no !agentes.md.
- (ex-Claude 3) TESTE: video do cartao "Criar criativo" em `public/lab/videos/`.
  RESOLVIDO em 05/08/2026 pelo Claude 3: a pasta nao existe mais, os 4 videos
  foram pro serverrk (ver a NOTA do Claude 3 acima).
- (ex-Claude 2) Worker local rodando em background pra teste do Editor; venc.py
  copiado do serverrk pra bot shopee/.
- (ex-Claude 1) O passo a passo do robo de suporte agora e CODIGO
  (`src/lib/suporte-guia.ts`), nao mais o modelo. A rota `api/suporte/chat` tenta a
  guia antes do LLM. Se mexer nos textos dos passos, os 40 primeiros caracteres de
  cada passo sao a chave que acha onde a conversa parou. Detalhes no `!projeto.md`.
- (ex-Claude 3) Editor automatico mexido de ponta a ponta (tela -> API -> worker ->
  fabrica). A montagem da tela agora CHEGA no render via `opcoes.roteiro` +
  `roteiro.json`. Bugs #22, #23 e #24 do `auditoria.md` corrigidos.
  `bot shopee/fabrica.py`, `gemini_copy.py` e `worker_serverrk.py` precisam ir pro
  container do serverrk. Detalhes no `!projeto.md` (secao "MONTAGEM DO EDITOR").

## Pendencia herdada (deixada pelo Claude 2, registro abandonado)
- 3 COMENTARIOS de codigo desatualizados falando de uma "aba Cenarios do Personalize
  com IA" que nao existe mais (virou a tela /painel/meus-avatares/cenarios):
  `src/lib/cenarios-usuario.ts:7`, `src/app/api/cenarios/route.ts:20` e
  `src/components/app/meus-cenarios.tsx:11`. Os dois primeiros tambem tem travessao,
  proibido pelo temporary_rules.md.
