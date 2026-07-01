"use server";

import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import type { ViralVideo } from "@/lib/types";

export type ViralActionState = { erro?: string; ok?: boolean } | undefined;

/**
 * Exclui um vídeo viral da galeria. SÓ ADMIN.
 * Remove a entrada do data/virais.json e apaga o arquivo em public/virais/.
 */
export async function excluirViral(id: string): Promise<ViralActionState> {
  await requireAdmin(); // se não for admin, redireciona - ninguém mais exclui

  if (!id) return { erro: "Vídeo inválido." };

  const jsonPath = path.join(process.cwd(), "data", "virais.json");

  let lista: ViralVideo[] = [];
  try {
    lista = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as ViralVideo[];
  } catch {
    return { erro: "Nada para excluir ainda." };
  }

  const alvo = lista.find((v) => v.id === id);
  if (!alvo) return { erro: "Vídeo não encontrado." };

  // apaga o arquivo de vídeo (se existir dentro de public/)
  if (alvo.arquivo) {
    const rel = alvo.arquivo.replace(/^\/+/, ""); // "/virais/x.mp4" -> "virais/x.mp4"
    const arquivoPath = path.join(process.cwd(), "public", rel);
    try {
      fs.rmSync(arquivoPath, { force: true });
    } catch {
      // arquivo já sumiu - segue removendo do json mesmo assim
    }
  }

  const nova = lista.filter((v) => v.id !== id);
  const tmp = jsonPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(nova, null, 2), "utf8");
  fs.renameSync(tmp, jsonPath);

  revalidatePath("/painel/virais");
  return { ok: true };
}
