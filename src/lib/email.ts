import "server-only";

/**
 * Envio de e-mail transacional via Resend (https://resend.com). Se a chave não
 * estiver configurada, não quebra nada: só loga e devolve false (o fluxo de reset
 * trata isso mostrando a mesma mensagem neutra).
 */

const API_KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.EMAIL_FROM || "Viraliza <nao-responder@viraliza.app.br>";
const APP_URL = (process.env.APP_URL || "https://www.viraliza.app.br").replace(/\/$/, "");
// número do WhatsApp de suporte (só dígitos). Placeholder até o número real entrar.
const WHATSAPP = (process.env.WHATSAPP_SUPORTE || "129999999").replace(/\D/g, "");

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

/** Dispara o e-mail de boas-vindas (compra aprovada) na 1ª compra do cliente.
 *  Nunca quebra o fluxo: só devolve true/false. */
export async function enviarBoasVindas(opts: {
  para: string;
  nome?: string | null;
  produto?: string | null;
}): Promise<boolean> {
  const primeiroNome = (opts.nome || "").trim().split(/\s+/)[0] || "";
  const html = htmlBoasVindas({
    nome: primeiroNome,
    cadastroUrl: `${APP_URL}/cadastro`,
    whatsappUrl: `https://wa.me/55${WHATSAPP}`,
    produto: (opts.produto || "sua compra").trim(),
  });
  return enviarEmail({
    para: opts.para,
    assunto: "Compra aprovada! Bem-vindo ao Viraliza 🎉",
    html,
  });
}

/** Template do e-mail de boas-vindas / compra aprovada. */
export function htmlBoasVindas(p: {
  nome: string;
  cadastroUrl: string;
  whatsappUrl: string;
  produto: string;
}) {
  const ola = p.nome ? `, ${p.nome}` : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0d0b;">
<span style="display:none;opacity:0;color:transparent;height:0;width:0;overflow:hidden">Sua compra foi aprovada. Crie sua conta e comece a gerar videos que vendem.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d0b;padding:28px 12px;">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111815;border:1px solid #1e2a24;border-radius:18px;overflow:hidden;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
   <tr><td style="background:linear-gradient(180deg,rgba(34,197,94,.22),rgba(34,197,94,0));padding:34px 32px 10px;text-align:center;">
     <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:999px;background:#22c55e;color:#04120a;font-size:34px;font-weight:800;box-shadow:0 8px 24px rgba(34,197,94,.35);">&#10003;</div>
     <h1 style="margin:18px 0 4px;color:#eafff3;font-size:24px;">Compra aprovada! &#127881;</h1>
     <p style="margin:0;color:#9fb4a8;font-size:14px;">Seja muito bem-vindo(a) ao <b style="color:#eafff3;">Viraliza</b>${ola}.</p>
   </td></tr>
   <tr><td style="padding:12px 32px 4px;color:#c2d1c9;font-size:15px;line-height:1.65;">
     <p style="margin:14px 0;">Seu pagamento de <b style="color:#eafff3;">${p.produto}</b> foi confirmado. Agora falta 1 passo pra liberar seu acesso: <b style="color:#eafff3;">criar sua conta com este mesmo e-mail</b> (e o e-mail da compra que libera a plataforma).</p>
   </td></tr>
   <tr><td style="padding:8px 32px 6px;text-align:center;">
     <a href="${p.cadastroUrl}" style="display:block;background:#22c55e;color:#04120a;text-decoration:none;font-weight:800;font-size:16px;padding:15px 24px;border-radius:12px;">Criar minha conta agora</a>
   </td></tr>
   <tr><td style="padding:18px 32px 6px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 0;color:#c2d1c9;font-size:14px;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:#1e2a24;color:#22c55e;font-weight:700;margin-right:10px;">1</span> Crie sua conta com <b style="color:#eafff3;">este e-mail</b>.</td></tr>
      <tr><td style="padding:8px 0;color:#c2d1c9;font-size:14px;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:#1e2a24;color:#22c55e;font-weight:700;margin-right:10px;">2</span> Entre no painel: seus créditos e a biblioteca já estão liberados.</td></tr>
      <tr><td style="padding:8px 0;color:#c2d1c9;font-size:14px;"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:999px;background:#1e2a24;color:#22c55e;font-weight:700;margin-right:10px;">3</span> Gere seus vídeos que vendem, no automático. &#128640;</td></tr>
     </table>
   </td></tr>
   <tr><td style="padding:16px 32px 8px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1512;border:1px solid #1e2a24;border-radius:14px;">
      <tr><td style="padding:16px 18px;color:#c2d1c9;font-size:14px;">
        <b style="color:#eafff3;">Precisa de ajuda?</b><br>Fala com a gente no WhatsApp, a gente te ajuda rapidinho.
        <div style="margin-top:12px;">
          <a href="${p.whatsappUrl}" style="display:inline-block;background:#25D366;color:#04120a;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:10px;">Chamar no WhatsApp</a>
        </div>
      </td></tr>
     </table>
   </td></tr>
   <tr><td style="padding:20px 32px 28px;text-align:center;color:#6f8177;font-size:12px;line-height:1.6;">
     Se não foi você que comprou, pode ignorar este e-mail.<br>
     Viraliza &#183; sua fábrica de vídeos que vendem
   </td></tr>
  </table>
 </td></tr>
</table>
</body></html>`;
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
