import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, ferramentasLiberadas } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";
import { temSaldo } from "@/lib/creditos";
import { vozValida } from "@/lib/vozes";

export const runtime = "nodejs";

// nome de arquivo seguro (sem caminho, sem caractere estranho)
function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo";
}

// teto por arquivo (defesa contra encher o disco). Vídeo grande vai pelo chunked.
const MAX_ARQUIVO = 300 * 1024 * 1024; // 300MB

async function salvarArquivos(
  jobId: string,
  sub: "videos" | "imagens" | "musica" | "template",
  files: File[],
) {
  if (files.length === 0) return;
  const dir = path.join(pastaEntrada(jobId), sub);
  await fs.mkdir(dir, { recursive: true });
  for (const file of files) {
    if (file.size > MAX_ARQUIVO) {
      throw new Error(`Arquivo grande demais: ${file.name}`);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(dir, nomeSeguro(file.name)), buf);
  }
}

// Assets do "Em lote" de demonstração (ficam no servidor, vão via git/deploy):
// moldura @RANDOMLYY + um vídeo de amostra curto.
const DEMO_TEMPLATE = path.join(process.cwd(), "public", "templates", "demo-randomlyy.png");
const DEMO_VIDEO = path.join(process.cwd(), "public", "samples", "demo-clip.mp4");

