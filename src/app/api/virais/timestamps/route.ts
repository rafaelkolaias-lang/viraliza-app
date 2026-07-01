import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { getViraisTimestamps } from "@/lib/virais";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Datas (ISO) de todos os vídeos virais. O menu consulta de tempos em tempos
 * pra acender a bolinha de "tem vídeo novo" sem precisar atualizar a página.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ timestamps: [] });

  const timestamps = await getViraisTimestamps();
  return NextResponse.json({ timestamps });
}
