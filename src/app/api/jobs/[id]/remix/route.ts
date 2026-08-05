import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { normalizarVolumes } from "@/lib/montagem";

export const runtime = "nodejs";

/**
 * REAJUSTAR ÁUDIO de um vídeo que já ficou pronto.
 *
 * O render guarda as faixas de áudio separadas (som do vídeo, música e narração).
 * Aqui a gente só pede pro robô misturar de novo nos volumes novos: a imagem é
 * copiada como está, então leva segundos, NÃO renderiza nada de novo e NÃO cobra
 * crédito (o débito do job é idempotente e já aconteceu no render).
 *
 * O vídeo é substituído no lugar: mesma linha na lista, sem duplicar nada.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ erro: "Não encontrado." }, { status: 404 });
  if (job.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ erro: "Sem permissão." }, { status: 403 });
  }
  if (job.status !== "pronto") {
    return NextResponse.json(
      { erro: "Espere o vídeo ficar pronto pra ajustar o áudio." },
      { status: 409 },
    );
  }

  let opcoes: Record<string, unknown> = {};
  try {
    const o = JSON.parse(job.opcoes ?? "{}");
    if (o && typeof o === "object") opcoes = o as Record<string, unknown>;
  } catch {}

  const stems = opcoes.stems as { orig?: string; musica?: string; voz?: string } | undefined;
  if (!stems || !(stems.orig || stems.musica || stems.voz)) {
    return NextResponse.json(
      {
        erro: "Esse vídeo é de antes do reajuste de áudio, então as faixas separadas não existem. Vale pros vídeos novos.",
      },
      { status: 400 },
    );
  }

  let corpo: unknown = null;
  try {
    corpo = await req.json();
  } catch {}
  const volumes = normalizarVolumes(corpo);

  const saidas = (() => {
    try {
      const s = JSON.parse(job.saidas ?? "[]");
      return Array.isArray(s) ? (s as string[]) : [];
    } catch {
      return [];
    }
  })();
  const video = saidas.find((s) => typeof s === "string" && s.startsWith("http"));
  if (!video) {
    return NextResponse.json(
      { erro: "Não achei o arquivo desse vídeo pra refazer o áudio." },
      { status: 400 },
    );
  }

  // volta pra fila com o pedido de reajuste; o worker vê `remix` e faz só o áudio
  await prisma.job.update({
    where: { id },
    data: {
      status: "na_fila",
      etapa: "Refazendo o áudio",
      erro: null,
      opcoes: JSON.stringify({ ...opcoes, remix: { video, volumes } }),
    },
  });

  return NextResponse.json({ ok: true });
}
