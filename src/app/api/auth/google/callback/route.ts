import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { googleConfigurado, trocarCodigoPorUsuario } from "@/lib/google";
import { criarContaLiberada, podeCriarConta } from "@/lib/registro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");
const paraLogin = (erro: string) => NextResponse.redirect(new URL(`/login?erro=${erro}`, BASE));

/**
 * Volta do Google. Confere o state (anti-CSRF), troca o code pelos dados, aplica a
 * MESMA trava (só quem comprou cria conta) e abre a sessão. Vincula ao e-mail se a
 * pessoa já tinha conta com senha.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const esperado = jar.get("g_state")?.value;
  jar.delete("g_state");

  if (!googleConfigurado()) return paraLogin("google_off");
  if (url.searchParams.get("error")) return paraLogin("google_cancelado");
  if (!code || !state || !esperado || state !== esperado) return paraLogin("google_estado");

  const g = await trocarCodigoPorUsuario(code);
  if (!g || !g.emailVerificado) return paraLogin("google_falha");

  // acha pela conta Google; senão pelo e-mail (vincula conta existente que tinha senha)
  let user =
    (await prisma.user.findUnique({ where: { googleId: g.sub } })) ??
    (await prisma.user.findUnique({ where: { email: g.email } }));

  if (user) {
    if (user.bloqueado) return paraLogin("suspenso");
    if (!user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: g.sub } });
    }
  } else {
    // conta nova via Google -> trava anti-farm (só quem comprou)
    if (!(await podeCriarConta(g.email))) return paraLogin("sem_compra");
    user = await criarContaLiberada({ nome: g.nome, email: g.email, googleId: g.sub });
  }

  await createSession(user.id, user.role);
  // mesmo destino do login por senha: o Lab, não a lista de vídeos vazia
  return NextResponse.redirect(new URL("/painel/lab", BASE));
}