async function existe(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }

  const form = await req.formData();

  // ---- DEMO: gera 1 exemplo do "Em lote" com a moldura + vídeo de amostra ----
  if (user.role === "demo") {
    if (form.get("demoAmostra") == null) {
      return NextResponse.json(
        {
          erro: "No modo demo a geração é só a amostra pronta do Em lote. 🙂",
        },
        { status: 403 },
      );
    }
    const jaTem = await prisma.job.count({
      where: { userId: user.id, tipo: "marca" },
    });
    if (jaTem > 0) {
      return NextResponse.json(
        {
          erro: "No demo você gera 1 exemplo. Apague o anterior (ou peça um reset) pra gerar outro. 🙂",
        },
        { status: 403 },
      );
    }
    if (!(await existe(DEMO_TEMPLATE)) || !(await existe(DEMO_VIDEO))) {
      return NextResponse.json(
        { erro: "A amostra do demo ainda não foi configurada no servidor." },
        { status: 503 },
      );
    }
    const job = await prisma.job.create({
      data: {
        userId: user.id,
        produto: "Exemplo @RANDOMLYY",
        tipo: "marca",
        formato: "legenda",
        status: "na_fila",
      },
    });
    try {
      const vdir = path.join(pastaEntrada(job.id), "videos");
      const tdir = path.join(pastaEntrada(job.id), "template");
      await fs.mkdir(vdir, { recursive: true });
      await fs.mkdir(tdir, { recursive: true });
      await fs.copyFile(DEMO_VIDEO, path.join(vdir, "exemplo.mp4"));
      await fs.copyFile(DEMO_TEMPLATE, path.join(tdir, "template.png"));
    } catch {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "erro", erro: "Falha ao montar a amostra demo." },
      });
      return NextResponse.json(
        { erro: "Não consegui montar a amostra. Tente de novo." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, id: job.id });
  }

  // Trava de acesso: o admin pode suspender as ferramentas deste usuário a qualquer hora.
  if (user.role !== "admin" && !(await ferramentasLiberadas(user.id))) {
    return NextResponse.json(
      { erro: "Seu acesso às ferramentas foi suspenso pelo administrador." },
      { status: 403 },
    );
  }

  // Trava de crédito: produção exige crédito (admin passa direto; demo já tratado acima).
  if (user.role !== "admin" && !(await temSaldo(user.id))) {
    return NextResponse.json(
      {
        erro: "Você precisa de créditos pra gerar. Compre na aba Créditos.",
        semCredito: true,
      },
      { status: 402 },
    );
  }

  // Limite de vídeos simultâneos em produção: evita enfileirar muitos com saldo
  // baixo (o débito é no fim, então sem isso dava pra furar a trava de crédito).
  if (user.role !== "admin") {
    const pendentes = await prisma.job.count({
      where: {
        userId: user.id,
        status: { in: ["na_fila", "renderizando", "processando"] },
      },
    });
    if (pendentes >= 3) {
      return NextResponse.json(
        {
          erro: "Você já tem 3 vídeos em produção. Espere terminarem pra gerar mais.",
        },
        { status: 429 },
      );
    }
  }

  const produto = String(form.get("produto") ?? "").trim();
  const descricao = String(form.get("descricao") ?? "").trim();
  const preco = String(form.get("preco") ?? "").trim();
  const formato = String(form.get("formato") ?? "legenda");
  const tom = String(form.get("tom") ?? "agressivo");
  const variantes = Math.max(1, Math.min(5, Number(form.get("variantes") ?? 1) || 1));
  const posRaw = String(form.get("legendaPos") ?? "baixo");
  const legendaPos = ["cima", "meio", "baixo"].includes(posRaw) ? posRaw : "baixo";
  // som do vídeo original: "manter" (padrão) ou "remover" (Mudo). Guardado em opcoes.
  const audioVideo = String(form.get("audioVideo") ?? "manter") === "remover" ? "remover" : "manter";
  // marca em lote: tamanho (% da largura; 100 = moldura/tela cheia) + posição (9 pontos)
  const POS_MARCA = new Set([
    "cima-esq", "cima-meio", "cima-dir",
    "meio-esq", "meio-meio", "meio-dir",
    "baixo-esq", "baixo-meio", "baixo-dir",
  ]);
  const marcaTamanho = Math.max(15, Math.min(100, Number(form.get("marcaTamanho") ?? 100) || 100));
  const posRawMarca = String(form.get("marcaPosicao") ?? "meio-meio");
  const marcaPosicao = POS_MARCA.has(posRawMarca) ? posRawMarca : "meio-meio";
  const opcoes = JSON.stringify({ audioVideo, marcaTamanho, marcaPosicao });
  // tipo do job: "marca" = Aplicar marca em lote (só carimba o template, sem fábrica);
  // "produto" (padrão) = fábrica (copy + voz/legenda + montagem). O worker despacha por isso.
  const tipoJob = String(form.get("tipo") ?? "produto") === "marca" ? "marca" : "produto";
  // voz da narração: só vale no formato "voz"; senão fica null (voz padrão).
  // Com chave própria (BYO) aceita qualquer voz da conta do usuário; sem chave,
  // só as vozes curadas da plataforma.
  let vozId: string | null = null;
  if (formato === "voz") {
    const vozRaw = (form.get("vozId")?.toString() ?? "").trim();
    const dono = await prisma.user.findUnique({
      where: { id: user.id },
      select: { elevenKey: true },
    });
    vozId = dono?.elevenKey
      ? /^[A-Za-z0-9]{12,40}$/.test(vozRaw)
        ? vozRaw
        : null
      : vozValida(vozRaw);
  }

  // ---- modo CHUNKED: cria o job como RASCUNHO ("recebendo"); os arquivos vêm
  // depois, em pedaços, por /api/jobs/[id]/chunk (evita o limite de 100MB do
  // Cloudflare e o estouro de memória com upload grande). O worker só pega
  // status "na_fila", então o rascunho fica seguro até /api/jobs/[id]/pronto.
  if (form.get("chunked") != null) {
    if (produto.length < 2) {
      return NextResponse.json({ erro: "Dê um nome ao produto." }, { status: 400 });
    }
    const job = await prisma.job.create({
      data: {
        userId: user.id,
        produto,
        descricao: descricao || null,
        tipo: tipoJob,
        formato: formato === "voz" ? "voz" : "legenda",
        vozId,
        tom,
        variantes,
        preco: preco || null,
        legendaPos,
        opcoes,
        status: "recebendo",
      },
    });
    return NextResponse.json({ ok: true, id: job.id });
  }

  const videos = form.getAll("videos").filter((f): f is File => f instanceof File);
  const imagens = form.getAll("imagens").filter((f): f is File => f instanceof File);
  const musica = form.getAll("musica").filter((f): f is File => f instanceof File);
  // template = imagem (logo/@) sobreposta no vídeo todo (worker compõe no render)
  const template = form.getAll("template").filter((f): f is File => f instanceof File);

  if (produto.length < 2) {
    return NextResponse.json({ erro: "Dê um nome ao produto." }, { status: 400 });
  }
  if (videos.length === 0 && imagens.length === 0) {
    return NextResponse.json(
      { erro: "Adicione pelo menos um vídeo ou imagem." },
      { status: 400 },
    );
  }

  // cria o job primeiro pra ter o id (= nome da pasta)
  const job = await prisma.job.create({
    data: {
      userId: user.id,
      produto,
      descricao: descricao || null,
      tipo: tipoJob,
      formato: formato === "voz" ? "voz" : "legenda",
      vozId,
      tom,
      variantes,
      preco: preco || null,
      legendaPos,
      opcoes,
      status: "na_fila",
    },
  });

  try {
    await salvarArquivos(job.id, "videos", videos);
    await salvarArquivos(job.id, "imagens", imagens);
    await salvarArquivos(job.id, "musica", musica);
    await salvarArquivos(job.id, "template", template);
  } catch {
    // se a gravação falhar, marca o job como erro pra não ficar preso na fila
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "erro", erro: "Falha ao salvar a mídia enviada." },
    });
    return NextResponse.json(
      { erro: "Não consegui salvar os arquivos. Tente de novo." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: job.id });
}
