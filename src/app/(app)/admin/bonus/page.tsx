import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { listarPedidosBonusIg } from "@/lib/bonus-instagram";
import { AdminBonusInstagram } from "@/components/app/admin-bonus-instagram";

export const metadata: Metadata = { title: "Admin · Bônus Instagram" };
export const dynamic = "force-dynamic";

export default async function AdminBonusPage() {
  await requireAdmin();
  const pedidos = await listarPedidosBonusIg();
  const pendentes = pedidos.filter((p) => p.status === "pendente").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bônus Instagram</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos de +300 créditos por seguir o @viralizapp_ofc. Confira o perfil e
          aprove pra liberar os créditos, ou recuse.
          {pendentes > 0 ? ` ${pendentes} aguardando.` : ""}
        </p>
      </div>

      <AdminBonusInstagram pedidos={pedidos} />
    </div>
  );
}
