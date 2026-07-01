import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { decifrar } from "@/lib/cripto";
import { listarVozesDaChave } from "@/lib/eleven";
import { VOZES } from "@/lib/vozes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista as vozes pro seletor do Estúdio.
//  - usuário com chave própria (BYO): busca ao vivo as vozes DA CONTA DELE
//  - senão: a lista curada da plataforma
export async function GET() {
  const user = await getCurrentUser();
  if (user) {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: { elevenKey: true },
    });
    if (u?.elevenKey) {
      try {
        const vozes = await listarVozesDaChave(decifrar(u.elevenKey));
        if (vozes.length) {
          return NextResponse.json({ vozes, fonte: "usuario" });
        }
      } catch {
        // chave morta/instável -> cai na lista curada
      }
    }
  }
  return NextResponse.json({ vozes: VOZES, fonte: "curada" });
}
