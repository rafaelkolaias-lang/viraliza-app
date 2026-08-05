"use server";

import { requireAdmin } from "@/lib/dal";
import { getCriacoes } from "@/lib/admin";
import type { FiltroCriacoes, ItemCriacao } from "@/lib/criacoes";

/**
 * "Carregar mais" da tela Criação dos usuários. A galeria manda o filtro atual
 * e a data do último item que ela já tem; volta o lote seguinte, mais antigo.
 */
export async function maisCriacoes(
  filtro: FiltroCriacoes,
): Promise<{ itens: ItemCriacao[]; temMais: boolean }> {
  await requireAdmin();
  return getCriacoes(filtro);
}
