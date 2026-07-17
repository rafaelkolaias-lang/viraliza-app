import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleConfigurado, urlAutorizacao } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");

/** Início do login com Google: guarda um state anti-CSRF e manda pra tela do Google. */
export async function GET() {
  if (!googleConfigurado()) {
    return NextResponse.redirect(new URL("/login?erro=google_off", BASE));
  }
  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set("g_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  });
  return NextResponse.redirect(urlAutorizacao(state));
}
