import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { getCarteira } from "@/lib/creditos";
import { prisma } from "@/lib/prisma";
import { AssinaturaPainel } from "@/components/app/assinatura-painel";
import { LinksLegais } from "@/components/legal/links-legais";

export const metadata: Metadata = { title: "Assinatura" };
export const dynamic = "force-dynamic";

const DIA_MS = 86_400_000;

/** Formata uma data no fuso de Brasília (feito no servidor pra não dar hydration
 *  mismatch quando o componente renderiza a string pronta). */
const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default async function AssinaturaPage() {
  const user = await requireUser();
  const carteira = await getCarteira(user.id);

  const [conta, ultimaRenovacao] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { criadoEm: true } }),
    // última entrada de crédito da assinatura = última renovação paga (ou o 1º mês)
    prisma.creditoTransacao.findFirst({
      where: { userId: user.id, tipo: "bonus_assinatura" },
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true },
    }),
  ]);

  const agora = Date.now();
  const venceMs = carteira.assinaturaAte?.getTime() ?? null;
  const permanente = carteira.assinante && venceMs === null; // admin/concessão sem data
  const ativa = carteira.assinante && (venceMs === null || venceMs > agora);
  const diasRestantes =
    venceMs !== null ? Math.ceil((venceMs - agora) / DIA_MS) : null;

  // link de checkout da entrada/assinatura (env, editável no EasyPanel sem deploy).
  const linkAssinatura = process.env.CAKTO_CHECKOUT_ASSINATURA || null;
  const url =
    linkAssinatura && user.email
      ? `${linkAssinatura}${linkAssinatura.includes("?") ? "&" : "?"}email=${encodeURIComponent(user.email)}`
      : linkAssinatura;

  return (
    <div className="space-y-5">
      <AssinaturaPainel
        ativa={ativa}
        permanente={permanente}
        diasRestantes={diasRestantes}
        venceEm={carteira.assinaturaAte ? fmtData.format(carteira.assinaturaAte) : null}
        membroDesde={conta?.criadoEm ? fmtData.format(conta.criadoEm) : null}
        renovadaEm={ultimaRenovacao?.criadoEm ? fmtData.format(ultimaRenovacao.criadoEm) : null}
        urlAssinatura={url}
      />
      {/* assinatura é cobrança recorrente: os documentos precisam estar
          alcançáveis ANTES de a pessoa contratar, não só depois */}
      <LinksLegais
        aviso="Ao assinar, você concorda com os documentos abaixo."
        className="text-center"
      />
    </div>
  );
}
