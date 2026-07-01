"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { creditar } from "@/lib/creditos";

/**
 * Ações de TESTE (admin) - pra demonstrar a carteira enquanto a Kiwify (pagamento)
 * e o worker (débito por uso real) não estão integrados.
 */

/** Credita um valor (em reais) na PRÓPRIA conta admin. SÓ ADMIN. */
export async function creditarTeste(reais: number) {
  const admin = await requireAdmin();
  const centavos = Math.round(Math.abs(reais) * 100);
  await creditar(admin.id, centavos, "ajuste_admin", "Crédito de teste (admin)");
  revalidatePath("/painel/creditos");
  revalidatePath("/painel");
}

/** Liga/desliga a assinatura da própria conta admin (vence em 30 dias). SÓ ADMIN. */
export async function alternarAssinaturaTeste() {
  const admin = await requireAdmin();
  const u = await prisma.user.findUnique({
    where: { id: admin.id },
    select: { assinante: true },
  });
  const ativar = !u?.assinante;
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      assinante: ativar,
      assinaturaAte: ativar ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      // reseta o controle do crédito mensal pra o bônus poder cair de novo no teste
      creditoMensalEm: null,
    },
  });
  revalidatePath("/painel/creditos");
  revalidatePath("/painel");
}
