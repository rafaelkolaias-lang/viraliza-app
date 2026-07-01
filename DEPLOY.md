# Deploy do Viraliza (EasyPanel)

A web roda no **EasyPanel** (servidor). O **render dos vídeos roda no seu PC**
(o worker conversa com a web por HTTP). Os **bots** (Telegram, fábrica) também ficam no PC.

## Arquitetura

```
Cliente (navegador) ─── HTTPS ──▶ EasyPanel: web Viraliza (Next.js)
                                      │  fila de jobs (SQLite no volume)
        seu PC ──▶ worker.py ─── HTTP (WORKER_TOKEN) ──▶ /api/worker/*
                   roda a fábrica e sobe o vídeo pronto
```

## Variáveis de ambiente (EasyPanel → Environment)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `file:/app/data/prod.db` |
| `SESSION_SECRET` | um segredo novo e forte (32+ bytes) |
| `WORKER_TOKEN` | o MESMO token do `.env` da raiz no PC |

> As chaves Gemini/ElevenLabs/Telegram **NÃO** vão pro servidor — só o PC usa.

## Volumes (persistem entre deploys)

| Caminho no container | Pra quê |
|---|---|
| `/app/data` | banco SQLite + json de virais/materiais + uploads |
| `/app/public/videos` | vídeos prontos (saída do render) |
| `/app/public/virais` | vídeos virais baixados |
| `/app/public/downloads` | materiais da Área do membro |

## Build

- Build method: **Dockerfile** (já incluído).
- Porta interna: **3000**.

## Domínio

1. No Cloudflare, crie um registro **A** apontando o domínio (ex: `viraliza.lldesenvolvimento.com.br`) pro IP do servidor do EasyPanel (DNS only / sem proxy laranja na 1ª vez, pra o Let's Encrypt validar).
2. No EasyPanel (serviço → Domains), adicione o domínio e ative HTTPS (Let's Encrypt).
3. Depois pode ligar o proxy do Cloudflare se quiser.

## Ligando o PC na produção

No `.env` da **raiz** (no PC), troque:

```
WEB_URL=https://viraliza.lldesenvolvimento.com.br
WORKER_TOKEN=<o mesmo do EasyPanel>
```

Aí rode o worker: `python "bot shopee/worker.py"`.
