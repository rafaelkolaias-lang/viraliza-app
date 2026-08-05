# Mapa do Projeto (para IAs)

> **Propósito:** índice rápido para localizar código sem precisar varrer o repo.
> **Manutenção:** atualize quando mudar estrutura, fluxo crítico ou convenção. Não documente todas as features, só o que ajuda a IA a navegar.

---

## O que é

**Viraliza** - plataforma web multi-usuário (SaaS) que reúne ferramentas de marketing/conteúdo viral. Hoje o carro-chefe é **gerar vídeo de IA** (avatar/influenciador falando, historinhas virais) pelo **Viraliza Labs**; o pipeline antigo (editor de vídeo 9:16 com voz/legenda, cortes, marca em lote, leads) continua ativo. Também tem biblioteca (acervo de cortes, virais, produtos Shopee/TikTok, área de membros). Papéis: **admin** (dono), **user**, **demo**.

**Cadastro é fechado:** só cria conta quem comprou (allowlist `AcessoPago` alimentada pelo webhook da Cakto, com consulta ao vivo como rede de segurança). Ver `src/lib/registro.ts`.

> **Entrada x pacote:** qualquer compra libera o cadastro (quem comprou crédito precisa da conta pra usar o que pagou), mas **só o plano de entrada dá assinatura e o brinde de 1.000 créditos**. Quem comprou só pacote entra sem biblioteca e sem brinde. Quem decide é `comprouEntrada()` em `registro.ts`, que olha o nome do produto na allowlist e, na dúvida, confere ao vivo na Cakto (`emailComprouEntrada`). Nome desconhecido conta como entrada de propósito, pra não barrar cliente legítimo.

> **Assinatura VENCE (não é mais permanente):** a entrada é a 1ª cobrança da mensal e libera **um ciclo** (`DIAS_ASSINATURA = 33` = 30 + 3 de folga, `creditos.ts`); cada renovação paga estende o vencimento pelo webhook (`estenderAssinatura`). Sem repagar, `assinaturaAte` passa e a biblioteca trava (o crédito comprado continua valendo). A concessão manual do admin em `/admin/usuarios` também vence em 33 dias (o admin clica de novo pra renovar). `assinaturaAte = null` (permanente) hoje só o próprio papel admin, que ignora o vencimento. Migração da base: `prisma/migracao-assinatura-expira.sql` deu 33 dias a quem estava permanente.

**Monetização "2 em 1"** (memória `modelo-monetizacao`): a **entrada** libera o cadastro e a **biblioteca**; o **crédito** (1 crédito = R$ 0,01) paga a **produção** (todo vídeo/imagem de IA, editor, cortes, lote, leads). Cadastro novo ganha **1.000 créditos** (`registro.ts:16`); assinatura dá **2.000/mês** (`creditos.ts:14`, `CREDITO_MENSAL_CENTAVOS`).

> **Preço da entrada:** não vive no código (é produto na Cakto). Comentários antigos citam R$ 19,90; a página do afiliado usa **R$ 98,90** como base da comissão de 50% e a LP do afiliado sem preço mostra **R$ 37,90**. Confirmar com o dono antes de assumir um número.

---

## Stack principal

- **Front/Back:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **UI:** Tailwind v4 + shadcn/ui sobre **@base-ui/react** + lucide-react + sonner
- **Banco:** **MySQL** via Prisma (local: XAMPP na 3306, banco `viraliza`; prod: EasyPanel)
- **Auth:** **caseiro** - JWT (`jose`) em cookie httpOnly + bcrypt **+ login com Google (OAuth2)**. NÃO usa Auth.js.
- **E-mail:** **Resend** (`src/lib/email.ts`)
- **Pagamento:** **Cakto** (ativo) + Kiwify (só histórico) + InfinitePay (doação Pix)
- **Geração de IA:** **serverrk** (robô do Grok, ver abaixo) + OpenAI `gpt-5-mini` (textos grátis) + Gemini 2.5 Flash (visão)
- **Worker antigo (PC do dono):** Python em `bot shopee/` (`worker.py`, `fabrica.py`, FFmpeg, ElevenLabs)
- **Deploy:** Docker -> EasyPanel (`DEPLOY.md`)

### Rodar local (resumo)
1. MySQL (XAMPP) na 3306. 2. `.env` raiz: `DATABASE_URL`, `SESSION_SECRET`, `WORKER_TOKEN`. 3. `npm run dev` (porta 3000). 4. Worker antigo: `bot shopee/.env` com `WEB_URL=http://localhost:3000` + mesmo `WORKER_TOKEN` + `GEMINI_API_KEY` + `ELEVENLABS_API_KEYS`, depois `python worker.py`. Contas de teste na memória `ambiente-local`.

---

## OS DOIS MOTORES DE GERAÇÃO (leia antes de mexer em vídeo)

Existem **dois caminhos totalmente diferentes**, e confundi-los é o erro mais comum:

**A) Pipeline antigo -> worker Python (`bot shopee/`)**
Usado por: Editor/Estúdio (`/painel/novo`), Cortes, Marca em lote.
Job nasce `recebendo`, vira `na_fila` só **depois** da mídia salva; o worker faz polling em `GET /api/worker/proximo` com **claim atômico** (`updateMany` com `status: "na_fila"` no `where`) e devolve por `progresso/concluir/erro`. Débito pelo **consumo real** das APIs.

**B) Vídeo/imagem de IA -> robô do Grok no "serverrk"** (NÃO passa pelo worker Python)
Usado por: Viraliza Labs, Viral Boost, avatares, Vídeo livre.
`src/lib/imagem-robot.ts` e `src/lib/video-robot.ts` falam com um servidor externo (`GROK_INGEST_URL`, header `X-Grok-Token`) que roda **Chromium logado no Grok + Flask**, com fila interna de um vídeo por vez. O app faz `POST /gerar` (ou `/gerar-imagem`) e **polling** de `/status/<id>` (vídeo até 25 min, imagem até 5 min) porque o Cloudflare corta request em ~100s.
O Job de IA **já nasce `renderizando`** (nunca entra em `na_fila`, por isso o worker Python nunca o pega) e a geração roda no **`after()` do Next**, então a pessoa pode fechar a aba. Essa é a "fila invisível". Débito por **preço fixo por duração**, só no sucesso.

O mesmo servidor hospeda mídia via WebDAV (`src/lib/serverrk-upload.ts`, header `X-Ingest-Token`, env `AVATAR_INGEST_TOKEN`), base `NEXT_PUBLIC_MEDIA_BASE` (`https://media.univershoop.com`). É lá que ficam avatares, produtos do usuário, personagens do Boost, cenários e áudios do chat.

**Kill switch sem deploy:** `src/lib/configuracao.ts` (model `Configuracao`, chaves `geracao_imagem` / `geracao_video`). Valor `off` pausa para todo mundo (rotas devolvem **503** com `{pausado:true}`); **admin sempre passa**. Liga/desliga em `/admin/diagnostico`.

---

## Onde está cada coisa

