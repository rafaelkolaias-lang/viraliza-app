import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { Material } from "@/lib/types";

export const MATERIAIS_JSON = path.join(process.cwd(), "data", "materiais.json");

/**
 * Lê os materiais que o admin disponibilizou (data/materiais.json).
 * Cada material é um link externo (Drive/Mega...) ou um arquivo em public/downloads/.
 */
export function getMateriais(): Material[] {
  try {
    const arr = JSON.parse(fs.readFileSync(MATERIAIS_JSON, "utf8")) as Material[];
    if (Array.isArray(arr)) return arr;
  } catch {
    // sem arquivo ainda
  }
  return [];
}
