# Plano de Execução

> **Como usar:** Pendentes ficam no topo de cada seção do Claude correspondente. Concluídas ficam abaixo, em formato enxuto, ou seja, ao concluir, transforme a tarefa em formato enxuto e mova ela para a sessão de concluídas do Claude correspondente.

---

# Claude 1

## Tarefas Pendentes — Claude 1:


---

## Tarefas Concluídas — Claude 1:

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
