/**
 * Catálogo do que dá pra CONTAR por pessoa (o que ela fez e quantas vezes).
 * Arquivo puro de propósito: é usado pelas telas do admin (cliente) e pela
 * consulta que monta os números (`contarUsoPorUsuario`, em `lib/admin.ts`).
 *
 * De onde sai cada número (nenhuma coluna nova no banco, tudo do que já existe):
 * - imagens: tabela ImagemGerada, campo "origem" (lab | boost | avatar)
 * - vídeos: tabela Job. Lab, Viral Boost e Novo influenciador gravam a marca de origem
 *   no campo "opcoes" (ex.: {"lab":true}); marca em lote e cortes têm "tipo"
 *   próprio; o que sobra de "produto" é Editor automático PRO.
 * - vídeo do Novo influenciador ANTIGO: não nascia marcado, então cai no plano B de
 *   olhar se o arquivo final foi parar na pasta /avatares/. Isso só pega os que
 *   ficaram prontos: os que deram erro naquela época contam como Editor.
 * - influenciador: tabela Avatar.
 * - MapsLeads: cobrança de crédito "Busca de leads" (admin não é cobrado, então
 *   busca feita por conta admin não aparece).
 * - Gerador de prompt: tabela GastoApi, origem "gerador-prompt". Ela só existe
 *   desde 04/08/2026, então antes disso o número é sempre zero.
 */
export type ChaveFerramenta =
  | "imgAvatar"
  | "imgLab"
  | "imgBoost"
  | "vidAvatar"
  | "vidLab"
  | "vidBoost"
  | "vidEditor"
  | "vidLote"
  | "vidCortes"
  | "influenciador"
  | "leads"
  | "prompt";

export type GrupoUso = "imagem" | "videoIa" | "outro";

export type UsoFerramentas = Record<ChaveFerramenta, number>;

export const FERRAMENTAS: {
  chave: ChaveFerramenta;
  rotulo: string; // nome completo (gaveta e tela de uso)
  curto: string; // cabeçalho da planilha
  grupo: GrupoUso;
  ajuda?: string; // ressalva mostrada ao passar o mouse
}[] = [
  { chave: "imgAvatar", rotulo: "Imagem do Novo influenciador", curto: "Img IA", grupo: "imagem" },
  { chave: "imgLab", rotulo: "Imagem do Viraliza Labs", curto: "Img Labs", grupo: "imagem" },
  { chave: "imgBoost", rotulo: "Imagem do Viral Boost", curto: "Img Boost", grupo: "imagem" },
  {
    chave: "vidAvatar",
    rotulo: "Vídeo do Novo influenciador",
    curto: "Víd IA",
    grupo: "videoIa",
    ajuda:
      "Vídeo do Novo influenciador que deu erro antes de 05/08/2026 aparece no Editor automático PRO.",
  },
  { chave: "vidLab", rotulo: "Vídeo do Viraliza Labs", curto: "Víd Labs", grupo: "videoIa" },
  { chave: "vidBoost", rotulo: "Vídeo do Viral Boost", curto: "Víd Boost", grupo: "videoIa" },
  { chave: "vidEditor", rotulo: "Editor automático PRO", curto: "Editor PRO", grupo: "outro" },
  { chave: "vidLote", rotulo: "Aplicar marca em lote", curto: "Lote", grupo: "outro" },
  { chave: "vidCortes", rotulo: "Cortes de vídeo", curto: "Cortes", grupo: "outro" },
  { chave: "influenciador", rotulo: "Influenciador criado", curto: "Influ", grupo: "outro" },
  {
    chave: "leads",
    rotulo: "Busca no MapsLeads",
    curto: "Leads",
    grupo: "outro",
    ajuda: "Busca feita por conta admin não conta (admin não é cobrado).",
  },
  {
    chave: "prompt",
    rotulo: "Gerador de prompt",
    curto: "Prompt",
    grupo: "outro",
    ajuda: "Só existe registro a partir de 04/08/2026.",
  },
];

/** Períodos da tela "Uso das ferramentas". 0 = desde que a plataforma existe. */
export const PERIODOS_USO = [
  { v: 1, label: "24 h" },
  { v: 7, label: "7 dias" },
  { v: 14, label: "14 dias" },
  { v: 30, label: "30 dias" },
  { v: 0, label: "Tudo" },
] as const;
export const DIAS_USO_PADRAO = 30;

export const GRUPO_ROTULO: Record<GrupoUso, string> = {
  imagem: "Imagens",
  videoIa: "Vídeos IA",
  outro: "Outros usos",
};

export function usoVazio(): UsoFerramentas {
  const u = {} as UsoFerramentas;
  for (const f of FERRAMENTAS) u[f.chave] = 0;
  return u;
}

export function somaGrupo(uso: UsoFerramentas, grupo: GrupoUso): number {
  let s = 0;
  for (const f of FERRAMENTAS) if (f.grupo === grupo) s += uso[f.chave];
  return s;
}

export function totalUso(uso: UsoFerramentas): number {
  let s = 0;
  for (const f of FERRAMENTAS) s += uso[f.chave];
  return s;
}

/** Soma b dentro de a (usado pra montar a linha de totais). */
export function somarUso(a: UsoFerramentas, b: UsoFerramentas): UsoFerramentas {
  for (const f of FERRAMENTAS) a[f.chave] += b[f.chave];
  return a;
}
