"use server";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { getMateriais, MATERIAIS_JSON } from "@/lib/materiais";
import type { Material, MaterialTipo } from "@/lib/types";

export type MaterialState = { erro?: string; ok?: boolean } | undefined;

const TIPOS: MaterialTipo[] = ["pacote", "video", "musica", "imagem", "outro"];

function salvar(lista: Material[]) {
  fs.mkdirSync(path.dirname(MATERIAIS_JSON), { recursive: true });
  const tmp = MATERIAIS_JSON + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(lista, null, 2), "utf8");
  fs.renameSync(tmp, MATERIAIS_JSON);
}

/** Adiciona um material à Área do membro. SÓ ADMIN. */
export async function adicionarMaterial(
  _prev: MaterialState,
  formData: FormData,
): Promise<MaterialState> {
  await requireAdmin();

  const titulo = String(formData.get("titulo") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const tamanho = String(formData.get("tamanho") ?? "").trim();
  const tipoRaw = String(formData.get("tipo") ?? "pacote").trim();
  const tipo = (TIPOS.includes(tipoRaw as MaterialTipo) ? tipoRaw : "pacote") as MaterialTipo;

  if (titulo.length < 2) return { erro: "Dê um nome ao material." };
  // aceita link externo (http) ou caminho local servido pela web (/downloads/...)
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    return { erro: "Cole um link (http...) ou um caminho /downloads/arquivo." };
  }

  const lista = getMateriais();
  const item: Material = {
    id: randomUUID().slice(0, 8),
    titulo,
    descricao: descricao || undefined,
    url,
    tipo,
    tamanho: tamanho || undefined,
    adicionadoEm: new Date().toISOString(),
  };
  salvar([item, ...lista]);

  revalidatePath("/painel/membro");
  return { ok: true };
}

/** Remove um material. SÓ ADMIN. Apaga o arquivo local se for de public/downloads. */
export async function excluirMaterial(id: string): Promise<MaterialState> {
  await requireAdmin();
  if (!id) return { erro: "Material inválido." };

  const lista = getMateriais();
  const alvo = lista.find((m) => m.id === id);
  if (!alvo) return { erro: "Material não encontrado." };

  // se for arquivo local (servido de public/), apaga do disco também
  if (alvo.url.startsWith("/")) {
    try {
      fs.rmSync(path.join(process.cwd(), "public", alvo.url.replace(/^\/+/, "")), {
        force: true,
      });
    } catch {
      // já sumiu - segue
    }
  }

  salvar(lista.filter((m) => m.id !== id));
  revalidatePath("/painel/membro");
  return { ok: true };
}
