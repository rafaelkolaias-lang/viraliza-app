# 📋 PLANO-APP — Plataforma Web da Fábrica de Vídeos IA

> Documento mestre do app (exigido pela dev-skills antes de codar).
> Agentes: `@orchestrator` + `@frontend-specialist` + `@backend-specialist`.
> Idioma: PT-BR · Fuso: America/Sao_Paulo.

---

## 1. Visão

Plataforma web (multi-usuário) onde qualquer pessoa se cadastra, faz login e **gera os
próprios vídeos de produto** (9:16, Shopee/TikTok) automaticamente — uma versão web da GUI
atual. **Sem pagamento** na plataforma. Dois papéis: **admin** (dono) e **usuário**.
Mobile-first, simples, elegante. O render acontece no PC do dono (worker + fila).

## 2. Decisões já fechadas (Portão Socrático)

| Tema | Decisão |
|---|---|
| Público | SaaS de cadastro aberto, **sem cobrança** |
| O que o usuário faz | Gera os próprios vídeos pela web (espelha a GUI) |
| Escopo v1 | Completo, mas construído em fases que já funcionam |
| Render | No PC do dono (fila processa quando o PC está ligado) |
| Stack | Padrão 2026 da dev-skills (Next.js 16 + TS + Tailwind v4) |
| Design | Mobile-first, elegante, **sem roxo** (Purple Ban), segue a GUI |

## 3. Arquitetura

```
NAVEGADOR (cliente)
   │ login · preenche produto · sobe imagens · "gerar"
   ▼
APP WEB  (EasyPanel / servidor)  ── Next.js 16 + Auth.js + Postgres
   │ cria Job (status: na_fila) + guarda os arquivos
   ▼
FILA (tabela de jobs no Postgres)
   ▲ polling autenticado (token de worker)
   │
WORKER (PC do dono)  ── Python, reusa a fabrica.py + FFmpeg
   pega job → baixa assets → renderiza → sobe o mp4 → marca "pronto"
```

**Por que fila no Postgres (e não Redis exposto):** o worker roda no PC e fala com o
servidor por uma **API REST autenticada** (mais simples e seguro que expor o Redis na
internet). O worker faz polling: "tem job? me dá os arquivos" → renderiza → devolve.

## 4. Stack

```yaml
Front/Back:  Next.js 16 (App Router) + TypeScript 5.7 + Tailwind v4 + shadcn/ui
Auth:        Auth.js v5 (e-mail+senha, sessão segura)
Dados:       PostgreSQL + Prisma ORM
Validação:   Zod
Storage:     disco do servidor (volume EasyPanel) p/ assets e vídeos
Worker (PC): Python (reusa bot shopee/fabrica.py) + cliente HTTP de fila
Deploy:      container no EasyPanel (Traefik já cuida de domínio + HTTPS)
```

> 🔐 As chaves de API (Gemini/ElevenLabs) ficam SÓ no PC/worker e no servidor (.env),
> NUNCA no navegador. O front nunca toca nas chaves.

## 5. Modelo de dados (Prisma)

- **User**: id, nome, email (único), senhaHash, role (admin|user), criadoEm
- **Job** (pedido de vídeo): id, userId, nomeProduto, descricao, formato (legenda|voz),
  tom, variantes, preco, musica, status (na_fila|renderizando|pronto|erro), erroMsg,
  criadoEm, atualizadoEm
- **Asset**: id, jobId, tipo (imagem|video|musica), caminho, nomeOriginal
- **Resultado**: id, jobId, caminhoVideo, caminhoCopyTxt, variante
- **(Auth.js)**: Session, Account conforme adapter Prisma

## 6. Telas

### Usuário
1. **Cadastro / Login** (mobile-first)
2. **Meus vídeos** (dashboard): lista dos jobs com status (na fila / renderizando /
   pronto) + atalho "novo vídeo"
3. **Novo vídeo** (o coração — espelha a GUI): nome do produto, descrição, upload de
   imagens/vídeos, formato (Legenda/Voz), tom (Agressivo/Equilibrado/Tranquilo),
   variantes (1/2/3), preço, música → manda pra fila
4. **Detalhe do vídeo**: status em tempo real, player, **download em qualidade total** +
   descrição/hashtags pra copiar

### Admin (dono)
- Tudo do usuário +
- **Painel admin**: lista todos os usuários, todos os jobs, status da fila/worker,
  ações (ver, remover, reprocessar)

## 7. Segurança (backend-specialist + security-auditor)

- Senha com hash forte (argon2/bcrypt); sessões Auth.js
- Validação Zod em toda entrada; upload validado (tipo e tamanho)
- **Isolamento por usuário**: cada um só vê os próprios vídeos
- Token secreto do worker pra puxar/devolver jobs
- Rate limit / cota por usuário (protege o PC de abuso, já que cadastro é aberto)
- Chaves de API fora do navegador

## 8. Design (frontend-specialist — ler antes da Fase 1)

- Mobile-first, limpo e elegante; **sem roxo/violeta** (Purple Ban da dev-skills)
- Seguir o jeitão da GUI (tema escuro, acento verde) mas com cara de produto moderno
- shadcn/ui + Tailwind; componentes acessíveis; nada de layout clichê

## 9. Fases (cada uma já funciona e dá pra testar)

| Fase | Entrega | Testa |
|---|---|---|
| **0** | Scaffold Next.js + Tailwind + Postgres + Auth (cadastro/login) | Logar funciona |
| **1** | Painéis (dashboard usuário + admin), layout e tema | Navegação bonita |
| **2** | Formulário "novo vídeo" + upload + cria Job na fila | Pedido entra na fila |
| **3** | Worker no PC: lê a fila → roda a fábrica → sobe o vídeo | Render ponta a ponta |
| **4** | Status em tempo real + download qualidade total + copy/hashtags | Cliente baixa o vídeo |
| **5** | Deploy no EasyPanel + worker conectando do PC | No ar, no domínio |
| **6 (futuro)** | Render na nuvem / pagamento (se um dia precisar) | Escala |

## 10. O que roda onde

- **Servidor (EasyPanel)**: app web, Postgres, storage dos arquivos
- **Seu PC**: worker (Python) — onde estão o FFmpeg e as chaves de API

## 11. Pendências menores (resolver durante a Fase 0)

- Nome/identidade do app (sugestões: "VideoForge", "Fábrica IA", algo da LL Digital)
- Idioma da interface (PT por enquanto; i18n depois se for vender lá fora)
- Confirmar o volume/pasta de storage no servidor
