
# Regras Temporárias do Projeto

Este arquivo contém regras específicas e temporárias que se aplicam apenas ao projeto atual.
Diferente do `RULES.md` (regras globais e permanentes), as regras aqui podem ser adicionadas, alteradas ou removidas conforme a necessidade do momento.

---

## Regras ativas

### Proibido usar travessão "—" (em dash)

NÃO usar o caractere travessão "—" em lugar nenhum do projeto: nem em textos do
front-end (telas, botões, mensagens, toasts), nem no back-end, nem em comentários
de código. Motivo: o travessão "denuncia" texto gerado por IA, e a plataforma não
pode ter essa cara.

- Em vez de "—", usar hífen normal "-", vírgula, dois-pontos ou reescrever a frase.
- Vale para qualquer arquivo de código (`.ts`, `.tsx`, `.js`, `.mjs`, `.css`,
  `.prisma`) e textos visíveis ao usuário.
- Ao criar ou editar qualquer arquivo, revisar e garantir que nenhum "—" entrou.