| Arquivo / Pasta | Quando ler |
|---|---|
| `src/app/page.tsx`, `login/`, `cadastro/`, `nova-senha/` | landing + auth pública (senha, Google, reset) |
| `src/app/(app)/layout.tsx` | shell logado: carteira, assinatura, avisos, chat flutuante |
| `src/app/(app)/painel/**` | telas do usuário (ver rotas abaixo) |
| **`src/components/app/inicio-hub.tsx`** | catálogo da tela de Início (TODAS as opções da plataforma). **Ferramenta nova entra AQUI**, não na `inicio/page.tsx` |
| `src/app/(app)/admin/**` | painel do dono (13 telas, ver abaixo) - `requireAdmin()` |
| `src/app/actions/*.ts` | Server Actions: `auth` (login/cadastro), **`senha`** (esqueci minha senha), `conta`, `creditos`, `usuarios`, `produtos`, `materiais`, `virais`, `notificacoes` |
| **`src/lib/registro.ts`** | trava única de cadastro (`podeCriarConta`) usada por senha e Google |
| **`src/lib/google.ts`** | OAuth2 do login com Google |
| **`src/lib/ratelimit.ts`** | rate limit por janela em banco (model `RateHit`), funciona com várias instâncias |
| **`src/lib/email.ts`** | Resend: boas-vindas, créditos confirmados, reset de senha |
| **`src/lib/cakto.ts`** + `src/app/api/cakto/` | gateway ATIVO: OAuth, `buscarPedido`, status, líquido, `sck` |
| `src/lib/kiwify.ts` + `src/app/api/kiwify/` | gateway LEGADO (só leitura histórica em Finanças e reembolsos antigos) |
| **`src/lib/infinitepay.ts`** + `src/lib/apoios.ts` | doação Pix ("Apoie o projeto"), não dá crédito nem libera nada |
| **`src/lib/afiliados.ts`** / **`afiliados-admin.ts`** | Indique e Ganhe: ranking pelas comissões da Cakto + bônus manual |
| `src/lib/meta-capi.ts` | ESCREVE na Meta: Purchase/Refund pro pixel, com **valor líquido** e `fbc`/`fbp` lidos do `sck` (`META_PIXEL_ID` + `META_CAPI_TOKEN`) |
| `src/lib/meta-ads.ts` | LÊ da Meta: gasto com anúncios no período (card "Anúncios" em Finanças). Credenciais SEPARADAS do CAPI: `META_ADS_ACCOUNT_ID` + `META_ADS_TOKEN` (usuário do sistema com `ads_read`). Armadilha: a Meta fecha o dia no fuso da CONTA (a da BM Viraliza é America/Los_Angeles), não no nosso; cache de 5 min; falha nunca derruba a página |
| `src/lib/reembolsos.ts` | regras de reembolso/chargeback (Cakto + Kiwify) |
| `src/lib/financas.ts` + `admin/financas/` | painel Finanças (bruto e **líquido**, marco zero 29/06/2026) + gasto com APIs e lucro real |
| `src/lib/uso-ferramentas.ts` + `admin/uso/` | quantas vezes cada usuário usou cada ferramenta (catálogo puro; a consulta mora em `lib/admin.ts`) |
| `src/lib/criacoes.ts` + `admin/criacoes/` | galeria única de vídeo + imagem + avatar por pessoa/período (catálogo puro; `getCriacoes` mora em `lib/admin.ts`) |
| **`src/lib/gastos-api.ts`** | gasto REAL por API (tabela `GastoApi`): registra cada consumo (OpenAI/Gemini/Veo/Eleven/Grok), agrega por API e por usuário, puxa a fatura oficial da OpenAI (`OPENAI_ADMIN_KEY`). Preços/cotação por env (`USD_BRL`, `GROK_CUSTO_10S_CENTAVOS`, `VEO_USD_SEG`...) |
| `src/instrumentation.ts` | boot: agenda varredura de reembolsos (1 min após subir, depois 10 em 10 min) |
| `src/lib/session.ts`, `dal.ts` | sessão JWT + guardas `requireUser`, `requireAdmin`, `requireAssinatura`, **`guardaBiblioteca`** (páginas da biblioteca: erro na tela, sem redirect), `assinaturaAtiva`, **`ferramentasLiberadas`** |
| `src/lib/creditos.ts` | carteira: `getCarteira`, `temSaldo`, `debitar`, `debitarClamp`, `lancar`, `estenderAssinatura`, `garantirCreditoMensal`, `listarExtrato` + `DIAS_ASSINATURA` |
| **`src/lib/configuracao.ts`** | kill switch de geração de imagem/vídeo |
| **`src/lib/lab-*.ts`**, `estilos-camera.ts`, `movimentos.ts` | Viraliza Labs (custos, durações, prompts, mídia de exemplo) |
| **`src/lib/viral-boost*.ts`**, `boost-servidor.ts` | Viral Boost (elenco, historinhas, cenários, prompts) |
| **`src/lib/avatar-modelo.ts`** | opções do quiz de avatar + **preços de avatar e vídeo de IA** (client-safe) |
| `src/lib/avatar-json.ts`, `avatar-foto.ts`, `produto-shot.ts`, `gerador-prompt.ts` | montagem dos prompts de imagem e vídeo |
| `src/lib/avatares.ts`, `avatares-prontos.ts`, `cenarios-usuario.ts`, `galeria-*.ts` | avatares do usuário, 9 avatares grátis da plataforma, cenários próprios, "Minhas imagens" |
| **`src/lib/imagem-robot.ts`** / **`video-robot.ts`** / **`serverrk-upload.ts`** | ponte com o serverrk (ver "dois motores") |
| `src/lib/openai-image.ts` | **legado**: gpt-image-1.5 não é mais chamado (comentários em `avatares.ts`/`avatar-foto.ts` ainda citam, estão desatualizados) |
| `src/lib/gemini-vision.ts`, `llm.ts` | Gemini 2.5 Flash (analisar produto) e LLM próprio (qwen2.5:14b, Ollama + Open WebUI). Envs `LLM_BASE_URL` (`https://llm.univershoop.com/ollama/v1`), `LLM_API_KEY`, `LLM_MODEL`. **Sem custo por chamada** - usado pelo minerador e pelo robô de suporte |
| `src/lib/suporte-base.ts`, `api/suporte/chat`, `components/app/suporte-chat.tsx`, `src/lib/suporte-conversas.ts` | robô de suporte (boia no canto de baixo). Base = Central de Ajuda em texto, com **preços vindos das constantes** (`lab-custos`, `avatar-modelo`, `niveis`), nunca escritos na mão. Não debita crédito. Histórico e múltiplas conversas ficam no **localStorage** (`suporte_conversas`, valem 24h), NÃO no banco. `GET` na rota só aquece o modelo (ele mora na máquina do dono: ~45s frio, ~10s quente, por isso `maxDuration = 300`). Fica abaixo do `chat-widget.tsx` (conversa com a equipe, `bottom-24`) |
| **`src/lib/suporte-guia.ts`** | **passo a passo do suporte, em código e não no modelo.** A rota tenta a guia ANTES do LLM: se a pessoa escolheu um dos 4 caminhos ("a primeira", "1", "já gravei") ou mandou seguir ("sim", "e agora?", "pode ir me falando"), a resposta sai daqui, na hora e sempre igual ("Passo 3 de 9: ..."). Qualquer pergunta de verdade continua indo pro LLM. **O estado não fica em lugar nenhum**: `ondeParou()` acha o último passo lendo as próprias mensagens do robô no histórico que o widget reenvia, casando os **40 primeiros caracteres** de cada passo (`ANCORA`) - por isso os textos dos passos são fixos e o exemplo do primeiro passo no `PROMPT_SISTEMA` é igual ao do guia, o que faz o código assumir a condução mesmo quando o modelo começa sozinho. Motivo: nos testes com usuário simulado o qwen2.5:14b chutava o número do passo, pulava etapas e largava a pessoa ("qual é a sua dúvida?") quando ela só dizia "sim" |
| `src/lib/minerador.ts`, `produtos-tiktok.ts` | minerador de nicho + catálogo TikTok Shop (JSON estático em `src/data/`) |
| `src/lib/sugestoes.ts`, `bonus-instagram.ts`, `promos.ts`, `presenca.ts` | sugestões, bônus IG, constantes de promoção, "online" do admin |
| `src/lib/marca-lote-client.ts` + `api/marca-lote/`, `api/lote-acervo/` | marca em lote (logo salva por usuário, posição livre) |
| **`src/lib/montagem.ts`** | montagem do Editor: tipos + validação do roteiro (ordem, cortes, clipe principal, textos, volumes). Client-safe de propósito: a tela e a API usam a MESMA normalização |
| `src/app/api/jobs/**`, `api/cortes/`, `api/leads/buscar/` | pipeline antigo: trava de crédito + limite de jobs simultâneos. `jobs/[id]/remix` = reajustar áudio de um vídeo pronto |
| `src/app/api/worker/**` | endpoints do worker Python + ingestão do bot Telegram |
| `src/app/api/lab/**`, `api/boost/**`, `api/avatar/**`, `api/imagens/`, `api/cenarios/` | geração de IA (ver seção do Labs) |
| `src/app/api/chat/`, `api/admin/chat/` | chat interno admin <-> usuário (texto e áudio) |
| `src/app/api/reportes/`, `api/sugestoes/`, `api/bonus-instagram/` | reporte de vídeo com reembolso, sugestões, bônus IG |
| `src/app/api/midia/[...slug]/` | serve mídia gravada em runtime com Range |
| `prisma/schema.prisma` | modelo de dados (fonte da verdade, 26 models) |
| `bot shopee/` | worker de render antigo (Python, PC do dono - memória `worker-python`) |
| `bot telegram/` | bot Telethon que ingere virais e produtos pras galerias |

