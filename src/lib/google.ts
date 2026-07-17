import "server-only";

/**
 * Login com Google (OAuth2). O id_token vem DIRETO do endpoint de token do Google
 * (servidor a servidor, via TLS + nosso client_secret), então dá pra confiar no
 * conteudo sem verificar a assinatura - conforme a doc do Google.
 */

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_URL = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");
const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

export function googleConfigurado() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

/** URL da tela de permissão do Google (com state anti-CSRF). */
export function urlAutorizacao(state: string) {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export type UsuarioGoogle = {
  sub: string; // id único e estável do Google
  email: string;
  emailVerificado: boolean;
  nome: string;
};

/** Troca o code pelo id_token e devolve os dados do usuário. null se falhar. */
export async function trocarCodigoPorUsuario(code: string): Promise<UsuarioGoogle | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) return null;

  const p = decodificarPayload(data.id_token);
  if (!p || !p.sub || !p.email) return null;
  return {
    sub: String(p.sub),
    email: String(p.email).toLowerCase(),
    emailVerificado: p.email_verified === true || p.email_verified === "true",
    nome: String(p.name || p.email),
  };
}

/** Decodifica o payload do JWT (sem verificar assinatura - veio direto do Google). */
function decodificarPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parte = jwt.split(".")[1];
    const json = Buffer.from(
      parte.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}
