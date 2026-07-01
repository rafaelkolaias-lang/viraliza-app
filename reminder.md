Tanto Claude quanto Codex/Antigravity podem adicionar, editar ou remover
lembretes neste arquivo a pedido do usuário.

---

## Lembretes ativos

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

- **Instrumentar o `cortar_youtube.py` (custo real dos Cortes).** Hoje um job de
  cortes não reporta consumo, então cai no preço FIXO `editorManual` e aparece como
  "Edição (processamento)" no extrato (rótulo errado). Igual fiz com Gemini/ElevenLabs:
  medir o uso e gravar no `consumo.json`.

- **Calibrar os valores de crédito (depois do worker + preço das APIs).**
  Falta definir os números reais: (a) quanto é "1 minuto de vídeo texto+áudio"
  (crédito padrão da assinatura) e (b) o preço fixo das ferramentas sem API
  (Lote, Editor manual, MapsLeads) = ≈25% abaixo do "vídeo só com transcrição
  Gemini". A estrutura da carteira fica pronta agora; o número entra quando o
  dono passar o worker Python e a gente confirmar o preço atual do Gemini/ElevenLabs.

- **Verificar quais APIs o "Cortes de qualquer vídeo" (`/painel/cortes`) usa.**
  Worker já localizado em `bot shopee/`. Ler `cortar_youtube.py`, `analisar.py`
  e `legendar_video.py` pra confirmar serviços/modelos (provável: yt-dlp +
  Gemini pra escolher momentos + transcrição) e **o custo** de cada corte, pra
  entrar na conta de crédito.
