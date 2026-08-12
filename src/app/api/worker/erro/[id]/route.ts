import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { workerAutorizado } from "@/lib/worker-auth";
import { notificarJobErro } from "@/lib/notificacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PADRAO = "Falha no render";

/**
 * Tira a mensagem de erro do corpo da requisição, venha ela como for.
 *
 * O corpo só pode ser lido UMA vez: tentar `formData()` primeiro e depois cair
 * pro `json()` quebrava, porque a primeira tentativa já tinha consumido a
 * stream, e o erro detalhado do worker virava o "Falha no render" genérico. Por
 * isso o tipo do conteúdo é quem decide, e o resto lê o texto cru.
 */
async function lerErro(req: Request): Promise<string> {
  const tipo = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (tipo.includes("multipart/form-data")) {
      const form = await req.formData();
      return String(form.get("erro") || PADRAO).trim() || PADRAO;
    }
    if (tipo.includes("application/json")) {
      const j = (await req.json()) as { erro?: unknown };
      return String(j?.erro ?? PADRAO).trim() || PADRAO;
    }
    // form-urlencoded (como os dois workers mandam) e qualquer outra coisa: o
    // texto cru serve de mensagem quando não houver o campo "erro"
    const cru = (await req.text()).trim();
    if (!cru) return PADRAO;
    const campo = new URLSearchParams(cru).get("erro");
    return (campo || cru).trim() || PADRAO;
  } catch {
    return PADRAO;
  }
}

/** Worker falhou ao renderizar: marca o job como "erro" com a mensagem. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!workerAutorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const mensagem = await lerErro(req);

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ erro: "job não existe" }, { status: 404 });

  // Excluído durante a geração (auditoria #28): quem apagou o card não pode vê-lo
  // voltar como "erro" (a exclusão apaga a mídia de entrada, então o render
  // falhar depois disso é o esperado). Condicional no where cobre a corrida.
  if (job.status === "excluido") {
    return NextResponse.json({ ok: true, ignorado: "excluido" });
  }

  const r = await prisma.job.updateMany({
    where: { id, status: { not: "excluido" } },
    data: {
      status: "erro",
      // campo é @db.Text; guardamos o erro detalhado (voz/cota/etc) sem cortar cedo
      erro: mensagem.slice(0, 4000),
      etapa: null,
    },
  });
  if (r.count > 0) await notificarJobErro(job).catch(() => {});

  return NextResponse.json({ ok: true });
}
