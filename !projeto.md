# Mapa do Projeto (para IAs)

> **Propósito:** índice rápido para localizar código sem precisar varrer o repo.
> **Manutenção:** atualize quando mudar estrutura, fluxo crítico ou convenção. Não documente todas as features, só o que ajuda a IA a navegar.

---

## O que é

**Viraliza** — plataforma web multi-usuário (SaaS, cadastro aberto) que reúne ferramentas de marketing/conteúdo viral. Carro-chefe: **gerar vídeos de produto 9:16** (Shopee/TikTok) com IA. Também: acervo de cortes, cortes de YouTube, leads do Google Maps, produtos/vídeos virais Shopee, área de membros. O render pesado roda **no PC do dono** (worker Python), não no servidor. Papéis: **admin** (dono), **user**, **demo**.

**Monetização "2 em 1"** (ver memória `modelo-monetizacao`): **entrada R$19,90** (produto Kiwify) libera o cadastro e a **biblioteca** (Acervo, Virais, Shopee, Produtos, Membro) + **crédito mensal de brinde** (hoje `CREDITO_MENSAL_CENTAVOS = 2000` = R$20, oferta de lançamento); **crédito** (saldo em centavos = nº de créditos, 1 crédito = R$0,01) paga a **produção** (Editor, Lote, Cortes, MapsLeads). Débito é **pós-pago pelo custo real** das APIs (Gemini/ElevenLabs) +20%; ferramentas sem API têm preço fixo. Custo real observado: ~R$1-1,30 por vídeo de voz de ~30s.

**Pagamento via Kiwify (INTEGRADO):** botão Comprar abre o checkout (`KIWIFY_CHECKOUT_10/20/50/100`); o webhook `/api/kiwify/webhook` recebe o aviso, **confirma o pedido na API da Kiwify** (à prova de forja) e: (a) compra aprovada entra na allowlist `AcessoPago` (gate do cadastro); (b) pacotes "Editor automatico N" creditam N créditos (compra antes do cadastro vira `CreditoPendente`); (c) dispara **Purchase** pro pixel da Meta (atribuição, ver abaixo); (d) estorno aplica as **regras de reembolso**. Rede de segurança do cadastro: `emailComprou()` consulta a Kiwify ao vivo se o webhook atrasar.

**Atribuição Meta Ads (CAPI):** toda venda aprovada vira evento **Purchase** (e estorno vira **Refund**) no pixel "Viraliza - Vendas" via `src/lib/meta-capi.ts` (dados hasheados SHA-256; `event_id` = orderId, idempotente). Assim o Gerenciador de Anúncios mostra compras/custo por campanha. Env: `META_PIXEL_ID` + `META_CAPI_TOKEN` (+ `META_CAPI_TEST_CODE` opcional pra testar). Fase 2 planejada: capturar `ctwa_clid` do Click-to-WhatsApp pra precisão total.

**Regras de reembolso** (`src/lib/reembolsos.ts`): reembolso **SOLICITADO** (detectado por varredura na Kiwify a cada 10 min, agendada em `src/instrumentation.ts`) congela o saldo (zera) e suspende a assinatura; **cancelado** devolve tudo; **aceito da entrada** remove em definitivo os créditos de BRINDE + assinatura (créditos comprados ficam) e tira o e-mail da allowlist; **aceito de pacote** remove só os créditos daquele pacote; **chargeback** = tudo isso + `bloqueado = true` (derruba login).

---

## Stack principal

- **Front/Back:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **UI:** Tailwind v4 + shadcn/ui sobre **@base-ui/react** + lucide-react + sonner
- **Banco:** **MySQL** via Prisma (local: XAMPP na 3306, banco `viraliza`; prod: EasyPanel)
- **Auth:** **caseiro** — JWT (`jose`) em cookie httpOnly + senha `bcryptjs`. NÃO usa Auth.js.
- **Validação:** Zod
- **Storage vídeo pronto:** Google Drive (rclone) com fallback `public/videos/<id>` servido por `/api/midia`
- **Worker (PC do dono):** Python em `bot shopee/` — `worker.py` + `fabrica.py` + FFmpeg + APIs IA
- **Deploy:** Docker → EasyPanel (`DEPLOY.md`)

