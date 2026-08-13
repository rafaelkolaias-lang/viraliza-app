import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { contarUsoPorUsuario } from "@/lib/admin";
import { AdminUso, type LinhaUso } from "@/components/app/admin-uso";
import {
  DIAS_USO_PADRAO,
  FERRAMENTAS,
  PERIODOS_USO,
  usoVazio,
} from "@/lib/uso-ferramentas";

export const metadata: Metadata = { title: "Admin · Uso das ferramentas" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Vira "2026-08-06" numa data de verdade. `fim = true` põe o relógio no último
 * instante do dia, senão pedir 01/08 a 06/08 pararia à meia-noite do dia 6 e
 * deixaria o dia inteiro de fora.
 */
function lerData(valor: string | undefined, fim: boolean): Date | null {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}T${fim ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function AdminUsoPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; inicio?: string; fim?: string }>;
}) {
  await requireAdmin();

  const sp = await searchParams;

  // Período personalizado tem prioridade: quem digitou uma data quer aquele
  // intervalo, não os 30 dias do padrão. Basta UMA das pontas (só "de" = daquele
  // dia até hoje; só "até" = desde o começo até aquele dia).
  const DATA = /^\d{4}-\d{2}-\d{2}$/;
  let inicioStr = DATA.test(sp?.inicio ?? "") ? sp.inicio : undefined;
  let fimStr = DATA.test(sp?.fim ?? "") ? sp.fim : undefined;
  const personalizado = !!inicioStr || !!fimStr;

  // datas trocadas de lugar: em vez de devolver tabela vazia, inverte e mostra o
  // intervalo que a pessoa claramente quis. A troca é feita no TEXTO, antes de
  // virar data: trocar as datas prontas embaralharia as horas (o "até" carrega
  // 23:59) e o intervalo sairia vazio.
  if (inicioStr && fimStr && inicioStr > fimStr) [inicioStr, fimStr] = [fimStr, inicioStr];

  let desde = lerData(inicioStr, false);
  const ate = lerData(fimStr, true);

  const pedido = Number(sp?.dias);
  const dias = personalizado
    ? -1
    : PERIODOS_USO.some((p) => p.v === pedido)
      ? pedido
      : DIAS_USO_PADRAO;
  if (!personalizado) desde = dias > 0 ? new Date(Date.now() - dias * 86_400_000) : null;

  const [users, usoPor] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, nome: true, email: true, role: true },
      orderBy: { criadoEm: "asc" },
    }),
    contarUsoPorUsuario(desde, ate),
  ]);

  const linhas: LinhaUso[] = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    uso: usoPor.get(u.id) ?? usoVazio(),
  }));

  // O texto do período sai do TEXTO da data, não de um `toLocaleDateString`: o
  // servidor pode estar noutro fuso e mostraria um dia a menos.
  const dia = (s: string) => s.split("-").reverse().join("/");
  const label = personalizado
    ? inicioStr && fimStr
      ? `${dia(inicioStr)} a ${dia(fimStr)}`
      : inicioStr
        ? `de ${dia(inicioStr)} até hoje`
        : `desde o começo até ${dia(fimStr!)}`
    : (PERIODOS_USO.find((p) => p.v === dias)?.label ?? `${dias} dias`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Uso das ferramentas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quantas vezes cada pessoa usou cada uma das {FERRAMENTAS.length} ferramentas.
          Serve pra ver o que a galera mais gosta e onde vale focar. Período:{" "}
          <b className="text-foreground">{label === "Tudo" ? "desde o começo" : label}</b>.
        </p>
      </div>

      <AdminUso linhas={linhas} dias={dias} inicio={inicioStr} fim={fimStr} />
    </div>
  );
}
