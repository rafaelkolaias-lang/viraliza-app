# Viraliza

Plataforma web (SaaS) de ferramentas de marketing/conteúdo viral. Carro-chefe: gerar
vídeos de produto 9:16 (Shopee/TikTok) com IA. Também: acervo de cortes, cortes de
YouTube, leads do Google Maps, produtos/vídeos virais da Shopee e área de membros.

> **Mapa completo do projeto (para devs e IAs): [`!projeto.md`](./!projeto.md)** -
> stack, onde está cada coisa, fluxos críticos, armadilhas e pendências.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- **MySQL** via Prisma; auth caseiro (JWT em cookie httpOnly + bcrypt)
- **Worker de render** em Python (PC/servidor do dono) - `bot shopee/`
- **Pagamento:** Kiwify (checkout + webhook com confirmação na API)
- **Atribuição de vendas:** Meta Conversions API (pixel "Viraliza - Vendas")
- **Deploy:** Docker → EasyPanel (branch de produção: `v3`)

## Rodar local

```bash
npm install
# criar .env na raiz: DATABASE_URL, SESSION_SECRET, WORKER_TOKEN
npx prisma generate
npm run dev   # http://localhost:3000
```

O 1º cadastro vira admin. Integrações (Kiwify, Meta CAPI, ElevenLabs, Gemini) leem
as chaves do ambiente de produção (EasyPanel); sem elas o código degrada sem quebrar.

## Monetização (resumo)

Entrada de R$ 19,90 (Kiwify) libera cadastro + biblioteca + crédito mensal de brinde.
Créditos (1 crédito = R$ 0,01) pagam a produção de vídeo, debitados pelo custo real
das APIs. Reembolso tem consequência automática (perda de brinde/assinatura; chargeback
bloqueia login) e toda venda/estorno vira evento Purchase/Refund no pixel da Meta -
detalhes em [`!projeto.md`](./!projeto.md).