### Rodar local (resumo)
1. MySQL (XAMPP) ligado na 3306. 2. `.env` raiz: `DATABASE_URL`, `SESSION_SECRET`, `WORKER_TOKEN`. 3. `npm run dev` (porta 3000). 4. Worker: `bot shopee/.env` com `WEB_URL=http://localhost:3000` + mesmo `WORKER_TOKEN` + `GEMINI_API_KEY` + `ELEVENLABS_API_KEYS`, depois `python worker.py`. Admin de teste: 1º cadastro vira admin (ou `adm@adm.com`/`adm`).

---

## Onde está cada coisa

| Arquivo / Pasta | Quando ler |
|---|---|
| `src/app/page.tsx`, `login/`, `cadastro/` | landing + auth pública |
| `src/app/(app)/layout.tsx` | shell logado; busca carteira/assinatura e passa pro `AppFrame` (saldo + barra %) |
| `src/app/(app)/painel/**` | telas do usuário (ver rotas abaixo) |
| `src/app/(app)/admin/**` | painel do dono (usuários, diagnóstico) — exige admin |
| `src/app/actions/*.ts` | Server Actions: `auth`, `usuarios`, `produtos`, `materiais`, `virais`, **`conta`** (trocar senha + **chave ElevenLabs BYO**), **`creditos`** (teste admin: creditar/assinar) |
| `src/app/api/jobs/**` | cria job de vídeo; **trava: crédito + limite de 3 simultâneos** |
| `src/app/api/cortes/route.ts` | cria job de cortes (mesma trava de crédito/limite) |
| `src/app/api/leads/buscar/route.ts` | roda scraper de leads; **trava de crédito** + débito fixo |
| `src/app/api/worker/**` | endpoints do worker render (`proximo`, `concluir/[id]`, `erro`, `entrada`, **`progresso/[id]`** = fase do render, **`voz-preview`** = prévia de voz) + **ingestão do bot Telegram** (`viral`, `produto`); `concluir` **debita o crédito** pelo `consumo` |
| `src/app/api/voices/route.ts` | lista de vozes do seletor do Estúdio: ao vivo da conta do usuário (BYO) ou a lista curada |
| `src/app/api/notificacoes/**` | sininho: lista/marca lidas (feature de notificações) |
| `src/app/api/midia/[...slug]/route.ts` | serve mídia gravada em runtime (vídeos/imagens) com Range |
| **`src/app/api/kiwify/webhook/route.ts`** | webhook da Kiwify: allowlist, créditos, CAPI, reembolsos |
| **`src/lib/kiwify.ts`** | API da Kiwify (OAuth, `buscarVenda`, `listarVendas`, helpers de status) |
| **`src/lib/meta-capi.ts`** | eventos Purchase/Refund pro pixel da Meta (atribuição de vendas) |
| **`src/lib/reembolsos.ts`** | regras de reembolso (suspensão/estorno/chargeback) + varredura periódica |
| **`src/lib/financas.ts`** + `admin/financas/` | painel Finanças do admin (vendas × reembolsos por dia, filtros) |
| **`src/instrumentation.ts`** | boot do servidor: agenda a varredura de reembolsos (10 em 10 min) |
| `src/lib/session.ts` | sessão JWT (cookie `sessao`) |
| `src/lib/dal.ts` | guardas: `getCurrentUser`, `requireUser`, `requireAdmin`, **`requireAssinatura`** (biblioteca) |
| **`src/lib/creditos.ts`** | carteira: `getCarteira`, `temSaldo`, `totalEntradas`, `debitarClamp`, `creditar`, `garantirCreditoMensal`, `listarExtrato`, `fmtCreditos`, `jobJaDebitado` |
| **`src/lib/precos.ts`** | tabela de preços (PROVISÓRIA): `estimarCreditos` (estimativa por tempo), `custoCreditos` (consumo→créditos), `CREDITOS_FIXO` |
| `src/lib/jobs.ts` | jobs do usuário + `getConfigReuso` (Reutilizar) + créditos gastos por job |
| `src/lib/worker-auth.ts`, `prisma.ts`, `drive.ts`, `diagnostico.ts` | infra |
| **`src/lib/cripto.ts`** | cifra segredos do usuário (AES-256-GCM, chave derivada do `SESSION_SECRET`) — usado no BYO key |
| **`src/lib/eleven.ts`** | busca as vozes de uma conta ElevenLabs (`/v1/voices`) |
| **`src/lib/vozes.ts`** | lista curada de vozes da plataforma + `VOZ_PADRAO` + `vozValida` (+ flag `principal`) |
| `src/lib/notificacoes.ts` | notificações do sininho + avisos (barra topo): `notificarJobPronto/Erro`, DTOs |
| `src/components/app/**` | componentes logados (ver "novos" abaixo) |
| `prisma/schema.prisma` | modelo de dados (fonte da verdade) |
| `bot shopee/` | **worker de render** (Python, PC do dono — ver memória `worker-python`) |
| `bot telegram/` | **bot Telegram** (Python/Telethon, PC do dono): ingere virais + produtos do Telegram pras galerias da web |

