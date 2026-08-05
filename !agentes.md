## Claude 1 | inicio: 2026-08-05 06:05
- ocioso
- AVISO: o passo a passo do robo de suporte agora e CODIGO (`src/lib/suporte-guia.ts`),
  nao mais o modelo. A rota `api/suporte/chat` tenta a guia antes do LLM. Se mexer
  nos textos dos passos, lembre que os 40 primeiros caracteres de cada passo sao a
  chave que acha onde a conversa parou. Detalhes no `!projeto.md`.

## Claude 3 | inicio: 2026-08-05 08:45
- ocioso
- AVISO PRA TODOS: mexi no Editor automatico de ponta a ponta (tela -> API -> worker
  -> fabrica). A montagem da tela agora CHEGA no render via `opcoes.roteiro` +
  `roteiro.json`, tem clipe principal com B-roll e "Reajustar audio" nos videos
  prontos. Detalhes no `!projeto.md` (secao "MONTAGEM DO EDITOR"). Bugs #22, #23 e
  #24 do `auditoria.md` foram corrigidos. `bot shopee/fabrica.py`,
  `gemini_copy.py` e `worker_serverrk.py` precisam ir pro container do serverrk.

## Pendencia herdada (deixada pelo Claude 2, registro abandonado)
- 3 COMENTARIOS de codigo desatualizados falando de uma "aba Cenarios do Personalize
  com IA" que nao existe mais (virou a tela /painel/meus-avatares/cenarios):
  `src/lib/cenarios-usuario.ts:7`, `src/app/api/cenarios/route.ts:20` e
  `src/components/app/meus-cenarios.tsx:11`. Os dois primeiros tambem tem travessao
  "—", proibido pelo temporary_rules.md.
