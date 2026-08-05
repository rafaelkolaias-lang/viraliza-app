import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, ferramentasLiberadas } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada } from "@/lib/jobs";
import { temSaldo } from "@/lib/creditos";
import { travaDeGeracao } from "@/lib/niveis";
import { vozValida } from "@/lib/vozes";
import {
  MAX_ARQUIVO_MB,
  clipesPrincipais,
  normalizarRoteiro,
  normalizarSilencio,
  normalizarTextos,
  normalizarVelocidade,
  normalizarVolumes,
  tamanhoEmMB,
} from "@/lib/montagem";

export const runtime = "nodejs";

// nome de arquivo seguro (sem caminho, sem caractere estranho)
function nomeSeguro(nome: string) {
  return path.basename(nome).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "arquivo";
}

// campo de formulário que vem como JSON: nunca deixa um JSON torto derrubar o envio
function leJson(v: FormDataEntryValue | null): unknown {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

// teto por arquivo (defesa contra encher o disco). Vídeo grande vai pelo chunked.
const MAX_ARQUIVO = MAX_ARQUIVO_MB * 1024 * 1024;

/**
 * Erro que a gente mesmo levantou e PODE ser mostrado pra pessoa. Antes qualquer
 * falha aqui virava "Falha ao salvar a mídia enviada", então quem mandava um
 * arquivo grande demais nunca descobria qual era nem por quê.
 */
class ErroDeEnvio extends Error {}

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
      throw new ErroDeEnvio(
        `"${file.name}" tem ${tamanhoEmMB(file.size)} e o limite por arquivo é ${MAX_ARQUIVO_MB} MB. Corte esse arquivo ou use um menor.`,
      );
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

  // Trava por nível da conta (bronze/prata/ouro): dívida de reembolso, teto
  // diário de vídeos e simultâneos. Substitui o antigo "máx. 3 em produção".
  const trava = await travaDeGeracao(user);
  if (!trava.ok) {
    return NextResponse.json({ erro: trava.erro }, { status: trava.status });
  }

  const produto = String(form.get("produto") ?? "").trim();
  const descricao = String(form.get("descricao") ?? "").trim();
  const preco = String(form.get("preco") ?? "").trim();
  const formatoRaw = String(form.get("formato") ?? "legenda");
  // formatos: legenda/voz (copy da IA), transcrever (whisper no áudio do vídeo),
  // nenhum (sem legenda e sem voz). Qualquer outra coisa cai em "legenda".
  const formato = ["voz", "transcrever", "nenhum"].includes(formatoRaw) ? formatoRaw : "legenda";
  const tom = String(form.get("tom") ?? "agressivo");
  const variantes = Math.max(1, Math.min(5, Number(form.get("variantes") ?? 1) || 1));
  const posRaw = String(form.get("legendaPos") ?? "baixo");
  const legendaPos = ["cima", "meio", "baixo"].includes(posRaw) ? posRaw : "baixo";
  // som do vídeo original: "manter" (padrão) ou "remover" (Mudo). Guardado em opcoes.
  const audioVideo = String(form.get("audioVideo") ?? "manter") === "remover" ? "remover" : "manter";
  // onde vai vender: muda o CTA/hashtags da copy ("shopee" = sacolinha laranja; "outro" = neutro)
  const plataforma = String(form.get("plataforma") ?? "shopee") === "outro" ? "outro" : "shopee";
  // marca em lote: tamanho (% da largura; 100 = moldura/tela cheia) + posição (9 pontos)
  const POS_MARCA = new Set([
    "cima-esq", "cima-meio", "cima-dir",
    "meio-esq", "meio-meio", "meio-dir",
    "baixo-esq", "baixo-meio", "baixo-dir",
  ]);
  const marcaTamanho = Math.max(15, Math.min(100, Number(form.get("marcaTamanho") ?? 100) || 100));
  const posRawMarca = String(form.get("marcaPosicao") ?? "meio-meio");
  const marcaPosicao = POS_MARCA.has(posRawMarca) ? posRawMarca : "meio-meio";
  // posição LIVRE (centro da logo em x/y % da tela) - quando a pessoa arrasta na prévia
  const marcaX = Number(form.get("marcaX"));
  const marcaY = Number(form.get("marcaY"));
  const temLivre =
    Number.isFinite(marcaX) && Number.isFinite(marcaY) &&
    marcaX >= 0 && marcaX <= 100 && marcaY >= 0 && marcaY <= 100;
  // volume da música (0-100; o worker converte). Vale pra música própria e pra automática.
  const volumeMusica = Math.max(0, Math.min(100, Number(form.get("volumeMusica") ?? 40) || 40));
  // "É um produto?" = Não -> a IA NÃO escreve copy nem queima legenda (antes ela
  // alucinava uma legenda aleatória). "Sem música" -> nem a automática entra.
  const ehProduto = String(form.get("ehProduto") ?? "1") !== "0";
  const comMusica = String(form.get("comMusica") ?? "1") !== "0";

  // ---- MONTAGEM DO EDITOR (ordem, cortes, clipe principal, textos, volumes) ----
  // Isso aqui era descartado: a tela mandava e ninguém lia (`auditoria.md` #22 e
  // #23). Agora vai junto no job e a fábrica monta por ele.
  const ehChunked = form.get("chunked") != null;
  const nomesSalvos = ehChunked
    ? null // no upload em pedaços os arquivos chegam depois; nome já vem sanitizado igual
    : new Set(
        [...form.getAll("videos"), ...form.getAll("imagens")]
          .filter((f): f is File => f instanceof File)
          .map((f) => nomeSeguro(f.name)),
      );
  const roteiro = normalizarRoteiro(leJson(form.get("roteiro")), nomesSalvos, nomeSeguro);
  const textos = normalizarTextos(leJson(form.get("textos")));
  // se a tela não mandar os volumes novos, o controle antigo de música ainda vale
  const volumes = normalizarVolumes(
    leJson(form.get("volumes")) ?? { musica: volumeMusica },
  );
  // velocidade da música (só os passos da lista; o render mantém o tom)
  const velocidadeMusica = normalizarVelocidade(form.get("velocidadeMusica"));
  // corte de silêncio na base (0 = desligado)
  const cortarSilencio = normalizarSilencio(form.get("cortarSilencio"));
  const temPrincipal = clipesPrincipais(roteiro).length > 0;
  // com clipe principal quem narra é a pessoa: a voz da IA por cima brigaria com ela
  if (temPrincipal && formato === "voz") {
    return NextResponse.json(
      {
        erro: "Com um clipe principal quem narra é você. Escolha outro formato (Transcrever fala ou Nenhum).",
      },
      { status: 400 },
    );
  }

  const opcoes = JSON.stringify({
    audioVideo,
    volumeMusica,
    marcaTamanho,
    marcaPosicao,
    plataforma,
    ...(ehProduto ? {} : { semCopy: true }),
    ...(comMusica ? {} : { semMusica: true }),
    ...(temLivre ? { marcaX, marcaY } : {}),
    volumes, // sempre: é o que faz o controle de volume valer no render
    ...(velocidadeMusica !== 1 ? { velocidadeMusica } : {}),
    ...(cortarSilencio > 0 && temPrincipal ? { cortarSilencio } : {}),
    ...(roteiro.length ? { roteiro } : {}),
    ...(textos.length ? { textos } : {}),
  });
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
        formato,
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

  // cria o job como "recebendo" (o worker NÃO pega esse status) e só vira
  // "na_fila" DEPOIS da mídia salva no disco. Antes ele nascia "na_fila" e o
  // worker às vezes pegava o job na janela antes dos arquivos existirem ->
  // fábrica montava 0 clipes e explodia com "concat n=0".
  const job = await prisma.job.create({
    data: {
      userId: user.id,
      produto,
      descricao: descricao || null,
      tipo: tipoJob,
      formato,
      vozId,
      tom,
      variantes,
      preco: preco || null,
      legendaPos,
      opcoes,
      status: "recebendo",
    },
  });

  try {
    await salvarArquivos(job.id, "videos", videos);
    await salvarArquivos(job.id, "imagens", imagens);
    await salvarArquivos(job.id, "musica", musica);
    await salvarArquivos(job.id, "template", template);
  } catch (e) {
    // se a gravação falhar, marca o job como erro pra não ficar preso na fila.
    // Erro nosso (arquivo grande demais) vai com o motivo REAL pra pessoa saber
    // qual arquivo é; qualquer outra falha fica genérica pra não vazar detalhe
    // interno do servidor.
    const meu = e instanceof ErroDeEnvio;
    const motivo = meu
      ? e.message
      : "Não consegui salvar os arquivos. Tente de novo.";
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "erro", erro: motivo },
    });
    return NextResponse.json({ erro: motivo }, { status: meu ? 400 : 500 });
  }

  // mídia no disco: agora sim entra na fila do worker
  await prisma.job.update({ where: { id: job.id }, data: { status: "na_fila" } });

  return NextResponse.json({ ok: true, id: job.id });
}
