import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { minhasIndicacoes, rankingAfiliados } from "@/lib/afiliados";
import { IndiqueGanhe } from "@/components/app/indique-ganhe";

export const metadata: Metadata = { title: "Indique e Ganhe" };
export const dynamic = "force-dynamic";

/**
 * Indique e Ganhe: quem quiser vira afiliado do Viraliza na Cakto e leva 50% de
 * cada venda que trouxer. O ranking vem dos pedidos da Cakto (é lá que mora a
 * comissão de cada venda), com cache de alguns minutos dentro do rankingAfiliados.
 */
export default async function IndiquePage() {
  const user = await requireUser();
  // as duas consultas caem na mesma listagem da Cakto, que fica em cache
  const [ranking, minha] = await Promise.all([
    rankingAfiliados(30, 10),
    minhasIndicacoes(user.email ?? ""),
  ]);
  return <IndiqueGanhe ranking={ranking} minha={minha} />;
}