### Rotas do painel (menu em `src/components/app/nav-links.tsx`)

**Topo:** `inicio`, `/painel` (Meus vídeos), `shopee`, **`tiktok`** (Produtos TikTok), `acervo`. (**`viral-boost`** NÃO fica no topo: ele abre o bloco depois dos grupos, ver "Fim".)

**Grupos retráteis** (05/08/2026): o menu tem 3, montados pelo array `GRUPOS` + componente `GrupoRetratil` + hook `useGrupoAberto` (estado no localStorage: `nav_personalize_aberto`, `nav_lab_aberto`, `nav_ferramentas_aberto`; evento `nav-grupo`).
- **Personalize com IA:** `meus-avatares/criar` = **"Novo influenciador"** (as 3 formas de criar com IA; era "Criar com IA" até 05/08/2026, não dizia criar O QUÊ), `meus-avatares` (galeria), `meus-avatares/cenarios`. **A palavra oficial no texto que o usuário lê é INFLUENCIADOR**, nunca "influencer" (o app misturava as duas; só sobrou "influencer" dentro de exemplos de fala citados na ajuda). O botão que gera de verdade, no fim do quiz, continua "Criar influenciador": é outro clique, e o robô de suporte instrui em cima dele.
- **Viraliza Labs:** `lab` (funil guiado), `lab/livre`, `lab/imagens`, `lab/prompt`.
- **Ferramentas:** `novo` (Editor automático), `lote`, `leads`, `cortes`, `minerador`. As 5 pastas moram no **route group `(ferramentas)`** (05/08/2026): parêntese = pasta que NÃO entra no endereço, então as URLs seguem `/painel/novo` etc. Ela existe só pra dar uma casca comum a telas que não compartilham prefixo de rota (é lá que mora a barrinha do rodapé).

> **Armadilhas do menu:** (1) clicar no NOME do grupo só abre/fecha, não navega - a tela de cada grupo já é um dos atalhos. **Exceção: grupo com `navegavel: true`** (hoje os 3 têm), onde o nome vira `Link` pra `grupo.raiz` e só a setinha recolhe/expande. Nos 3 a `raiz` é a **porta de entrada** do grupo (`lab`, `meus-avatares/criar`, `novo`), não a rota-contêiner. (2) A rota `/painel/ferramentas` (grade de cards) foi **APAGADA** em 05/08/2026: virou clique a mais pro mesmo lugar. (3) `SubItem.exato` existe porque a raiz do grupo também é sub-item: sem ele, `/painel/meus-avatares/criar` acenderia "Galeria de avatares" junto. (4) Com a barra RECOLHIDA os sub-itens não aparecem: sobra o ícone do grupo, que leva pra `grupo.raiz`.
**Fim:** **`viral-boost`**, **`academy`**, **`assinatura`** (status/vencimento/renovar - `requireUser`, aberta a não-assinante pra ele renovar), `creditos`, **`ajuda`** (Central de Ajuda), **`indique`** (Indique e Ganhe), **`sugestoes`**, **`blog`** (ver abaixo). A antiga **`apoiar`** (doação Pix) foi DESCONTINUADA em 04/08/2026: a rota redireciona pro `blog`; `lib/apoios`, webhook InfinitePay e `apoiar-painel.tsx` ficaram no código só pelo histórico.
**Outras:** `conta`, `extrato`, `membro`, `produtos`, `virais`, `videos/[id]`. `/painel/avatar` é rota morta (redirect pro `lab`) e `/painel/ferramentas` não existe mais (dá 404).

**Início (`/painel/inicio`, REFEITA em 05/08/2026):** é o **mapa da plataforma inteira**, não mais a vitrine do acervo. Antes ela mostrava só acervo + 3 ferramentas + ebooks (ficavam de fora Labs, Viral Boost, Personalize, Minerador, lote, TikTok, assinatura, créditos, ajuda, indique) e 3 cartões diferentes levavam todos pro MESMO `/painel/acervo`. Hoje: **herói** (`components/hub/hero-hub.tsx`) com o estado da conta em tarjinhas clicáveis (créditos, vencimento da assinatura, vídeos prontos e em produção) + **4 seções de cartões** com âncora (`#criar`, `#ferramentas`, `#biblioteca`, `#conta`).
> **O catálogo mora em `src/components/app/inicio-hub.tsx`, e é o ÚNICO lugar a mexer: ferramenta nova = cartão novo ali**, a `page.tsx` só busca dados. Server Component (zero JS). Regras da tela: (1) o que está travado (biblioteca/Minerador sem assinatura) e o que não abriu (Academy, Blog sem artigo) **aparece com etiqueta em vez de sumir**, senão ninguém descobre que existe pra querer assinar; (2) **nenhum cartão cita preço**, de propósito, pelo mesmo motivo do `lab-inicio.tsx` (não virar um 2º lugar pra desatualizar); (3) os ícones são os MESMOS do `nav-links.tsx`, pra reconhecer o item na barra depois. A seção Biblioteca usa o `CategoriaCard` (ganhou prop opcional `selo`). A contagem de vídeos vem do **`contarVideosDoUsuario`** (`lib/jobs.ts`): dois `count`, em vez do `getJobsDoUsuario`, que carregaria todos os jobs pra jogar fora.

