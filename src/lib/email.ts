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

/** Dispara o e-mail de "créditos adicionados" (compra de pacote por quem já tem
 *  conta). Vai TODA vez que um cliente existente compra crédito. Nunca quebra. */
export async function enviarCreditosConfirmados(opts: {
  para: string;
  nome?: string | null;
  creditos: number; // nº de créditos comprados (1 crédito = R$ 0,01)
  saldoApos: number; // saldo total depois da compra (em créditos)
  produto?: string | null;
}): Promise<boolean> {
  const primeiroNome = (opts.nome || "").trim().split(/\s+/)[0] || "";
  const html = htmlCreditosConfirmados({
    nome: primeiroNome,
    creditos: Math.round(opts.creditos).toLocaleString("pt-BR"),
    saldo: Math.round(opts.saldoApos).toLocaleString("pt-BR"),
    painelUrl: `${APP_URL}/painel/creditos`,
    whatsappUrl: `https://wa.me/55${WHATSAPP}`,
    produto: (opts.produto || "pacote de créditos").trim(),
  });
  return enviarEmail({
    para: opts.para,
    assunto: `Seus ${Math.round(opts.creditos).toLocaleString("pt-BR")} créditos já entraram! 🎉`,
    html,
  });
}

/** Template do e-mail de créditos adicionados (cliente que já tem conta). */
export function htmlCreditosConfirmados(p: {
  nome: string;
  creditos: string;
  saldo: string;
  painelUrl: string;
  whatsappUrl: string;
  produto: string;
}) {
  const ola = p.nome ? ` ${p.nome},` : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0d0b;">
<span style="display:none;opacity:0;color:transparent;height:0;width:0;overflow:hidden">Seus creditos foram adicionados. Bora gerar mais videos.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d0b;padding:28px 12px;">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111815;border:1px solid #1e2a24;border-radius:18px;overflow:hidden;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
   <tr><td style="background:linear-gradient(180deg,rgba(34,197,94,.22),rgba(34,197,94,0));padding:34px 32px 8px;text-align:center;">
     <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:999px;background:#22c55e;color:#04120a;font-size:32px;font-weight:800;box-shadow:0 8px 24px rgba(34,197,94,.35);">&#9889;</div>
     <h1 style="margin:16px 0 4px;color:#eafff3;font-size:24px;">Créditos adicionados!</h1>
     <p style="margin:0;color:#9fb4a8;font-size:14px;">Valeu pela compra${ola} tá tudo certo. &#128640;</p>
   </td></tr>
   <tr><td style="padding:10px 32px 4px;color:#c2d1c9;font-size:15px;line-height:1.65;">
     <p style="margin:12px 0;">Sua compra de <b style="color:#eafff3;">${p.produto}</b> foi confirmada e os créditos já estão na sua conta, prontos pra usar.</p>
   </td></tr>
   <tr><td style="padding:6px 32px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1512;border:1px solid #22c55e33;border-radius:14px;">
       <tr>
         <td width="50%" style="padding:16px;text-align:center;border-right:1px solid #1e2a24;">
           <div style="color:#22c55e;font-size:22px;font-weight:800;">+${p.creditos}</div>
           <div style="color:#8a978f;font-size:12px;">créditos comprados</div>
         </td>
         <td width="50%" style="padding:16px;text-align:center;">
           <div style="color:#eafff3;font-size:22px;font-weight:800;">${p.saldo}</div>
           <div style="color:#8a978f;font-size:12px;">saldo total agora</div>
         </td>
       </tr>
     </table>
   </td></tr>
   <tr><td style="padding:16px 32px 6px;text-align:center;">
     <a href="${p.painelUrl}" style="display:block;background:#22c55e;color:#04120a;text-decoration:none;font-weight:800;font-size:16px;padding:15px 24px;border-radius:12px;">Ir pro meu painel</a>
   </td></tr>
   <tr><td style="padding:14px 32px 8px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1512;border:1px solid #1e2a24;border-radius:14px;">
      <tr><td style="padding:16px 18px;color:#c2d1c9;font-size:14px;">
        <b style="color:#eafff3;">Alguma dúvida?</b><br>Fala com a gente no WhatsApp.
        <div style="margin-top:12px;">
          <a href="${p.whatsappUrl}" style="display:inline-block;background:#25D366;color:#04120a;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:10px;">Chamar no WhatsApp</a>
        </div>
      </td></tr>
     </table>
   </td></tr>
   <tr><td style="padding:20px 32px 28px;text-align:center;color:#6f8177;font-size:12px;line-height:1.6;">
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

/**
 * Avisa que a assinatura vence em poucos dias.
 *
 * Serve pros dois casos, e o texto muda conforme: quem tem renovação ligada
 * recebe um lembrete tranquilo ("vai renovar sozinho, deixe o cartão em dia"),
 * e quem cancelou recebe um aviso de que vai perder o acesso. Mandar o texto
 * errado pro caso errado é o tipo de coisa que gera contestação de cobrança.
 */
export async function enviarAssinaturaVencendo(opts: {
  para: string;
  nome?: string | null;
  dias: number;
  venceEm: string; // já formatado em pt-BR
  valorReais: number;
  /** true = a cobrança automática segue ligada; false = a pessoa cancelou */
  renovaSozinho: boolean;
  /** true = pagou no Pix, então não existe cobrança automática: tem que renovar */
  pix?: boolean;
}): Promise<boolean> {
  const primeiroNome = (opts.nome || "").trim().split(/\s+/)[0] || "";
  const quando =
    opts.dias <= 0 ? "hoje" : opts.dias === 1 ? "amanhã" : `em ${opts.dias} dias`;
  return enviarEmail({
    para: opts.para,
    assunto: opts.renovaSozinho
      ? `Sua assinatura do Viraliza renova ${quando}`
      : opts.pix
        ? `Hora de renovar seu Viraliza (vence ${quando})`
        : `Seu acesso ao Viraliza acaba ${quando}`,
    html: htmlAssinaturaVencendo({
      nome: primeiroNome,
      quando,
      venceEm: opts.venceEm,
      valor: opts.valorReais.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      renovaSozinho: opts.renovaSozinho,
      pix: !!opts.pix,
      assinaturaUrl: `${APP_URL}/painel/assinatura`,
      whatsappUrl: `https://wa.me/55${WHATSAPP}`,
    }),
  });
}

/** Template do aviso de vencimento da assinatura. */
export function htmlAssinaturaVencendo(p: {
  nome: string;
  quando: string;
  venceEm: string;
  valor: string;
  renovaSozinho: boolean;
  /** pagou no Pix: não existe cobrança automática, a renovação é na mão */
  pix?: boolean;
  assinaturaUrl: string;
  whatsappUrl: string;
}) {
  const ola = p.nome ? `, ${p.nome}` : "";
  const titulo = p.renovaSozinho
    ? "Sua assinatura renova em breve"
    : p.pix
      ? "Hora de renovar seu acesso"
      : "Seu acesso está acabando";
  const cor = p.renovaSozinho ? "#22c55e" : "#f59e0b";
  const chamada = p.renovaSozinho
    ? "Ver minha assinatura"
    : p.pix
      ? "Renovar no Pix ou no cartão"
      : "Reativar minha assinatura";
  const corpo = p.renovaSozinho
    ? `Sua assinatura do Viraliza renova <b style="color:#eafff3;">${p.quando}</b> (em ${p.venceEm}), no valor de <b style="color:#eafff3;">${p.valor}</b>.
       Não precisa fazer nada: a cobrança acontece sozinha no seu cartão e seu acesso continua sem interrupção.
       Só vale conferir se o cartão está em dia, porque cartão vencido é o motivo número um de assinatura cair.`
    : p.pix
      ? `Seu acesso ao Viraliza vai até <b style="color:#eafff3;">${p.venceEm}</b>, ou seja, acaba <b style="color:#eafff3;">${p.quando}</b>.
       Como você pagou no Pix, não existe cobrança automática: ninguém tira nada da sua conta sem você mandar,
       e por isso a renovação depende de você. São <b style="color:#eafff3;">${p.valor}</b> por mais um mês, com
       4.000 créditos novos caindo na hora. Dá pra renovar no Pix de novo ou colocar um cartão, que aí renova sozinho.`
      : `Seu acesso ao Viraliza vai até <b style="color:#eafff3;">${p.venceEm}</b>, ou seja, acaba <b style="color:#eafff3;">${p.quando}</b>.
       Como a renovação está cancelada, depois dessa data a biblioteca e o brinde mensal de créditos param.
       Seus créditos que já estão na conta continuam seus.`;
  const nota = p.renovaSozinho
    ? "Quer cancelar? Dá pra fazer em dois cliques no painel, sem multa e sem falar com ninguém."
    : p.pix
      ? "O QR do Pix aparece na hora no painel, e o acesso libera assim que o pagamento cai."
      : "Mudou de ideia? É só reativar no painel que o acesso volta na hora.";

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0d0b;">
<span style="display:none;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${titulo}: vence em ${p.venceEm}.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d0b;padding:28px 12px;">
 <tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111815;border:1px solid #1e2a24;border-radius:18px;overflow:hidden;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
   <tr><td style="padding:34px 32px 10px;text-align:center;">
     <div style="display:inline-block;width:64px;height:64px;line-height:64px;border-radius:999px;background:${cor};color:#04120a;font-size:32px;font-weight:800;">&#9200;</div>
     <h1 style="margin:18px 0 4px;color:#eafff3;font-size:23px;">${titulo}</h1>
     <p style="margin:0;color:#9fb4a8;font-size:14px;">Oi${ola}, passando pra te avisar com antecedência.</p>
   </td></tr>
   <tr><td style="padding:12px 32px 4px;color:#c2d1c9;font-size:15px;line-height:1.65;">
     <p style="margin:14px 0;">${corpo}</p>
   </td></tr>
   <tr><td style="padding:8px 32px 6px;text-align:center;">
     <a href="${p.assinaturaUrl}" style="display:block;background:${cor};color:#04120a;text-decoration:none;font-weight:800;font-size:16px;padding:15px 24px;border-radius:12px;">${chamada}</a>
   </td></tr>
   <tr><td style="padding:16px 32px 8px;">
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e1512;border:1px solid #1e2a24;border-radius:14px;">
      <tr><td style="padding:16px 18px;color:#c2d1c9;font-size:14px;">
        ${nota}
        <div style="margin-top:12px;">
          <a href="${p.whatsappUrl}" style="display:inline-block;background:#25D366;color:#04120a;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:10px;">Falar no WhatsApp</a>
        </div>
      </td></tr>
     </table>
   </td></tr>
   <tr><td style="padding:20px 32px 28px;text-align:center;color:#6f8177;font-size:12px;line-height:1.6;">
     Viraliza &#183; sua fábrica de vídeos que vendem
   </td></tr>
  </table>
 </td></tr>
</table>
</body></html>`;
}
