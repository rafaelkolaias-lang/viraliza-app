import { NextResponse } from "next/server";
import { enviarEmail } from "@/lib/email";
import { dentroDoLimite, ipDaRequisicao } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recebe o lead (nome + WhatsApp) que a pessoa digita no INÍCIO do funil e manda
 * pro e-mail do dono. O funil é um site estático em OUTRO domínio, então aqui tem
 * CORS liberado só pros nossos domínios + validação no servidor + anti-flood.
 */
const ORIGENS = new Set([
  "https://site.viraliza.app.br",
  "https://www.viraliza.app.br",
  "https://viraliza.app.br",
]);

function cabecalhosCors(origin: string | null) {
  const permitida = origin && ORIGENS.has(origin) ? origin : "https://site.viraliza.app.br";
  return {
    "access-control-allow-origin": permitida,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: cabecalhosCors(req.headers.get("origin")),
  });
}

function formatarTelefone(d: string) {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

function escapar(s: string) {
  return s.replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c,
  );
}

export async function POST(req: Request) {
  const headers = cabecalhosCors(req.headers.get("origin"));

  // anti-flood: no máximo 5 leads por IP a cada 10 minutos
  const ip = await ipDaRequisicao();
  if (!(await dentroDoLimite(`lead:${ip}`, 5, 600))) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Tente mais tarde." },
      { status: 429, headers },
    );
  }

  let nome = "";
  let whatsapp = "";
  try {
    const b = (await req.json()) as { nome?: unknown; whatsapp?: unknown };
    nome = String(b.nome ?? "").trim().slice(0, 80);
    whatsapp = String(b.whatsapp ?? "").replace(/\D/g, "").slice(0, 13);
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400, headers });
  }

  // validação no SERVIDOR (nunca confiar no que vem do front)
  const letras = (nome.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  if (letras < 3 || whatsapp.length < 10 || whatsapp.length > 13) {
    return NextResponse.json({ erro: "Nome ou WhatsApp inválido." }, { status: 400, headers });
  }

  const destino = (process.env.LEAD_EMAIL || "").trim();
  if (!destino) {
    console.warn("[lead] LEAD_EMAIL não configurado; lead não enviado:", nome);
    return NextResponse.json({ ok: true }, { headers }); // não expõe config pro front
  }

  const tel = formatarTelefone(whatsapp);
  const wa = `https://wa.me/55${whatsapp}`;
  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  await enviarEmail({
    para: destino,
    assunto: `Novo lead do funil: ${nome} - ${tel}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0f14;padding:24px;">
        <div style="max-width:520px;margin:0 auto;background:#111820;border:1px solid #1e2a36;border-radius:14px;padding:24px;">
          <p style="margin:0 0 4px;color:#22c55e;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Novo lead do funil</p>
          <h1 style="margin:0 0 16px;color:#fff;font-size:22px;">${escapar(nome)}</h1>
          <table style="width:100%;border-collapse:collapse;color:#cbd5e1;font-size:14px;">
            <tr><td style="padding:8px 0;color:#94a3b8;">WhatsApp</td><td style="padding:8px 0;text-align:right;color:#fff;font-weight:700;">${tel}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;">Quando</td><td style="padding:8px 0;text-align:right;">${quando}</td></tr>
          </table>
          <a href="${wa}" style="display:inline-block;margin-top:18px;background:#25D366;color:#04120a;text-decoration:none;font-weight:800;font-size:14px;padding:12px 22px;border-radius:10px;">Chamar no WhatsApp</a>
          <p style="margin:18px 0 0;color:#64748b;font-size:12px;">Preencheu o formulário no início do funil (site.viraliza.app.br).</p>
        </div>
      </div>
    `,
  }).catch(() => {});

  return NextResponse.json({ ok: true }, { headers });
}
