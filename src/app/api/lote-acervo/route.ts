import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, ferramentasLiberadas } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";
import { travaDeGeracao } from "@/lib/niveis";
import { MEDIA_BASE } from "@/lib/midia-shopee";
import { CREDITOS_FIXO } from "@/lib/precos";

export const runtime = "nodejs";

// teto por lote (não floodar a fila) e por arquivo (defesa de disco).
const MAX_LOTE = 12;
const MAX_ARQUIVO = 300 * 1024 * 1024; // 300MB
const CUSTO = CREDITOS_FIXO.lote; // 50 créditos por vídeo carimbado

const POS_MARCA = new Set([
  "cima-esq", "cima-meio", "cima-dir",
  "meio-esq", "meio-meio", "meio-dir",
  "baixo-esq", "baixo-meio", "baixo-dir",
]);

function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo";
}

/**
 * Anti-SSRF: a fonte tem que ser um vídeo do NOSSO serverrk. Precisa ser exatamente
 * a origem de MEDIA_BASE e um caminho /virais/<id>.mp4 (acervo Shopee) ou
 * /gerados/<id>.mp4 (vídeo que o próprio usuário já gerou). Nunca confiar no front.
 */
function fonteValida(url: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(MEDIA_BASE);
    if (u.origin !== base.origin) return false;
    return /^\/(virais|gerados)\/[\w.-]+\.mp4$/i.test(u.pathname);
  } catch {
    return false;
  }
}

type Fonte = { url: string; nome: string };

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }

  if (user.role !== "admin" && !(await ferramentasLiberadas(user.id))) {
    return NextResponse.json(
      { erro: "Seu acesso às ferramentas foi suspenso pelo administrador." },
      { status: 403 },
    );
  }

  const form = await req.formData();

  const template = form.getAll("template").filter((f): f is File => f instanceof File)[0];
  if (!template) {
    return NextResponse.json({ erro: "Envie sua logo ou moldura." }, { status: 400 });
  }
  if (template.size > MAX_ARQUIVO) {
    return NextResponse.json({ erro: "A imagem da marca é grande demais." }, { status: 400 });
  }

  let brutas: unknown = [];
  try {
    brutas = JSON.parse(String(form.get("fontes") ?? "[]"));
  } catch {
    return NextResponse.json({ erro: "Seleção inválida." }, { status: 400 });
  }
  const vistos = new Set<string>();
  const fontes: Fonte[] = [];
  if (Array.isArray(brutas)) {
    for (const f of brutas) {
      const url = String((f as { url?: unknown })?.url ?? "");
      if (!fonteValida(url) || vistos.has(url)) continue;
      vistos.add(url);
      const nome = String((f as { nome?: unknown })?.nome ?? "").trim().slice(0, 80);
      fontes.push({ url, nome: nome || "Vídeo com marca" });
      if (fontes.length >= MAX_LOTE) break;
    }
  }
  if (fontes.length === 0) {
    return NextResponse.json(
      { erro: "Nenhum vídeo válido pra carimbar." },
      { status: 400 },
    );
  }

  // Trava por nível da conta: o lote inteiro conta no teto diário e nos simultâneos
  // (cada vídeo do lote vira um job na fila).
  const trava = await travaDeGeracao(user, fontes.length);
  if (!trava.ok) {
    return NextResponse.json({ erro: trava.erro }, { status: trava.status });
  }

  const marcaTamanho = Math.max(15, Math.min(100, Number(form.get("marcaTamanho") ?? 100) || 100));
  const posRaw = String(form.get("marcaPosicao") ?? "meio-meio");
  const marcaPosicao = POS_MARCA.has(posRaw) ? posRaw : "meio-meio";
  const audioVideo = String(form.get("audioVideo") ?? "manter") === "remover" ? "remover" : "manter";
  // posição LIVRE (centro da logo em x/y %) quando a pessoa arrasta na prévia
  const marcaX = Number(form.get("marcaX"));
  const marcaY = Number(form.get("marcaY"));
  const temLivre =
    Number.isFinite(marcaX) && Number.isFinite(marcaY) &&
    marcaX >= 0 && marcaX <= 100 && marcaY >= 0 && marcaY <= 100;

  // trava de crédito pro lote inteiro (débito é só no fim de cada job). Admin passa.
  if (user.role !== "admin") {
    const dono = await prisma.user.findUnique({
      where: { id: user.id },
      select: { saldoCentavos: true },
    });
    const saldo = dono?.saldoCentavos ?? 0;
    const precisa = CUSTO * fontes.length;
    if (saldo < precisa) {
      return NextResponse.json(
        {
          erro: `Você precisa de ${precisa} créditos pra ${fontes.length} vídeo(s) (${CUSTO} cada). Seu saldo: ${saldo}.`,
          semCredito: true,
        },
        { status: 402 },
      );
    }
  }

  const tplBuf = Buffer.from(await template.arrayBuffer());
  const tplNome = nomeSeguro(template.name).replace(/\.[^.]*$/, "") + (path.extname(template.name) || ".png");

  let criados = 0;
  const falhas: string[] = [];

  // Sem double-hop: NÃO baixamos o vídeo aqui. Guardamos a URL do serverrk em
  // `fonteUrl` e o worker lê o arquivo LOCAL (/media/...) direto - economiza 2
  // transferências por vídeo. Só o template (logo, pequeno) vai pro data/uploads.
  // Nasce "recebendo" (worker só pega "na_fila") e só liberamos após gravar o template.
  for (const f of fontes) {
    let jobId: string | null = null;
    try {
      const opcoes = JSON.stringify({
        audioVideo,
        marcaTamanho,
        marcaPosicao,
        fonteUrl: f.url,
        ...(temLivre ? { marcaX, marcaY } : {}),
      });
      const job = await prisma.job.create({
        data: {
          userId: user.id,
          produto: f.nome,
          tipo: "marca",
          formato: "legenda",
          variantes: 1,
          opcoes,
          status: "recebendo",
        },
      });
      jobId = job.id;

      const tdir = path.join(pastaEntrada(job.id), "template");
      await fs.mkdir(tdir, { recursive: true });
      await fs.writeFile(path.join(tdir, tplNome), tplBuf);

      await prisma.job.update({ where: { id: job.id }, data: { status: "na_fila" } });
      criados += 1;
    } catch {
      if (jobId) {
        await prisma.job
          .update({
            where: { id: jobId },
            data: { status: "erro", erro: "Falha ao preparar o vídeo." },
          })
          .catch(() => {});
      }
      falhas.push(f.nome);
    }
  }

  if (criados === 0) {
    return NextResponse.json(
      { erro: "Não consegui preparar os vídeos. Tente de novo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, criados, falhas: falhas.length });
}
