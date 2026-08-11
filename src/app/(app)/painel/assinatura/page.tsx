import type { Metadata } from "next";
import { requireUser } from "@/lib/dal";
import { getCarteira } from "@/lib/creditos";
import { prisma } from "@/lib/prisma";
import { AssinaturaPainel } from "@/components/app/assinatura-painel";

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
    prisma.user.findUnique({
      where: { id: user.id },
      select: { criadoEm: true, mpAssinaturaId: true },
    }),
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

  // Qual checkout a assinatura usa é decidido por ENV, sem deploy:
  // CAKTO_CHECKOUT_ASSINATURA preenchido manda pra Cakto, que é onde a LP e o
  // bot do WhatsApp vendem; vazio cai no Mercado Pago. A Cakto TEM prioridade
  // porque, quando as duas estão ligadas, o preço anunciado lá fora é o dela e
  // ver outro valor aqui dentro faria a pessoa desistir.
  const urlCakto = (process.env.CAKTO_CHECKOUT_ASSINATURA || "").trim() || null;

  return (
    <AssinaturaPainel
      ativa={ativa}
      permanente={permanente}
      diasRestantes={diasRestantes}
      venceEm={carteira.assinaturaAte ? fmtData.format(carteira.assinaturaAte) : null}
      membroDesde={conta?.criadoEm ? fmtData.format(conta.criadoEm) : null}
      renovadaEm={ultimaRenovacao?.criadoEm ? fmtData.format(ultimaRenovacao.criadoEm) : null}
      urlAssinatura={urlCakto}
      mpPublicKey={
        // a public key tem que ser da MESMA aplicação do token de assinatura,
        // senão o MP não acha o cartão tokenizado ("Card token service not found")
        !urlCakto && process.env.MP_ACCESS_TOKEN
          ? process.env.MP_ASSINATURA_PUBLIC_KEY || process.env.MP_PUBLIC_KEY
          : undefined
      }
      valorMensal={parseFloat(process.env.MP_ASSINATURA_REAIS || "98.90")}
      podeCancelar={!!conta?.mpAssinaturaId}
      // acesso ativo que NÃO nasceu no Mercado Pago = cliente antigo (Cakto ou
      // concessão permanente). Não oferecemos assinatura pra ele: seria cobrar
      // de novo por algo que ele já tem.
      acessoAntigo={ativa && !conta?.mpAssinaturaId}
    />
  );
}