**Rotas do painel:** `inicio` (hub), `/painel` (**Meus vídeos**), `novo` (Editor/Estúdio — aceita `?video=` editar e `?reutilizar=`), `videos/[id]` (cortes), `acervo`(+`[slug]`), `cortes`, `lote`, `leads`, `shopee`, `virais`, `produtos`, `membro`(+`[slug]`), `ferramentas` (grade), **`creditos`**, **`conta`**, **`extrato`**.

**Componentes novos (créditos/menu):** `planos-creditos`, `admin-creditos-teste`, `extrato-detalhado`, `trocar-senha-form` (com confirmar senha), `editor-estudio` (estúdio — único form ativo; o `novo-video-form` foi removido), **`seletor-voz`** (dropdown de voz com play da prévia), **`chave-eleven-form`** (BYO, hoje gated), **`notificacoes-sino`** + **`aviso-barra`** + **`notificacoes-admin`** (feature de notificações). Nav (`nav-links`): grupo "Ferramentas" **retrátil** (estado no localStorage); "Meus vídeos" saiu da grade de `/painel/ferramentas`.

---

## Banco de Dados — Tabelas-chave

| Tabela | Propósito |
|---|---|
| `User` | conta + auth + **carteira**: `saldoCentavos`, `assinante`, `assinaturaAte`, `creditoMensalEm` + **`elevenKey`** (chave ElevenLabs BYO, cifrada) |
| **`CreditoTransacao`** | extrato: `tipo` (compra/debito_geracao/debito_processamento/bonus_assinatura/ajuste_admin/estorno/**suspensao_reembolso**/**reversao_suspensao**), `valor` (centavos, +entrada/−saída), `saldoApos`, `jobId`, `kiwifyOrderId` (idempotência dos eventos Kiwify) |
| **`AcessoPago`** / **`CreditoPendente`** | allowlist de cadastro (e-mail que comprou) / crédito comprado antes de ter conta (aplica no cadastro) |
| `Job` | pedido de vídeo (produto/marca/cortes) + status (`na_fila`→`renderizando`/`processando`→`pronto`/`erro`; `recebendo`=rascunho) + **`vozId`** (voz escolhida) + **`etapa`** (fase atual do render) |
| **`Notificacao`** / **`Aviso`** | sininho (1 linha por usuário; `video_pronto/erro/admin`) + barra de aviso no topo (feature de notificações) |
| `Lead`, `AcervoCategoria`/`AcervoVideo`, `ProdutoShopee`/`VideoShopee` | leads + biblioteca (mídia no Drive) |

> Regra de ouro: **nenhuma IA altera o banco sem permissão explícita** (`RULES.md`).

---

## Fluxos críticos

**Auth:** `actions/auth.ts` (Zod + bcrypt) → `createSession()` JWT cookie 7d. Páginas logadas: `requireUser`/`requireAdmin`. `User.bloqueado` derruba a sessão.

**Travas do modelo 2 em 1:**
- **Biblioteca** (acervo/virais/shopee/produtos/membro): cada page chama `requireAssinatura()` → sem assinatura, redireciona pra `/painel/creditos?bloqueio=biblioteca` (admin/demo passam).
- **Produção** (`/api/jobs`, `/api/cortes`, `/api/leads/buscar`): exige `temSaldo()` (402 se 0) + **limite de 3 jobs em produção** (429). Admin passa; demo tem regra própria.

