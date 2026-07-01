"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import type { ViralProduto } from "@/lib/types";

export type ProdutoActionState = { erro?: string; ok?: boolean } | undefined;

/** Exclui um produto viral da galeria. SÓ ADMIN. */
export async function excluirProduto(id: string): Promise<ProdutoActionState> {
  await requireAdmin();
  if (!id) return { erro: "Produto inválido." };

  const jsonPath = path.join(process.cwd(), "data", "produtos.json");
  let lista: ViralProduto[] = [];
  try {
    lista = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as ViralProduto[];
  } catch {
    return { erro: "Nada para excluir ainda." };
  }

  const alvo = lista.find((p) => p.id === id);
  if (!alvo) return { erro: "Produto não encontrado." };

  if (alvo.arquivo) {
    const rel = alvo.arquivo.replace(/^\/+/, "");
    try {
      fs.rmSync(path.join(process.cwd(), "public", rel), { force: true });
    } catch {
      // já sumiu - segue
    }
  }

  const nova = lista.filter((p) => p.id !== id);
  const tmp = jsonPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(nova, null, 2), "utf8");
  fs.renameSync(tmp, jsonPath);

  revalidatePath("/painel/produtos");
  return { ok: true };
}
