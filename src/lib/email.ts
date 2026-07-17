import "server-only";

/**
 * Envio de e-mail transacional via Resend (https://resend.com). Se a chave não
 * estiver configurada, não quebra nada: só loga e devolve false (o fluxo de reset
 * trata isso mostrando a mesma mensagem neutra).
 */

const API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.EMAIL_FROM || "Viraliza <nao-responder@viraliza.app.br>";

export function emailConfigurado() {
  return !!API_KEY;
}

export async function enviarEmail(opts: {
  para: string;
  assunto: string;
  html: string;
}): Promise<boolean> {
  if (!API_KEY) {
    console.warn("[email] RESEND_API_KEY não configurado; e-mail não enviado");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [opts.para],
        subject: opts.assunto,
        html: opts.html,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[email] Resend falhou", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] erro ao enviar", e);
    return false;
  }
}

/** Template do e-mail de redefinição de senha (verde do Viraliza, sem travessão). */
export function htmlResetSenha(link: string) {
  return `
  <div style="background:#0b0f0d;padding:32px 16px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#121815;border:1px solid #1f2a24;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(180deg,rgba(34,197,94,.18),transparent);padding:28px 28px 8px;text-align:center">
        <h1 style="margin:0;color:#e8f5ee;font-size:20px">Redefinir sua senha</h1>
      </div>
      <div style="padding:8px 28px 28px;color:#b7c4bd;font-size:14px;line-height:1.6">
        <p>Você pediu pra redefinir a senha da sua conta no <b style="color:#e8f5ee">Viraliza</b>. Clique no botão abaixo pra criar uma nova senha. O link vale por 30 minutos.</p>
        <p style="text-align:center;margin:26px 0">
          <a href="${link}" style="display:inline-block;background:#22c55e;color:#04120a;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:10px">Criar nova senha</a>
        </p>
        <p style="color:#8a978f;font-size:12px">Se não foi você que pediu, pode ignorar este e-mail: sua senha continua a mesma.</p>
      </div>
    </div>
  </div>`;
}