**Geração + débito real:**
1. Editor (`/painel/novo`) POST `/api/jobs` (direto, com `roteiro`) → cria `Job` na fila. Mostra "Usará no máximo X créditos" (`estimarCreditos`).
2. Worker (`bot shopee/worker.py`) faz polling em `/api/worker/proximo`, baixa assets, roda `fabrica.py`.
3. `fabrica.py` mede consumo (`uso.py`: tokens Gemini via `gemini_copy._call`, caracteres ElevenLabs) e grava `produtos/<job>/consumo.json`.
4. Worker sobe o vídeo (Drive ou local) e manda `consumo` em `/api/worker/concluir/[id]`.
5. `concluir` debita o **custo real** (`custoCreditos` × consumo, +20%) via `debitarClamp` (clampa em 0; idempotente por `jobJaDebitado`); sem API → preço fixo. Job que **falha NÃO debita**. O débito é gravado **antes** de marcar `pronto` (crédito aparece no mesmo refresh, sem F5).

**Etapas do render (barra "Renderizando"):** o worker/fábrica reportam a fase em `POST /api/worker/progresso/[id]` (grava `Job.etapa`; ex.: "Preparando", "Analisando", "Renderizando 1/2", "Subindo"). O card mostra `etapa`; o painel considera `na_fila`/`renderizando`/`processando` como "em produção" (auto-refresh). **Cuidado:** a página de detalhe dos cortes (`videos/[id]`) e o contador do admin ainda NÃO incluem `processando` (ver `auditoria.md`).

**Voz narrada (Estúdio):** o seletor (`seletor-voz`) busca `/api/voices`. Sem chave própria → lista curada (`lib/vozes.ts`, com voz "Principal"); com chave BYO → vozes da conta do usuário ao vivo. O `vozId` desce até `narrar_video.py`. **Prévia (play):** mp3 por voz gerado **uma vez** pelo `bot shopee/gerar_previews_voz.py` (roda no PC, sobe em `POST /api/worker/voz-preview` → `public/voice-previews/<id>.mp3`, servido por `/api/midia`).

**BYO key (ElevenLabs) — PRONTO mas GATED:** a seção em `/painel/conta` está travada por `const BYO_LIBERADO = false` (mostra "Em breve"). Como o formulário é a única porta de entrada, o BYO fica desligado (ninguém cadastra chave). Virar pra `true` religa tudo (back-end já lida com "sem chave"). Cifra em `lib/cripto.ts`; worker recebe a chave via env `ELEVEN_USER_KEY` (sem gravar em disco) e não debita crédito da voz.

