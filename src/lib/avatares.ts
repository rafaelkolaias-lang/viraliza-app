import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CABELO_COMPRIMENTOS,
  CABELO_CORES,
  TIPOS_FISICOS,
  TONS_PELE,
  type Opcao,
} from "@/lib/avatar-modelo";
import { salvarNaGaleria } from "@/lib/galeria-servidor";

/**
 * Avatares do usuario (Meus avatares). A criacao gera a foto no gpt-image-1, sobe
 * pro serverrk e registra a linha aqui. Custa creditos (geracao de imagem e mais
 * cara que um video comum). Ver openai-image.ts + serverrk-upload.ts.
 */

export { CUSTO_AVATAR } from "@/lib/avatar-modelo";

export type AvatarItem = {
  id: string;
  nome: string;
  genero: string;
  imagemUrl: string;
  criadoEm: string;
  // origem da imagem: "quiz" (do zero), "foto" (da foto da pessoa) ou "produto"
  // (avatar JÁ com o produto). Só os "produto" servem pro vídeo de 15s (1 imagem).
  origem: string;
  // linha embaixo do nome no card ("Feminino, 25 anos, Morena, cabelo Preto longo")
  ficha: string;
};

/** Lê a `origem` de dentro do JSON de escolhas (quiz/foto/produto). */
function origemDe(escolhas: string | null): string {
  if (!escolhas) return "quiz";
  try {
    const o = JSON.parse(escolhas) as { origem?: string };
    return typeof o.origem === "string" ? o.origem : "quiz";
  } catch {
    return "quiz";
  }
}

/**
 * Linha de identificação do card, montada com as escolhas guardadas na criação.
 * Avatar que veio de foto, de upload ou com produto não tem essas escolhas: nesse
 * caso a linha diz a procedência, que é a informação útil ali.
 */
function fichaDe(escolhas: string | null, genero: string, origem: string): string {
  let e: Record<string, string | number> = {};
  try {
    e = escolhas ? (JSON.parse(escolhas) as Record<string, string | number>) : {};
  } catch {
    e = {};
  }
  const rotulo = (lista: Opcao[], chave?: string) =>
    lista.find((o) => o.chave === chave)?.label ?? "";

  const cabelo = [
    rotulo(CABELO_CORES, e.cabeloCor as string),
    rotulo(CABELO_COMPRIMENTOS, e.cabeloComprimento as string).toLowerCase(),
  ]
    .filter(Boolean)
    .join(" ");
  const detalhes = [
    e.idade ? `${e.idade} anos` : "",
    rotulo(TONS_PELE, e.tomPele as string),
    cabelo ? `cabelo ${cabelo}` : "",
    rotulo(TIPOS_FISICOS, e.tipoFisico as string),
  ].filter(Boolean);

  if (!detalhes.length) {
    if (origem === "produto") return "Avatar já com o produto na cena";
    if (origem === "foto") return "Criado a partir de uma foto sua";
    if (origem === "upload") return "Imagem enviada por você";
    return "";
  }
  return [genero === "male" ? "Masculino" : "Feminino", ...detalhes].join(", ");
}

/** Lista os avatares prontos do usuario (mais novos primeiro). */
export async function listarAvatares(userId: string): Promise<AvatarItem[]> {
  const rows = await prisma.avatar.findMany({
    where: { userId, status: "pronto" },
    orderBy: { criadoEm: "desc" },
    select: { id: true, nome: true, genero: true, imagemUrl: true, escolhas: true, criadoEm: true },
  });
  return rows.map((a) => ({
    id: a.id,
    nome: a.nome,
    genero: a.genero,
    imagemUrl: a.imagemUrl,
    criadoEm: a.criadoEm.toISOString(),
    origem: origemDe(a.escolhas),
    ficha: fichaDe(a.escolhas, a.genero, origemDe(a.escolhas)),
  }));
}

/** Cria a linha do avatar apos a foto ja estar hospedada no serverrk. */
export async function registrarAvatar(opts: {
  userId: string;
  nome: string;
  genero: string;
  imagemUrl: string;
  escolhas: unknown;
}): Promise<AvatarItem> {
  const a = await prisma.avatar.create({
    data: {
      userId: opts.userId,
      nome: opts.nome.slice(0, 120),
      genero: opts.genero === "male" ? "male" : "female",
      status: "pronto",
      imagemUrl: opts.imagemUrl,
      escolhas: JSON.stringify(opts.escolhas ?? {}),
    },
    select: { id: true, nome: true, genero: true, imagemUrl: true, escolhas: true, criadoEm: true },
  });
  const origem = origemDe(a.escolhas);
  // O que a IA criou aqui também entra em "Minhas imagens". Origem "upload" fica
  // de fora por dois motivos: a foto é dela (não geramos nada) e é por esse
  // caminho que passa o "Salvar como influencer" de uma imagem do Lab, que JÁ
  // está na galeria. Sem isso o mesmo card aparecia duas vezes e o contador de
  // vídeos era somado nas duas linhas.
  // Sem await de propósito: a galeria é bônus, não pode atrasar a resposta.
  if (origem !== "upload") {
    void salvarNaGaleria({
      userId: opts.userId,
      origem: "avatar",
      titulo: a.nome,
      imagemUrl: a.imagemUrl,
    });
  }
  return {
    id: a.id,
    nome: a.nome,
    genero: a.genero,
    imagemUrl: a.imagemUrl,
    criadoEm: a.criadoEm.toISOString(),
    origem,
    ficha: fichaDe(a.escolhas, a.genero, origem),
  };
}