**Blog (`/painel/blog`, estrutura pronta desde 04/08/2026):** os artigos são objetos em **`src/lib/blog.ts`** (`ARTIGOS_BLOG`, hoje vazio = a tela mostra o "em breve" do `em-breve.tsx`, igual ao `academy`). Cada artigo tem `previa` (aberta a qualquer usuário logado) e `conteudo` (o resto); com `exclusivo: true` o resto exige assinatura. **O corte é no SERVIDOR**: `blog/[slug]/page.tsx` só passa `conteudo` pro `<BlogLeitura>` quando `podeLerCompleto()` é true, então o texto pago não vai no HTML de quem não pode ler. O botão "Continuar lendo" (client) expande pro assinante e mostra o convite de assinatura pro resto. Blocos de texto em `blog-blocos.tsx` (paragrafo, subtitulo, lista, destaque).

**Gates:** biblioteca (`acervo`, `virais`, `shopee`, `produtos`, `tiktok`, `membro`, `minerador`) usa `guardaBiblioteca()` na página: sem assinatura **mostra `<BibliotecaBloqueada/>` no lugar do conteúdo** (erro na tela, NÃO redireciona mais). A rota de API do Minerador usa `assinaturaAtiva()` (mesma regra, responde 403); a server action `maisVirais` ainda usa `requireAssinatura()` (redirect, rede de segurança do scroll). Produção exige saldo; `User.ferramentasLiberadas` desliga as ferramentas de um usuário; kill switch global em `Configuracao`.

### Admin (`/admin/*`)
`page.tsx` (visão geral com 3 cards de pendência: reportes, sugestões, bônus IG), `financas`, `uso` (uso por ferramenta), `criacoes` (o que a galera criou), `usuarios`, `bonus` (IG), `indicacoes`, `chat`, `reportes`, `excluidos` (soft-delete), `notificacoes` (avisos + lotes do sininho), `diagnostico` (erros por serviço, saldo ElevenLabs, kill switch, estorno).
As telas `videos`, `imagens` e `avatares` continuam existindo e funcionando, mas **saíram do menu** (05/08/2026): as três respondiam a mesma pergunta em lugares diferentes e viraram a `criacoes`. Links antigos seguem valendo.

