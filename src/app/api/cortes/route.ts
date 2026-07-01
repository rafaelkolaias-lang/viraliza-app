import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { temSaldo } from "@/lib/creditos";

export const runtime = "nodejs";

/**
 * Cria um job de "Cortes de qualquer vídeo": recebe um link (YouTube por ora) +
 * opções de legenda. O worker baixa, corta e (se pedido) legenda.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }
  const ehDemo = user.role === "demo";

  // Demo PODE experimentar - mas só 1 geração por vez (o reset libera de novo).
  if (ehDemo) {
    const jaTem = await prisma.job.count({
      where: { userId: user.id, tipo: "cortes" },
    });
    if (jaTem > 0) {
      return NextResponse.json(
        {
          erro:
            "No modo demo você gera 1 vídeo pra testar. Apague o anterior (ou peça um reset) pra gerar outro. 🙂",
        },
        { status: 403 },
      );
    }
  }

  // Trava de crédito: produção exige crédito (admin passa; demo tratado acima).
  if (user.role !== "admin" && !ehDemo && !(await temSaldo(user.id))) {
    return NextResponse.json(
      {
        erro: "Você precisa de créditos pra gerar. Compre na aba Créditos.",
        semCredito: true,
      },
      { status: 402 },
    );
  }

  // Limite de vídeos simultâneos em produção (mesma proteção do editor).
  if (user.role !== "admin" && !ehDemo) {
    const pendentes = await prisma.job.count({
      where: {
        userId: user.id,
        status: { in: ["na_fila", "renderizando", "processando"] },
      },
    });
    if (pendentes >= 3) {
      return NextResponse.json(
        {
          erro: "Você já tem 3 vídeos em produção. Espere terminarem pra gerar mais.",
        },
        { status: 429 },
      );
    }
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const link = String(body.link ?? "").trim();

  if (!/^https?:\/\/.+/i.test(link)) {
    return NextResponse.json({ erro: "Cole um link válido." }, { status: 400 });
  }
  // por enquanto só YouTube (Instagram/TikTok em breve)
  if (!/(youtube\.com|youtu\.be)/i.test(link)) {
    return NextResponse.json(
      { erro: "Por enquanto só YouTube. Instagram e TikTok chegam em breve." },
      { status: 400 },
    );
  }

  const cores = ["amarelo", "branco", "verde"];
  const posicoes = ["cima", "meio", "baixo"];
  const duracoes = [30, 60, 90]; // 30s, 1min, 1:30 (0 = livre)
  const durPedida = Number(body.dur);
  const opcoes = {
    legenda: Boolean(body.legenda),
    cor: cores.includes(String(body.cor)) ? String(body.cor) : "amarelo",
    pos: posicoes.includes(String(body.pos)) ? String(body.pos) : "baixo",
    // Demo: trava em 2 cortes de 30s (qualquer link do YouTube)
    dur: ehDemo ? 30 : duracoes.includes(durPedida) ? durPedida : 0,
    max: ehDemo ? 2 : Math.max(1, Math.min(12, Number(body.max) || 8)),
  };

  const job = await prisma.job.create({
    data: {
      userId: user.id,
      tipo: "cortes",
      produto: "Cortes de vídeo",
      fonte: link,
      opcoes: JSON.stringify(opcoes),
      formato: "legenda",
      status: "na_fila",
    },
  });

  return NextResponse.json({ ok: true, id: job.id });
}
