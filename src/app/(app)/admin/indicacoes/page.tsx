import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { indicacoesParaAdmin, BONUS_INDICACAO_CENTAVOS } from "@/lib/afiliados-admin";
import { AdminIndicacoes } from "@/components/app/admin-indicacoes";

export const metadata: Metadata = { title: "Admin · Indicações" };
export const dynamic = "force-dynamic";

export default async function AdminIndicacoesPage() {
  await requireAdmin();
  const indicacoes = await indicacoesParaAdmin(90);
  const aBonificar = indicacoes.filter(
    (i) => i.status === "paid" && i.cadastrou && !i.bonificado,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Indique e Ganhe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas as vendas que vieram de afiliado, com quem indicou e se a pessoa chegou a criar
          conta aqui. O bônus em créditos você solta na mão, só quando a indicação virou cadastro.
          {aBonificar > 0 ? ` ${aBonificar} esperando bônus.` : ""}
        </p>
      </div>

      <AdminIndicacoes indicacoes={indicacoes} bonusCentavos={BONUS_INDICACAO_CENTAVOS} />
    </div>
  );
}
