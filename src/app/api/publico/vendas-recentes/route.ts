import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
// cache curto: a página é pública e a lista muda devagar, então não faz sentido
// bater no banco a cada visita
export const revalidate = 120;

/**
 * Últimas compras REAIS, pras notificações de prova social da página pública.
 *
 * Duas decisões que valem estar escritas:
 *
 * 1. É DADO DE VERDADE, não nome sorteado. Prova social inventada é propaganda
 *    enganosa (CDC art. 37) e, quando alguém percebe, destrói a confiança
 *    justamente na hora de pagar. Como a plataforma já vende todo dia, a lista
 *    verdadeira faz o mesmo efeito sem esse risco.
 *
 * 2. O NOME SAI PICOTADO (primeiro nome + inicial). Cliente não autorizou virar
 *    anúncio: primeiro nome com inicial identifica pra quem já conhece e não
 *    expõe ninguém pra quem não conhece. Nunca sai e-mail, valor nem cidade.
 */

type Venda = { nome: string; oque: string; minutos: number };

const JANELA_DIAS = 21;

/** "Lucas Gomes da Silva" -> "Lucas G." */
function apelidar(nome: string): string {
  const partes = (nome || "")
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1); // tira "de", "da", "e"
  const primeiro = partes[0] || "";
  if (!primeiro) return "";
  const sobre = partes[1] ? `${partes[1][0].toUpperCase()}.` : "";
  const cap = primeiro[0].toUpperCase() + primeiro.slice(1).toLowerCase();
  return sobre ? `${cap} ${sobre}` : cap;
}

export async function GET() {
  try {
    const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000);
    const linhas = await prisma.creditoTransacao.findMany({
      where: {
        criadoEm: { gte: desde },
        tipo: { in: ["compra", "bonus_assinatura"] },
      },
      orderBy: { criadoEm: "desc" },
      take: 40,
      select: {
        tipo: true,
        criadoEm: true,
        user: { select: { nome: true } },
      },
    });

    const agora = Date.now();
    const vendas: Venda[] = [];
    for (const l of linhas) {
      const nome = apelidar(l.user?.nome ?? "");
      if (!nome) continue;
      vendas.push({
        nome,
        oque: l.tipo === "compra" ? "comprou créditos" : "assinou o Viraliza",
        minutos: Math.max(1, Math.round((agora - l.criadoEm.getTime()) / 60_000)),
      });
    }

    return NextResponse.json({ vendas });
  } catch (e) {
    console.error("[publico] falha ao listar vendas recentes", e);
    // a tela some com as notificações em vez de mostrar erro: é enfeite, não pode
    // atrapalhar quem está pagando
    return NextResponse.json({ vendas: [] });
  }
}