**Ingestão de virais (bot Telegram, PC do dono):** `bot telegram/baixar_virais.py` (Telethon) lê canais/grupos onde o dono é **membro** e baixa **vídeos** (virais) + **imagens** (produtos Shopee), sem perder qualidade. Dedup por `baixados.json`/`baixados_produtos.json`; extrai **link do produto + título** da legenda; gera thumb (FFmpeg); trata **FloodWait**. Sobe pra web via HTTP (auth `x-worker-token`):
- POST `/api/worker/viral` → grava `public/virais/<id>.mp4` + thumb e registra em **`data/virais.json`** (dedup por id).
- POST `/api/worker/produto` → grava `public/produtos/<id>.jpg` e registra em **`data/produtos.json`**.
Modos: `--historico N`, ao vivo (listener), `--listar`, `--subir-tudo`, `--so-videos`/`--so-imagens`, `--sessao <apelido>`, `--so-link-shopee`. Env raiz: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_CANAIS`, `TELEGRAM_CANAIS_IMAGENS` (+ `WEB_URL`/`WORKER_TOKEN` pra subir). Sessões Telethon (`sessao_*.session`): login uma vez (telefone+código), copiado pra sessões paralelas. Auxiliares: `baixar_satisfatorios.py` (uso pessoal do dono, baixa tudo de canais "satisf" pra `../satisfatorios/`, **NÃO** sobe pra web) e `baixar_um.py` (baixa 1 mensagem por link `t.me/canal/ID`).

> **Atenção:** as galerias **Virais** e **Produtos** leem dos arquivos `data/virais.json` / `data/produtos.json` (volume de dados), **não** das tabelas Prisma `VideoShopee`/`ProdutoShopee` — essas estão no schema mas o código da V2 não as usa.

---

## Padrões de código

- App Router: pages = Server Components; mutações via Server Actions ou `/api`.
- Domínio em **PT-BR** (nomes de campos/funções).
- `import "server-only"` nas libs sensíveis; rota de worker sempre com `workerAutorizado`.
- **PROIBIDO travessão "—"** em qualquer texto/comentário (regra em `temporary_rules.md`) — usar "-".
- Datas em **client component**: fixar `timeZone: "America/Sao_Paulo"` no `Intl.DateTimeFormat` (senão hydration mismatch servidor×cliente).

---

## Armadilhas conhecidas

- `PLANO-APP.md` (Auth.js+Postgres) e `DEPLOY.md` (SQLite) estão **desatualizados** — real é **JWT caseiro + MySQL**.
- **Next 16**: `cookies()`/`searchParams`/`params` são **async** (await). Antes de codar, ler guias em `node_modules/next/dist/docs/` (AGENTS.md).
- **`redirect()` de page/layout aninhado** vira "soft redirect" (status 200 + RSC) — funciona no browser, mas no curl aparece 200 (não 307).
- **Worker Python**: precisa rodar com **UTF-8** (já forçado no `worker.py`) senão estoura no Windows (cp1252) ao imprimir ✓/✗.
- **base-ui `DropdownMenuLabel`** (GroupLabel) precisa estar dentro de `<DropdownMenuGroup>`.
- **Extensões do navegador** injetam atributos no `<html>` → `suppressHydrationWarning` no `layout.tsx` silencia.
- Chaves de API (Gemini/ElevenLabs/Telegram) **nunca** no servidor/navegador — só no PC/worker (`bot shopee/.env`).
- `estimarCreditos`/`custoCreditos`/`CREDITOS_FIXO` em `precos.ts` são **PROVISÓRIOS** (calibrar — ver `reminder.md`).

---

## Segurança / CI/CD (resumo)

- Sessão JWT HS256 (`SESSION_SECRET`), cookie httpOnly+secure 7d. Senha bcrypt. Worker por `x-worker-token`. Isolamento por `userId`.
- Deploy: Dockerfile → EasyPanel (porta 3000). Vars: `DATABASE_URL`, `SESSION_SECRET`, `WORKER_TOKEN`, `KIWIFY_CLIENT_ID/SECRET/ACCOUNT_ID`, `KIWIFY_CHECKOUT_10/20/50/100`, `META_PIXEL_ID`, `META_CAPI_TOKEN`. Volumes: `/app/data`, `/app/public/{videos,virais,downloads}`.
- `git commit`/`push`/deploy **só com permissão explícita** (`RULES.md`).

---

## Pendências grandes (ver reminder.md)

- ~~Kiwify (pagamento real)~~ **FEITO** (03/07): checkout + webhook + allowlist + reembolsos + atribuição Meta.
- **Atribuição Fase 2:** capturar `ctwa_clid` do Click-to-WhatsApp (proxy Meta→n8n→Chatwoot) pra atribuição 100% precisa + otimizar campanha por compra; etiqueta "COMPROU" no Chatwoot.
- **Girar chaves** que passaram por chats (EasyPanel, n8n, token CAPI, message.txt).
- **Verificar em produção** se a Kiwify expõe status de "reembolso solicitado" (a varredura loga status desconhecidos com `[reembolsos]`); se não expuser, a suspensão só acontece no estorno efetivado.
- **Calibrar preços** (`precos.ts`): estimativa recalibrada com 1 dado real (voz 8→4, legenda 3→2 créditos/seg); custo real ainda PROVISÓRIO. Confirmar tabela atual Gemini/ElevenLabs.
- **Instrumentar `cortar_youtube.py`** (custo real dos Cortes; hoje cai no preço fixo "Edição").
- **BYO key (ElevenLabs): PRONTO mas GATED** (`BYO_LIBERADO = false` em `conta/page.tsx` → "Em breve"). Liberar quando quiser; falta **Gemini** (mesma estrutura). **Minimax** adiado.
- **Prévias de voz em produção:** rodar `gerar_previews_voz.py` após deploy e adicionar `public/voice-previews` aos volumes do EasyPanel (senão redeploy apaga).
- **Bugs catalogados** em `auditoria.md` (ex.: cortes `videos/[id]` não auto-atualiza no `processando`).

*Última atualização: 2026-07-03*
