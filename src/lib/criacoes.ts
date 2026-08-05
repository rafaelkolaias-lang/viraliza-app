import type { VideoJob } from "@/lib/types";

/**
 * "Criação dos usuários": vídeo, imagem e avatar de todo mundo numa lista só,
 * em ordem de quando aconteceu, com filtro de pessoa, período e tipo.
 *
 * Este arquivo é PURO de propósito (sem prisma, sem `server-only`): a galeria
 * roda no navegador e precisa dos tipos e das listas daqui. A consulta que
 * monta os itens é `getCriacoes`, em `lib/admin.ts`.
 */
export type TipoCriacao = "video" | "imagem" | "avatar";

export const TIPOS_CRIACAO: { chave: TipoCriacao; label: string }[] = [
  { chave: "video", label: "Vídeos" },
  { chave: "imagem", label: "Imagens" },
  { chave: "avatar", label: "Avatares" },
];

export type ItemCriacao = {
  chave: string; // tipo + id (são 3 tabelas, o id pode repetir entre elas)
  id: string;
  tipo: TipoCriacao;
  quando: string; // ISO
  titulo: string;
  ferramenta: string; // de onde saiu, em português
  usuarioId: string;
  usuarioNome: string;
  usuarioEmail: string;
  /** vídeo: o job inteiro (abre o mesmo player da tela de vídeos) */
  job?: VideoJob;
  /** vídeo: quanto custou de crédito (null = não cobrado, ex.: admin) */
  creditos?: number | null;
  /** imagem e avatar: arquivo pra ver */
  imagemUrl?: string;
  /** imagem: quantos vídeos já saíram dela; avatar: gênero */
  extra?: string;
};

export type FiltroCriacoes = {
  userId?: string; // pessoa exata (botão "Ver criações")
  busca?: string; // nome ou e-mail digitado
  dias?: number; // 0 ou undefined = desde o começo
  tipos?: TipoCriacao[]; // vazio = todos
  antes?: string; // ISO: só o que for mais antigo que isso (carregar mais)
  limite?: number;
};

export const DIAS_CRIACOES_PADRAO = 0; // começa mostrando tudo
export const PERIODOS_CRIACOES = [
  { v: 1, label: "24 h" },
  { v: 7, label: "7 dias" },
  { v: 30, label: "30 dias" },
  { v: 90, label: "90 dias" },
  { v: 0, label: "Tudo" },
] as const;

/**
 * Nome da ferramenta que gerou o vídeo. Mesma regra da contagem de uso
 * (`lib/uso-ferramentas.ts`): a marca gravada nas opções manda, e a pasta
 * /avatares/ só decide o que é antigo demais pra ter marca.
 */
export function ferramentaDoVideo(j: {
  tipo: string;
  opcoes: string | null;
  midias: string | null;
  saidas: string | null;
}): string {
  if (j.tipo === "marca") return "Aplicar marca em lote";
  if (j.tipo === "cortes") return "Cortes de vídeo";
  const o = j.opcoes ?? "";
  if (o.includes('"lab":true')) return "Viraliza Labs";
  if (o.includes('"boost":true')) return "Viral Boost";
  if (o.includes('"avatar":true')) return "Novo influenciador";
  if ((j.midias ?? "").includes("/avatares/") || (j.saidas ?? "").includes("/avatares/"))
    return "Novo influenciador";
  return "Editor automático";
}

export const FERRAMENTA_IMAGEM: Record<string, string> = {
  lab: "Viraliza Labs",
  boost: "Viral Boost",
  avatar: "Novo influenciador",
};

export const FERRAMENTA_AVATAR: Record<string, string> = {
  quiz: "Criado do zero",
  foto: "Da foto dele",
  produto: "Com produto",
  upload: "Enviado pelo usuário",
};

/** Origem do avatar, guardada dentro do JSON de escolhas. */
export function origemDoAvatar(escolhas: string | null): string {
  if (!escolhas) return "quiz";
  try {
    const o = JSON.parse(escolhas) as { origem?: string };
    return typeof o.origem === "string" ? o.origem : "quiz";
  } catch {
    return "quiz";
  }
}
