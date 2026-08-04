import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { listarAvatares } from "@/lib/avatares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista os influenciadores da pessoa. Usado pela galeria pra se atualizar
 * sozinha enquanto uma criação longa roda (a pessoa saiu da tela no meio e o
 * avatar entra na lista quando fica pronto).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  return NextResponse.json({ avatares: await listarAvatares(user.id) });
}
