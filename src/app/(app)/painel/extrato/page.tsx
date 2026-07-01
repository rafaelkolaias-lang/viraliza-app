import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { getCarteira, listarExtrato } from "@/lib/creditos";
import { ExtratoDetalhado } from "@/components/app/extrato-detalhado";

export const metadata: Metadata = { title: "Extrato da conta" };
export const dynamic = "force-dynamic";

export default async function ExtratoPage() {
  const user = await requireUser();
  const [carteira, txs] = await Promise.all([
    getCarteira(user.id),
    listarExtrato(user.id, 1000),
  ]);

  const transacoes = txs.map((t) => ({
    id: t.id,
    tipo: t.tipo,
    valor: t.valor,
    saldoApos: t.saldoApos,
    descricao: t.descricao ?? "",
    criadoEm: t.criadoEm.toISOString(),
  }));

  return (
    <ExtratoDetalhado
      saldoCentavos={carteira.saldoCentavos}
      transacoes={transacoes}
      agoraMs={Date.now()}
    />
  );
}