**Criação dos usuários (`/admin/criacoes`):** vídeo + imagem + avatar de todo mundo numa galeria só, em ordem de acontecimento, com filtro de pessoa, período e tipo. Tipos, rótulos e a regra de "de qual ferramenta veio" ficam em `src/lib/criacoes.ts` (**puro**, a galeria roda no navegador) e a consulta `getCriacoes(filtro)` em `src/lib/admin.ts`. São 3 tabelas (`Job`, `ImagemGerada`, `Avatar`) buscadas com o mesmo filtro e mescladas por data aqui no código. **Paginação por data, não por página numerada** (com 3 fontes o número da página não bateria): o "carregar mais" manda a data do último item e o corte é `lte`, não `lt`, pra não perder quem foi criado no mesmo milissegundo (um lote de marca d'água cria vários juntos); a galeria descarta pela chave `tipo:id` o que já está na tela. Vídeo com erro e em produção aparecem com etiqueta; `recebendo` (rascunho de upload) e `excluido` (tem tela própria) ficam de fora. O botão "Ver criações" na tabela de usuários e na visão geral abre essa tela já com `?u=<userId>`.

> **Armadilha do `server-only`:** tanto `criacoes.ts` quanto `uso-ferramentas.ts` são importados por componentes `"use client"`. Se puser `import "server-only"` neles (ou importar `prisma` ali dentro), o build do Turbopack quebra com "You're importing a module that depends on server-only". O padrão do projeto é: **catálogo/tipos no arquivo puro, consulta com prisma em `lib/admin.ts`**.

**Uso por ferramenta (o que cada pessoa fez e quantas vezes):** catálogo em `src/lib/uso-ferramentas.ts` (puro, serve cliente e servidor: as 12 ferramentas contáveis, grupos imagem/videoIa/outro, períodos da tela) + a consulta `contarUsoPorUsuario(desde)` em `src/lib/admin.ts`. Aparece em dois lugares: na tabela da visão geral (colunas Imagens / Vídeos IA / Outros, detalhe completo na gaveta do "Gerenciar", totais e ranking no rodapé) e na tela `/admin/uso` (`admin-uso.tsx`: planilha ordenável, filtro de período, totais). **Nada disso tem coluna própria no banco**, tudo é derivado: imagem sai de `ImagemGerada.origem`; lote e cortes saem de `Job.tipo`; Lab, Viral Boost e Novo influenciador gravam a marca de origem no JSON de `Job.opcoes` (`{"lab":true}` / `{"boost":true}` / `{"avatar":true}`); o que sobra de `tipo: "produto"` é Editor automático. **Armadilha:** os 3 fluxos de IA hospedam o vídeo na mesma pasta `/avatares/` do serverrk, então a pista do caminho (usada só pro histórico do Novo influenciador, que não nascia marcado antes de 05/08/2026) é o ÚLTIMO critério, depois das marcas, senão vídeo do Lab conta como Novo influenciador. Vídeo com erro e vídeo excluído contam (mede uso e crédito gasto, não acervo).

---

## Viraliza Labs, Viral Boost e avatares (features principais hoje)

**Viraliza Labs** (aberto a todos os logados). **`/painel/lab/inicio` é a porta de entrada** (05/08/2026): tela de apresentação com as 4 ferramentas explicadas e um botão em cada (`lab-inicio.tsx`), pra onde o NOME "Viraliza Labs" do menu leva. Ela **não** fica em `/painel/lab` de propósito: aquele endereço é onde o login cai (`DEPOIS_DO_LOGIN`), pra onde a galeria manda a imagem no "Novo vídeo" e o que o aviso de vídeo pronto abre. É a mesma ideia da extinta `/painel/ferramentas`, mas com o que faltava lá: ela EXPLICA em vez de repetir atalho, e não entra no caminho de quem já sabe aonde vai. A barrinha do rodapé some nela (a tela já é a lista). São **4 rotas** de ferramenta, alcançáveis por **dois caminhos de propósito** (redundância pedida pelo dono em 05/08/2026): o grupo retrátil "Viraliza Labs" da barra lateral **e** a barrinha flutuante do rodapé (`lab-barra.tsx` -> `barra-ferramentas.tsx` -> `lab-dock.tsx`), montada pelo `src/app/(app)/painel/lab/layout.tsx` nas 4 telas. A barrinha **navega por rota** (não é aba interna, como era na v3 do Lucas): a lista dela é a mesma do submenu, na mesma ordem. A folga de rodapé (`pb-44 sm:pb-28`) mora no layout, não nas páginas, porque a barrinha é flutuante e no celular ela sobe pra não encostar na boia do suporte. **Os 3 grupos do menu têm a mesma barrinha** (05/08/2026): `lab-barra.tsx`, `personalize-barra.tsx` e `ferramentas-barra.tsx`, cada uma montada pelo `layout.tsx` da pasta do grupo (`lab/`, `meus-avatares/` e o route group `(ferramentas)/`). `barra-ferramentas.tsx` é a parte comum (acende o item de rota mais comprida que casa com a atual; `ItemDock.exato` é pra raiz que também é ferramenta, como o "Criar criativo" em `/painel/lab`); cada grupo só define a lista, na mesma ordem do submenu lateral. **A folga de rodapé é um espaçador DENTRO da barrinha**, não `padding` no layout do grupo: quem esconde a barrinha (a tela de apresentação do Labs) também não fica com buraco no fim da página.
Cada um dos 4 cartões dessa tela toca um **vídeo quadrado de demonstração** (05/08/2026): campo `chave` em `lab-inicio.tsx` -> `midiaFerramenta` (`lib/lab-midia.ts`) -> `lab/ferramentas/<chave>.mp4` + `<chave>.jpg` no **serverrk**, mesmo esquema dos exemplos de estilo e movimento. Chaves: `criar-criativo`, `video-livre`, `minhas-imagens`, `gerador-prompt`. **Vídeo cru do Grok não pode subir**: vem em 960px e a tela toca os quatro de uma vez (32MB contra 2,25MB depois de recomprimir pra 480px sem áudio). A linha de `ffmpeg` do tratamento está no comentário do topo do `lab-inicio.tsx`. Cartão sem `chave` cai no ícone grande. **Armadilha que vale pra TODA mídia de exemplo do Lab:** a `media.univershoop.com` responde com `max-age=14400`, ou seja, **4 horas de cache na Cloudflare**, e ela guarda até o **404**. Trocar um arquivo mantendo o mesmo nome não aparece na hora, e testar a URL ANTES de subir o arquivo deixa o erro grudado depois de subir (`Ctrl+Shift+R` revalida). Detalhes no topo do `lib/lab-midia.ts`.
- `/painel/lab` = o funil guiado, em 3 etapas: **cena** (estilo -> produto -> influenciador -> cenário -> resumo) -> **imagem** -> **vídeo** (config -> movimento -> resumo). UI em `viraliza-lab.tsx` + `lab-*.tsx`.
- `/painel/lab/imagens` = **Minhas imagens** (`lab-galeria.tsx`): galeria do que já foi gerado; o botão "Novo vídeo" gera vídeo de uma imagem já paga sem refazer.
- `/painel/lab/livre` = **Vídeo livre** (`video-livre.tsx`): chat estilo Grok, prompt livre + imagens + 6/10/15s + idioma.
- `/painel/lab/prompt` = **Gerador de prompt** (`gerador-prompt.tsx`): IA com visão escreve a ficha técnica. **Era grátis; passou a custar `CUSTO_PROMPT_LAB` (5) em 05/08/2026** (rota `api/avatar/gerar-prompt`, que era a única de IA sem cobrança). É a ÚNICA ferramenta de texto que cobra, porque manda as fotos pro modelo de visão: se mexer no preço, revisar os textos que citam a "regra de ouro" de que todo texto é de graça (`ajuda-comecar.tsx`, `suporte-base.ts`, `suporte-prontas.ts`, `ajuda-conta.tsx`, `ajuda-videos.tsx`).

**Armadilha (`src/lib/lab-handoff.ts`):** dois atalhos cruzam essas rotas, e como não existe mais uma tela-mãe segurando o estado, eles passam o recado por **memória do módulo** (não `sessionStorage`, que estoura a cota com as fotos em base64 do gerador): "Novo vídeo" da galeria leva imagem + contexto pro funil abrir direto no passo do vídeo, e "Usar no Vídeo livre" leva o prompt + as fotos. Quem recebe **lê na montagem do estado** (`useState(espiar...)`) e **apaga num `useEffect`** depois; ler e apagar são passos separados porque o ESLint proíbe `setState` dentro de efeito e consumir durante a renderização quebra no modo estrito. Sem o apagar, entrar no Labs pelo menu na vez seguinte cairia de novo no vídeo da imagem anterior. O cabeçalho comum das 4 telas é o `lab-cabecalho.tsx`.

**Viral Boost** (`/painel/viral-boost`): historinhas virais em 5 passos (formato -> personagens -> historinha -> cenário -> gerar). Formatos `frutas` (até 3 personagens) e `senhora`. Elenco fixo + personagens do usuário; 10 historinhas prontas ou escrita pela IA. **A duração sai da quantidade de imagens** enviadas ao motor: 1 imagem = 15s, 2 ou 3 = 10s (`viral-boost.ts:465`).

**Central de Ajuda** (`/painel/ajuda`): manual didático em página única (Server Components, zero JS), índice fixo por âncoras + 16 seções numeradas em 5 grupos. **A numeração é automática:** `src/lib/ajuda-indice.ts` (`GRUPOS_AJUDA` + `numeroDaSecao`) alimenta o índice lateral E o número do título, então mexer na ordem lá arruma os dois juntos. Blocos de montar em `ajuda-blocos.tsx` (`Secao`, `Passo`, `Aviso` dica/atencao/erro, `Cartao`, `Selo`, `Tabela`, `Atalho`, `Problema`); conteúdo em `ajuda-comecar` / `ajuda-influenciador` / `ajuda-videos` / `ajuda-ferramentas` / `ajuda-conta`. Seção nova = id no índice + `<Secao id="...">` no grupo. Botão de suporte usa `WHATSAPP_SUPORTE` (sem env, cai pra `/painel/sugestoes`). Os preços e limites citados no texto são cópia do código (ver lembrete no `reminder.md`).

**Personalize com IA** (`/painel/meus-avatares`): 4 modos - quiz de 7 passos, **enviar imagem** (grátis, sem IA), a partir de uma foto sua, ou junto com um produto (usos `segurando`/`rosto`/`cabelo`/`vestindo`/`mostrando`). Mais 9 **avatares prontos da plataforma** (grátis, `avatares-prontos.ts`). Segunda aba: **Cenários** próprios. **Todas as imagens saem pelo robô do Grok** (não é mais gpt-image).

**Preços (créditos), todos fixos por ação:**
| Ação | Créditos | Onde |
|---|---|---|
| Imagem do Lab / cena do Boost | 20 | `lib/lab-custos.ts:10` |
| Vídeo Lab / Boost 6s / 10s / 15s | **50 / 70 / 95** | `lib/lab-video.ts` (campo `custo`) |
| Gerar avatar | 40 | `lib/avatar-modelo.ts:366` |
| Subir avatar pronto | 0 | `api/avatar/subir` |
| Vídeo com avatar / Vídeo livre 6s / 10s / 15s | **50 / 70 / 95** | `lib/avatar-modelo.ts:400-402` |
| Textos da IA (cena, falas, ficha, roteiro) | 0 | rotas `gpt-5-mini` |
| **Gerador de prompt** | **5** | `lib/lab-custos.ts` (`CUSTO_PROMPT_LAB`) |

Regra: **checa saldo antes, debita só depois que a mídia existe**; falha nunca cobra; admin e demo não pagam.

**CUSTO REAL do motor de vídeo (o que a plataforma paga).** É a base pra decidir preço; não confundir com a tabela de créditos acima.

A cota do robô do Grok é medida em **SEGUNDOS gerados**, não em número de vídeos. Base do cálculo: assinatura **US$300/mês** (≈ R$1.539 com o dólar a R$5,13) e cota de **~7.364 segundos por semana**, medida em produção em 03-04/08/2026 (3.682 s gerados = 50% da semana). Custo fixo: cota não usada é dinheiro perdido, então o custo por segundo depende de quanto se aproveita.

| Uso da cota | Por segundo | 6s | 10s | 15s |
|---|---|---|---|---|
| 100% (teórico) | R$ 0,0488 | R$ 0,29 | R$ 0,49 | R$ 0,73 |
| 90% | R$ 0,0542 | R$ 0,33 | R$ 0,54 | R$ 0,81 |
| **85% (base de planejamento)** | **R$ 0,0574** | **R$ 0,34** | **R$ 0,57** | **R$ 0,86** |
| 80% | R$ 0,0610 | R$ 0,37 | R$ 0,61 | R$ 0,92 |

**Imagem custa ~R$ 0,01** (ordem de grandeza abaixo do vídeo e fora da cota de segundos), por isso segue em 20 créditos com margem alta.

Margem da tabela atual a 85% de uso: **6s +31%, 10s +18%, 15s +9,4%**. O de 15s é o mais apertado e responde por ~59% do volume; se a utilização cair pra 80% ele fica em +3,7%, então é o primeiro a revisar (105-110 créditos) se o custo subir.

**Não existe desconto por vídeo sem fala** (o antigo `DESCONTO_SEM_FALA` foi removido): mudo ocupa os mesmos segundos que falado. As duas tabelas de vídeo (Lab e avatar) são **iguais de propósito**, mesmo motor e mesma cota - se mudar uma, mude a outra.

> Refazer a conta quando mudar o plano do Grok, o dólar ou a cota: `custo por segundo = (US$/mês × dólar ÷ 4,29 semanas) ÷ (segundos da cota × % de uso)`.

**Anti-cobrança-dupla:** as rotas de vídeo procuram job igual do mesmo usuário nos últimos 20 min (mesma imagem + mesma fala, ou mesma historinha + personagens) e devolvem `{jaRodando:true, custo:0}` em vez de abrir outro.
**Regra dura:** vídeo de 15s aceita **só 1 imagem** de referência; 6s e 10s aceitam até 3.

---

## Banco de Dados - Tabelas-chave (26 models)

| Tabela | Propósito |
|---|---|
| `User` | conta, papel, bloqueio, carteira (`saldoCentavos`, `assinante`, `assinaturaAte`, `creditoMensalEm`), `vistoEm` (presença), `ferramentasLiberadas`, `elevenKey` cifrada, `senhaHash` **opcional** (null = só Google) |
| `CreditoTransacao` | extrato (compra, débitos, `bonus_assinatura`, `ajuste_admin`, estorno, suspensão/reversão de reembolso). `kiwifyOrderId` é a chave de idempotência (vale pra Cakto e pro bônus de indicação) |
| `AcessoPago` / `CreditoPendente` | allowlist de cadastro / crédito comprado antes de ter conta |
| `Job` | pedido de vídeo dos DOIS motores. `status`: `recebendo` -> `na_fila` -> `renderizando`/`processando` -> `pronto`/`erro`, mais `excluido` (soft-delete com `excluidoEm`/`excluidoPor`). `opcoes` guarda `{lab:true|boost:true, entrada:{...}}` |
| `Avatar` | influenciador do usuário (imagem no serverrk + JSON `escolhas` com a `origem`) |
| `ImagemGerada` | galeria "Minhas imagens" (`origem` lab/boost/avatar + `contexto` JSON que permite gerar vídeo sem refazer a imagem) |
| `CenarioUsuario`, `ProdutoUsuario`, `PersonagemUsuario` | mídia própria do usuário (cenário, produto, personagem do Boost) |
| `Configuracao` | kill switch geral (`geracao_imagem`, `geracao_video`) |
| `ChatMensagem` | chat interno 1:1 (texto ou `audioUrl`) |
| `ReporteVideo` | reporte de vídeo ruim + reembolso decidido pelo admin |
| `Sugestao` | sugestão/melhoria/problema, com resposta e créditos de recompensa |
| `BonusInstagram` | pedido do bônus de +300 créditos (1 por usuário, aprovação manual) |
| `Apoio` | doação Pix InfinitePay (`orderNsu` unique) |
| `PasswordReset` | reset de senha (guarda só o SHA-256 do token, 30 min, uso único) |
| `RateHit` | rate limit em banco |
| `Notificacao` / `Aviso` | sininho (com `loteId`) e barra do topo |
| `Lead`, `AcervoCategoria`/`AcervoVideo`, `ProdutoShopee`/`VideoShopee` | leads e biblioteca |
| `GastoApi` | contabilidade do DONO: cada consumo de API paga vira uma linha (api, recurso, quantidade, `custoMili` = milésimos de centavo, userId sem FK). Alimenta "Gasto com APIs" e "Gasto por usuário" em Finanças. Idempotente por `jobId` nos jobs do worker |

> Regra de ouro: **nenhuma IA altera o banco sem permissão explícita** (`RULES.md`).

---

## Fluxos críticos

**Auth:** `actions/auth.ts` (Zod + bcrypt cost 12) ou Google (`api/auth/google/*`) -> `createSession()` JWT 7d no cookie `sessao`. Ambos passam por `podeCriarConta` (`registro.ts`) no cadastro: 1º usuário vira admin; senão precisa de `AcessoPago`/`CreditoPendente`; senão consulta **ao vivo na Cakto** (Kiwify como fallback). Conta de entrada nasce `assinante: true` com `assinaturaAte` = hoje + `DIAS_ASSINATURA` (vence, não é permanente) e 1.000 créditos. **Depois do login cai em `/painel/lab`.** `User.bloqueado` derruba a sessão.

**Pagamento (webhook Cakto, `api/cakto/webhook`):** o corpo do webhook **nunca é acreditado** - só dá o `orderId`, e o pedido é reconfirmado na API antes de qualquer crédito. Ordem: reembolso/chargeback -> allowlist (`AcessoPago` + e-mail de boas-vindas na 1ª compra) -> Meta CAPI (`Purchase` com valor **líquido**) -> créditos do pacote (regex no nome do produto, ex.: "Viraliza 10.000 Créditos"; sem conta ainda vira `CreditoPendente`) -> renovação de assinatura (`product.type === "subscription"` lança os 2.000 como `bonus_assinatura` **e estende o vencimento por mais um ciclo** via `estenderAssinatura`, idempotente por pedido).

**Crédito mensal:** o automático do painel (`garantirCreditoMensal`) hoje é **crédito único do primeiro mês** (guardado por `creditoMensalEm`); as renovações vêm **só do webhook** de assinatura paga. Antes o mês do calendário liberava de novo pra sempre, e o servidor em UTC virava o mês às 21h de Brasília.

**Reembolsos:** solicitado congela o saldo e suspende a assinatura; cancelado devolve; aceito da entrada tira brinde + assinatura e sai da allowlist (créditos comprados ficam); aceito de pacote tira só aquele pacote; chargeback faz tudo e bloqueia o login. Como a Cakto não avisa "reembolso solicitado" por webhook, `src/instrumentation.ts` roda uma varredura a cada 10 min.

**Geração de vídeo:** ver a seção "OS DOIS MOTORES" acima. No pipeline antigo o débito é pelo consumo real (`fabrica.py` grava `consumo.json`, `concluir` aplica `custoCreditos` +20%, idempotente por `jobJaDebitado`); no motor de IA é preço fixo por duração.

**MONTAGEM DO EDITOR (05/08/2026, leia antes de mexer no `/painel/novo`):** o que a pessoa monta na tela agora CHEGA no render. A tela manda `roteiro` (ordem, cortes, `papel` principal/apoio, `entra`, `descricao` da cena), `textos` e `volumes`; `api/jobs` valida com `lib/montagem.ts` (usando o MESMO `nomeSeguro` dos arquivos salvos, senão o roteiro aponta pra um nome que não existe) e guarda em `Job.opcoes`. O worker grava `roteiro.json` na pasta do job e a fábrica desvia pra `build_montagem`. **Sem `roteiro.json` nada muda:** fábrica avulsa, jobs antigos, cortes e lote seguem o caminho de sempre.
- **Clipes principais (B-roll):** podem ser VÁRIOS. Eles tocam em sequência, na ordem da lista, e formam a BASE do vídeo; o som deles nunca para. Os apoios entram MUDOS em tela cheia e a tela volta pra base. A duração do vídeo é a SOMA dos principais (os apoios substituem trechos, não somam) e o teto de 30s (`ALVO_MAX`) não vale nesse caminho, só `MAX_MONTAGEM`. `_linha_da_base` monta a régua (cada principal com seu `t0`), `_fatias_da_base` corta um trecho que pode atravessar dois arquivos, e `_fala_da_base` transcreve cada um trazendo os tempos pra linha do vídeo (sem isso a legenda do 2º principal apareceria com o tempo contado do começo do arquivo dele). Os momentos dos apoios saem da IA (`transcrever_fala` + `gemini_copy.plano_broll`) ou do que a pessoa arrastou (`entra` preenchido). Combina com "Transcrever fala"/"Nenhum"; "Voz narrada" é bloqueada na tela E na API (duas vozes brigando).
- **Descrever a cena (`descricao` por clipe):** alimenta DUAS coisas: o encaixe do B-roll (`plano_broll` casa a descrição com o trecho da fala) e a copy (`contexto_cenas` vira o `contexto_visual` do `gerar_copy`). Isso substitui o `plano_edicao`, que NÃO roda na montagem do editor.
- **Cena SEM descrição: a IA OLHA o clipe (05/08/2026).** `completar_descricoes` (`fabrica.py`) roda no `processar`, UMA vez por job (antes das variantes e antes do `contexto_cenas`), tira 3 quadros do trecho cortado de cada apoio em branco (`_quadros_da_cena`: 15%, 50% e 85%, 512px; foto vira 1 quadro) e manda pro `gemini_copy.descrever_cenas` (visão, lotes de 6 cenas, ~1,2k tokens Flash por cena). A frase entra no PRÓPRIO roteiro, então vale pro `plano_broll` e pra copy. **A descrição escrita à mão sempre manda**, só o campo em branco é preenchido. Sem copy no job, apoio que já tem `entra` nem é olhado (ninguém usaria a frase). Falha da IA devolve 0 e o render segue como antes (apoios espalhados por ritmo).
- **Regras de tamanho (definidas pelo dono em 05/08/2026), em `lib/montagem.ts` e espelhadas no `fabrica.py`:** vídeo final e clipe principal no máximo **2 min** (`MAX_VIDEO_SEG`/`MAX_MONTAGEM`); cena de apoio no máximo **1 min** de arquivo (`MAX_APOIO_SEG`); **1 apoio a cada 10s** da base (`SEG_POR_APOIO`, `maxApoios()`); apoio fica na tela entre 0,8 e 6s (`APOIO_MIN/MAX`), pelo corte que a pessoa fez. A tela recusa arquivo com mais de 2 min no `addFiles` e trava o botão Gerar; `normalizarRoteiro` -> `aplicarLimites` refaz a conta no servidor e `planejar_apoios` corta o excedente no render. Mudou um número, mude nos dois lados.
- **Velocidade da música (0,25x a 2x):** `VELOCIDADES_MUSICA` em `lib/montagem.ts`, aplicada em `_stem_musica`. É TIME-STRETCH (muda andamento, mantém o tom): tenta `rubberband=tempo=X` e cai pro `atempo` se o ffmpeg da máquina não tiver a biblioteca. `atempo` só aceita 0.5-2.0 por instância, então 0,25x vira duas passadas (`_cadeia_tempo`). Como o esticão muda a duração, o `atrim` pega `total * velocidade` de música pra sobrar `total` no fim. Na prévia da tela quem faz isso é o `preservesPitch` do navegador; abaixo de 0,5x alguns navegadores mudam a faixa, e a tela avisa.
- **Música pode ser um vídeo:** o seletor aceita `audio/*,video/*` e a plataforma usa só o SOM do arquivo (`-vn` no `_stem_musica`). O que destrava isso no render é o `achar_musica`, que passou a aceitar contêiner de vídeo QUANDO há `match` (a faixa que a pessoa subiu, salva como `job_<id>.<ext>`). Sem faixa de áudio no arquivo, o vídeo sai sem música em vez de quebrar.
- **Sorteio da trilha automática ignora `job_*`:** aqueles arquivos são upload de usuário e ficam na MESMA pasta da biblioteca (`entrada/musicas/`), que o worker do serverrk não limpa. Antes o sorteio podia entregar a música de um cliente como trilha do vídeo de outro.
- **Cortar partes sem fala:** opção da tela (`SILENCIOS`, 0 a 2s) que vale SÓ na base (com principais). `detectar_silencios` roda `silencedetect` do ffmpeg (local, sem custo de API) e `_trechos_com_fala` devolve o que FICA, com folga de 0,15s nas pontas. Duas armadilhas resolvidas: silêncios quase colados são juntados (`JUNTA_SILENCIO`) e pedaço menor que `MIN_PEDACO` sai fora, senão o vídeo ganha piscadas de 2 quadros; e se sobrar menos de 1s o corte é abortado e vale o vídeo inteiro. O corte encurta o vídeo, então cabem MENOS apoios (a conta é feita depois, na duração já cortada) - a tela avisa. A prévia do editor NÃO corta: é decidido no render.
- **Armadilha do ffmpeg:** cada pedaço do principal é uma ENTRADA nova (`-ss`/`-t` no mesmo arquivo), não `split`+`trim` de um decode só. Com split o ffmpeg segura o vídeo inteiro em RAM enquanto o concat ainda está no 1º pedaço.
- **Faixas separadas (stems):** o render grava som do vídeo, música e narração em arquivos separados (`stems.json` -> worker sobe pra `/audios/` -> `Job.opcoes.stems`). É o que faz o botão **Reajustar áudio** (`api/jobs/[id]/remix` -> `fabrica.py --remix`) refazer só a mistura com `-c:v copy`: segundos, sem re-render e sem cobrar de novo (`jobJaDebitado` já barra). O job volta pra `na_fila` com `opcoes.remix` e o worker desvia por isso; `api/worker/proximo` tem exceção pra ele (a mídia de entrada já foi apagada).

**Gasto com APIs (contabilidade do dono):** todo consumo de API paga vira linha na `GastoApi` via `lib/gastos-api.ts`, INDEPENDENTE do débito de créditos (admin/demo não pagam crédito mas a API cobrou). Worker: `uso.py` acumula (tokens Gemini, chars Eleven, segundos Veo), `fabrica.py`/`cortar_youtube.py` gravam `consumo.json`, o `concluir` registra. Web: rotas OpenAI registram `usage.total_tokens`; vídeos/imagens do Grok registram média fixa (R$0,61/10s, env). A aba Finanças soma por API (OpenAI usa a fatura oficial quando `OPENAI_ADMIN_KEY` existe) e por usuário (margem = créditos gastos menos custo real). Chars da chave BYO do usuário não contam como gasto nosso.

**Etapas do render:** `POST /api/worker/progresso/[id]` grava `Job.etapa` (o motor de IA grava direto). O painel trata `na_fila`/`renderizando`/`processando` como "em produção" e faz auto-refresh. **Cuidado:** a página de detalhe dos cortes e o contador do admin ainda não incluem `processando` (`auditoria.md` #1 e #2).

**Chat interno:** só o **admin** abre conversa (o POST do usuário devolve 403 enquanto não existe thread). Áudio gravado sobe pro serverrk. Ao admin enviar, cai notificação no sininho.

**Ingestão de virais (bot Telegram, PC do dono):** `bot telegram/baixar_virais.py` (Telethon) lê canais onde o dono é membro, baixa vídeos e imagens, e sobe por `POST /api/worker/viral` e `/api/worker/produto` (auth `x-worker-token`), gravando em **`data/virais.json`** / **`data/produtos.json`**.

> **Atenção:** as galerias Virais e Produtos leem desses arquivos JSON, **não** das tabelas `VideoShopee`/`ProdutoShopee`. O **minerador**, ao contrário, consulta `VideoShopee` no banco.

---

## Padrões de código

- App Router: pages = Server Components; mutações via Server Actions ou `/api`.
- Domínio em **PT-BR** (nomes de campos/funções).
- `import "server-only"` nas libs sensíveis; rota de worker sempre com `workerAutorizado`; libs client-safe (preços, promos, opções de quiz) ficam sem `server-only` de propósito.
- **PROIBIDO travessão em dash** em qualquer texto ou comentário (`temporary_rules.md`) - usar hífen.
- Datas em client component: fixar `timeZone: "America/Sao_Paulo"` no `Intl.DateTimeFormat` (senão hydration mismatch).
- Geração longa: `after()` do Next + polling, nunca segurar a request.

---

## Armadilhas conhecidas

- **Não confunda os dois motores.** Job de IA nasce `renderizando` e nunca passa pelo worker Python; job do editor nasce `recebendo`.
- `PLANO-APP.md` (Auth.js+Postgres) e `DEPLOY.md` (SQLite) estão **desatualizados** - real é JWT caseiro + MySQL.
- Comentários de `avatares.ts` e `avatar-foto.ts` citam **gpt-image-1**, mas o motor virou o robô do Grok. `openai-image.ts` está órfão.
- **Next 16**: `cookies()`/`searchParams`/`params` são **async**. Guias em `node_modules/next/dist/docs/` (ver AGENTS.md).
- `redirect()` de page/layout aninhado vira soft redirect (200 + RSC), então no curl não aparece 307.
- Cloudflare corta request em ~100s: qualquer coisa longa precisa virar polling.
- O serverrk processa **um vídeo por vez**; imagem usa conta separada do Grok (`GROK_CONTA_IMAGEM`) pra não travar a fila de vídeo.
- Worker Python precisa rodar em **UTF-8** (já forçado) senão estoura no Windows (cp1252).
- **base-ui `DropdownMenuLabel`** precisa estar dentro de `<DropdownMenuGroup>`.
- Extensões do navegador injetam atributos no `<html>`: `suppressHydrationWarning` no `layout.tsx`.
- Chaves de API nunca no navegador. As do pipeline antigo ficam só no PC (`bot shopee/.env`).
- `precos.ts` (estimativa por segundo do editor) segue **PROVISÓRIO**; os preços de IA em `lab-*.ts`/`avatar-modelo.ts` são os que valem hoje.
- Ranking de afiliados casa pelo **mesmo e-mail** da conta: quem se afiliar com outro e-mail não aparece.

---

## Segurança / CI/CD (resumo)

- Sessão JWT HS256 (`SESSION_SECRET`), cookie httpOnly+secure 7d. Senha bcrypt 12. Rate limit em banco no login/cadastro/reset. Segredos do usuário em AES-256-GCM (`cripto.ts`). Worker por `x-worker-token`. Isolamento por `userId`.
- Anti-SSRF no lote: a fonte do vídeo precisa bater exatamente com a origem de `MEDIA_BASE` e caminho `/virais/` ou `/gerados/`.
- Deploy: Dockerfile -> EasyPanel (porta 3000). Vars principais: `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `WORKER_TOKEN`, `CAKTO_CLIENT_ID/SECRET`, `CAKTO_WEBHOOK_SECRET`, `CAKTO_CHECKOUT_10/20/50/100`, `CAKTO_CHECKOUT_ASSINATURA` (link da entrada/assinatura, usado pelo botão Renovar em `/painel/assinatura`; sem ele o botão cai pra `/painel/creditos`), `KIWIFY_*` (legado), `INFINITEPAY_HANDLE`, `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_ADS_ACCOUNT_ID`, `META_ADS_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID/SECRET`, `GROK_INGEST_URL`, `GROK_INGEST_TOKEN`, `GROK_CONTA_IMAGEM`, `AVATAR_INGEST_TOKEN`, `NEXT_PUBLIC_MEDIA_BASE`, `OPENAI_API_KEY`, `GEMINI_API_KEY_1..20`. Volumes: `/app/data`, `/app/public/{videos,virais,downloads}`.
- `git commit`/`push`/deploy **só com permissão explícita** (`RULES.md`).

---

## Pendências grandes (ver reminder.md)

- **Migração de gateway concluída** (Cakto ativo). Kiwify segue no código só como histórico de Finanças e reembolsos antigos.
- **Atribuição Fase 2:** capturar `ctwa_clid` do Click-to-WhatsApp pra atribuição 100% precisa; etiqueta "COMPROU" no Chatwoot.
- **Girar chaves** que passaram por chats (EasyPanel, n8n, token CAPI).
- **Instrumentar `cortar_youtube.py`** (custo real dos Cortes; hoje cai no preço fixo "Edição").
- **BYO key (ElevenLabs): pronto mas GATED** (`BYO_LIBERADO = false` em `painel/conta/page.tsx`). Falta Gemini; Minimax adiado.
- **Prévias de voz em produção:** rodar `gerar_previews_voz.py` após deploy e pôr `public/voice-previews` nos volumes do EasyPanel.
- **Calibrar `precos.ts`** do pipeline antigo (os preços de IA já estão calibrados).
- **`academy`** e **`blog`** são placeholders ("em breve", componente `em-breve.tsx`).
- **Bugs catalogados** em `auditoria.md`.

*Última atualização: 2026-08-05*
