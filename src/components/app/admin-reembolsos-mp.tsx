import { prisma } from "@/lib/prisma";
import { RotateCcw } from "lucide-react";

/**
 * Reembolsos que os próprios clientes pediram (self-service, Mercado Pago).
 *
 * Fica na visão geral de finanças pra dar visibilidade sem depender de abrir o
 * painel do Mercado Pago: se essa lista começar a crescer, é sinal de que algo
 * na oferta ou no produto está prometendo o que não entrega.
 */
const fmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function AdminReembolsosMP({ desde }: { desde: Date }) {
  const linhas = await prisma.creditoTransacao.findMany({
    where: {
      tipo: "estorno",
      criadoEm: { gte: desde },
      kiwifyOrderId: { startsWith: "mp-" },
    },
    orderBy: { criadoEm: "desc" },
    take: 50,
    select: {
      id: true,
      criadoEm: true,
      valor: true,
      descricao: true,
      kiwifyOrderId: true,
      user: { select: { email: true, nome: true } },
    },
  });

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <RotateCcw className="size-4 text-muted-foreground" />
        Reembolsos pedidos pelos clientes ({linhas.length})
      </h2>

      {linhas.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-10 text-center">
          <RotateCcw className="size-7 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum reembolso no período</p>
          <p className="text-sm text-muted-foreground">
            Quando alguém pedir pelo painel, aparece aqui na hora.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-accent/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Quando</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Compra</th>
                <th className="px-3 py-2 text-right font-medium">Créditos tirados</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {fmt.format(l.criadoEm)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="block truncate">{l.user?.nome ?? "-"}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {l.user?.email ?? "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="block truncate">{l.descricao ?? "-"}</span>
                    <span className="block truncate text-xs">{l.kiwifyOrderId}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-red-500">
                    {brl(Math.abs(l.valor))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        O valor da coluna é o crédito retirado da conta. O dinheiro devolvido pode
        ser menor quando a pessoa usou mais de 80% do pacote (redutor de 30% da
        política): confira o valor exato no painel do Mercado Pago.
      </p>
    </div>
  );
}
