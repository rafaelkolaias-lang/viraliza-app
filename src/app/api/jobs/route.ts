import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser, ferramentasLiberadas } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { pastaEntrada, pastaSaida } from "@/lib/jobs";
import { temSaldo } from "@/lib/creditos";
import { travaDeGeracao } from "@/lib/niveis";
import { vozValida } from "@/lib/vozes";
import {
  MAX_ARQUIVO_MB,
  clipesPrincipais,
  normalizarEdicao,
  normalizarRoteiro,
  normalizarSilencio,
  normalizarTextos,
  normalizarVelocidade,
  normalizarVolumes,
  tamanhoEmMB,
} from "@/lib/montagem";

/** Roteiro que a pessoa mesma escreveu pra narração (Editor, etapa 1, opção
 *  "eu escrevo"). 420 caracteres dão uns 33 segundos de fala (tarefa 31: era
 *  450): o mesmo teto da tela, senão dava pra passar por cima do limite
 *  mandando o form na mão. */
const MAX_ROTEIRO_FALA = 420;

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

/**
 * REUSO DE UM VÍDEO JÁ GERADO (ação "Cortar" em Meus vídeos).
 *
 * A pessoa não sobe nada: o arquivo que ela quer cortar já está no servidor. O
 * pedido manda só o ID do job de origem, e a fonte sai do BANCO, nunca de uma
 * URL vinda da tela. Isso é de propósito: aceitar a URL do cliente abriria um
 * SSRF (bastaria mandar um endereço interno pro servidor buscar).
 *
 * Devolve o que precisa pra copiar depois, ou `null` se o job não serve.
 */
async function fonteDeReuso(userId: string, origemJobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: origemJobId, userId, status: "pronto" },
    select: { saidas: true, midias: true },
  });
  if (!job) return null;

  const primeiro = (cru: string | null): string | undefined => {
    try {
      const v = cru ? JSON.parse(cru) : null;
      if (!Array.isArray(v) || !v.length) return undefined;
      const item = v[0] as string | { arquivo?: string };
      const p = typeof item === "string" ? item : item?.arquivo;
      return typeof p === "string" && p.trim() ? p.trim() : undefined;
    } catch {
      return undefined;
    }
  };
  // `midias` é o formato novo (um item por variante); `saidas` é o antigo
  const fonte = primeiro(job.midias) ?? primeiro(job.saidas);
  if (!fonte) return null;

  const base = nomeSeguro(path.basename(fonte.split("?")[0]));
  const nome = /\.[a-z0-9]{2,4}$/i.test(base) ? base : `${base}.mp4`;
  return { fonte, nome };
}

/** Copia o vídeo reusado pra pasta de entrada do job novo (disco ou mídia remota). */
async function copiarReuso(jobId: string, fonte: string, nome: string) {
  const dir = path.join(pastaEntrada(jobId), "videos");
  await fs.mkdir(dir, { recursive: true });
  const destino = path.join(dir, nome);

  if (/^https?:\/\//i.test(fonte)) {
    // vídeo hospedado (serverrk): baixa aqui no servidor, que é rede interna e
    // não custa upload nenhum pra quem está na tela
    const r = await fetch(fonte);
    if (!r.ok) throw new ErroDeEnvio("Não consegui recuperar o vídeo original pra cortar.");
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength > MAX_ARQUIVO) {
      throw new ErroDeEnvio(
        `O vídeo original tem ${tamanhoEmMB(buf.byteLength)} e o limite é ${MAX_ARQUIVO_MB} MB.`,
      );
    }
    await fs.writeFile(destino, buf);
    return;
  }

  // arquivo local: mora em public/videos/<jobId>/... e o caminho vem do banco.
  // O `basename` corta qualquer tentativa de subir de pasta.
  const partes = fonte.replace(/^\/+/, "").split("/");
  const idOrigem = partes[partes.indexOf("videos") + 1] ?? "";
  const origem = path.join(pastaSaida(idOrigem), path.basename(fonte));
  if (!idOrigem || !(await existe(origem))) {
    throw new ErroDeEnvio(
      "O vídeo original não está mais no servidor. Baixe ele e suba no Criar um Corte.",
    );
  }
  await fs.copyFile(origem, destino);
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

  // tipo do job: "marca" = Aplicar marca em lote (só carimba o template, sem fábrica);
  // "produto" (padrão) = fábrica (copy + voz/legenda + montagem). O worker despacha por isso.
  const tipoJob = String(form.get("tipo") ?? "produto") === "marca" ? "marca" : "produto";

  // Trava de geração: dívida de reembolso + limite universal de vídeos
  // simultâneos em produção (igual pra toda conta). Job de marca não ocupa vaga
  // (auditoria #25): passa 0 pra manter só a trava de dívida.
  const trava = await travaDeGeracao(user, tipoJob === "marca" ? 0 : 1);
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
  // padrão EQUILIBRADO (dono, 12/08/2026; era agressivo). A tela SEMPRE manda o
  // tom, então isto só vale pra pedido montado por fora - e mesmo aí o padrão
  // tem que ser o mesmo que a tela mostra, senão o vídeo sai com outro tom.
  const tom = String(form.get("tom") ?? "equilibrado");
  const variantes = Math.max(1, Math.min(5, Number(form.get("variantes") ?? 1) || 1));
  const posRaw = String(form.get("legendaPos") ?? "baixo");
  const legendaPos = ["cima", "meio", "baixo"].includes(posRaw) ? posRaw : "baixo";
  // estilo da legenda da FALA: "palavra" (uma palavra por vez, no ritmo da fala)
  // ou "completo" (frase inteira em até 2 linhas). Só existe onde a legenda sai
  // da fala; job antigo e chamada de fora não mandam nada e a fábrica usa o
  // padrão dela. Guardado em `opcoes` (sem coluna nova no banco).
  const estiloRaw = String(form.get("legendaEstilo") ?? "").trim();
  const legendaEstilo =
    ["voz", "transcrever"].includes(formato) && ["palavra", "completo"].includes(estiloRaw)
      ? estiloRaw
      : "";
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
  // trilha ESCOLHIDA da biblioteca da plataforma (só o nome do arquivo; o worker
  // aponta no config e a fábrica acha em entrada/musicas). `job_*` nunca pode
  // ser escolhido: é upload de outro usuário, não faz parte da biblioteca.
  const musicaNomeRaw = path
    .basename(String(form.get("musicaNome") ?? "").trim())
    .slice(0, 200);
  const musicaNome =
    comMusica && musicaNomeRaw && !musicaNomeRaw.toLowerCase().startsWith("job_")
      ? musicaNomeRaw
      : "";

  // ---- MONTAGEM DO EDITOR (ordem, cortes, clipe principal, textos, volumes) ----
  // Isso aqui era descartado: a tela mandava e ninguém lia (`auditoria.md` #22 e
  // #23). Agora vai junto no job e a fábrica monta por ele.
  // "Cortar" um vídeo que já foi gerado: o arquivo vem do servidor, não da tela
  const origemJobId = String(form.get("origemJobId") ?? "").trim();
  const reuso = origemJobId ? await fonteDeReuso(user.id, origemJobId) : null;
  if (origemJobId && !reuso) {
    return NextResponse.json(
      { erro: "Não achei esse vídeo pra cortar. Ele pode ter sido apagado." },
      { status: 400 },
    );
  }

  // ---- REUSO DA ENTRADA de um job anterior (tarefa 21) ----
  // "Tentar Novamente" / "Editar novamente": as mídias originais ficam 24h no
  // servidor, então a tela manda só os NOMES e a cópia é feita aqui, de disco a
  // disco, sem upload nenhum. A fonte sai do banco (job do próprio dono), nunca
  // de caminho vindo da tela.
  //
  // São DUAS fontes possíveis, e podem vir juntas (11/08/2026): o job anterior
  // (Tentar Novamente / Editar novamente) e o RASCUNHO que o Editor foi
  // enchendo enquanto a pessoa montava o vídeo, na etapa 3. Cada arquivo mora
  // em uma das duas, por isso é lista e não um só.
  type FonteEntrada = {
    id: string;
    status: string;
    arquivos: { sub: "videos" | "imagens"; nome: string }[];
  };
  async function resolverFonte(
    jobId: string,
    cruNomes: unknown,
    expirou: string,
  ): Promise<FonteEntrada | NextResponse> {
    const pedidos = Array.isArray(cruNomes)
      ? [...new Set(
          cruNomes
            .filter((n): n is string => typeof n === "string" && !!n.trim())
            .map((n) => nomeSeguro(n)),
        )].slice(0, 60)
      : [];
    const dono = await prisma.job.findFirst({
      where: { id: jobId, userId: user!.id },
      select: { id: true, status: true },
    });
    if (!dono || pedidos.length === 0) {
      return NextResponse.json(
        { erro: "Não achei o vídeo original pra reusar as mídias." },
        { status: 400 },
      );
    }
    const arquivos: { sub: "videos" | "imagens"; nome: string }[] = [];
    for (const nome of pedidos) {
      for (const sub of ["videos", "imagens"] as const) {
        if (await existe(path.join(pastaEntrada(dono.id), sub, nome))) {
          arquivos.push({ sub, nome });
          break;
        }
      }
    }
    if (arquivos.length !== pedidos.length) {
      return NextResponse.json({ erro: expirou }, { status: 400 });
    }
    return { id: dono.id, status: dono.status, arquivos };
  }

  const fontesEntrada: FonteEntrada[] = [];
  const reusarEntradaDe = String(form.get("reusarEntradaDe") ?? "").trim();
  if (reusarEntradaDe) {
    const r = await resolverFonte(
      reusarEntradaDe,
      leJson(form.get("reusarArquivos")),
      "As mídias originais expiraram no servidor (valem 24h). Faça o upload dos arquivos de novo pra re-gerar.",
    );
    if (r instanceof NextResponse) return r;
    fontesEntrada.push(r);
  }
  // rascunho do Editor: as mídias já subiram na etapa 3, então aqui só se copia
  const rascunhoDe = String(form.get("rascunhoDe") ?? "").trim();
  if (rascunhoDe) {
    const r = await resolverFonte(
      rascunhoDe,
      leJson(form.get("rascunhoArquivos")),
      "As mídias que você subiu não estão mais no servidor. Volte pras mídias e envie de novo.",
    );
    if (r instanceof NextResponse) return r;
    fontesEntrada.push(r);
  }

  const ehChunked = form.get("chunked") != null;
  const nomesSalvos = ehChunked
    ? null // no upload em pedaços os arquivos chegam depois; nome já vem sanitizado igual
    : new Set(
        [
          ...[...form.getAll("videos"), ...form.getAll("imagens")]
            .filter((f): f is File => f instanceof File)
            .map((f) => nomeSeguro(f.name)),
          // o arquivo reusado ainda não existe em disco, mas vai existir com
          // este nome: sem ele aqui o roteiro apontaria pra um nome "que não
          // foi enviado" e o `normalizarRoteiro` jogaria os cortes fora
          ...(reuso ? [reuso.nome] : []),
          // idem pras mídias que já estão no servidor (job anterior ou rascunho)
          ...fontesEntrada.flatMap((f) => f.arquivos.map((a) => a.nome)),
        ],
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
  // melhorias de montagem (Ken Burns, transições, som do apoio, melhor trecho).
  // Tudo ligado por padrão: pedido sem esse campo (job antigo, chamada de fora)
  // continua recebendo a edição completa.
  const edicao = normalizarEdicao(leJson(form.get("edicao")));
  // narração escrita PELA PESSOA: quando vem, a IA não inventa o texto da fala,
  // só transforma esse roteiro em voz. Só faz sentido no formato "voz".
  const roteiroFala =
    formato === "voz"
      ? String(form.get("roteiroFala") ?? "").trim().slice(0, MAX_ROTEIRO_FALA)
      : "";
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
    ...(musicaNome ? { musica: musicaNome } : {}),
    ...(legendaEstilo ? { legendaEstilo } : {}),
    ...(temLivre ? { marcaX, marcaY } : {}),
    volumes, // sempre: é o que faz o controle de volume valer no render
    ...(velocidadeMusica !== 1 ? { velocidadeMusica } : {}),
    ...(cortarSilencio > 0 && temPrincipal ? { cortarSilencio } : {}),
    ...(roteiro.length ? { roteiro, edicao } : {}),
    ...(textos.length ? { textos } : {}),
    ...(roteiroFala ? { roteiroFala } : {}),
  });
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
    // teto de rascunhos abertos (auditoria #30): sem ele dava pra abrir
    // depósitos "recebendo" sem fim e encher o disco (a limpeza só passa 12h
    // depois). 15 cobre com folga o maior uso legítimo, o lote de 12 vídeos.
    if (user.role !== "admin") {
      const abertos = await prisma.job.count({
        where: { userId: user.id, status: "recebendo" },
      });
      if (abertos >= 15) {
        return NextResponse.json(
          {
            erro:
              "Você tem envios demais em aberto. Espere os uploads que já estão rodando terminarem e tente de novo.",
          },
          { status: 429 },
        );
      }
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
  if (videos.length === 0 && imagens.length === 0 && !reuso && !fontesEntrada.length) {
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
    if (reuso) await copiarReuso(job.id, reuso.fonte, reuso.nome);
    // mídia que já está no servidor, sem upload nenhum. Do job ANTERIOR
    // ("Tentar Novamente"/"Editar novamente") é CÓPIA: a entrada dele continua
    // valendo pra outro reuso. Do RASCUNHO do Editor é MOVIDA (auditoria #29):
    // o depósito só existiu pra virar ESTE vídeo, e copiar deixava as duas
    // cópias convivendo por horas - até 300 MB por cena, em dobro, à toa.
    for (const fonte of fontesEntrada) {
      const ehRascunho = fonte.id === rascunhoDe && fonte.status === "recebendo";
      for (const a of fonte.arquivos) {
        const dir = path.join(pastaEntrada(job.id), a.sub);
        await fs.mkdir(dir, { recursive: true });
        const origem = path.join(pastaEntrada(fonte.id), a.sub, a.nome);
        const destino = path.join(dir, a.nome);
        if (ehRascunho) {
          try {
            await fs.rename(origem, destino);
          } catch {
            // rename não atravessa volume: copia e apaga a origem
            await fs.copyFile(origem, destino);
            await fs.rm(origem, { force: true }).catch(() => {});
          }
        } else {
          await fs.copyFile(origem, destino);
        }
      }
    }
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

  // ---- ENTRA NA FILA, OU FICA ESPERANDO A IA (dono, 11/08/2026) ----
  // Com `aguardarIA` o job para em "preparando" em vez de "na_fila": a tela já
  // pode sair de cima (a pessoa vai pra Meus vídeos e vê o card gerando)
  // enquanto o NAVEGADOR termina de descrever e posicionar as cenas, que é
  // trabalho que só dá pra fazer lá (os quadros e o áudio saem dos arquivos
  // locais). Quem solta pra fila depois é o `/api/jobs/[id]/pronto`, com o
  // roteiro final. O worker só pega "na_fila", então nada renderiza antes da
  // hora, e falha da IA vira card com erro em vez de vídeo mal montado.
  const aguardarIA = form.get("aguardarIA") != null;
  await prisma.job.update({
    where: { id: job.id },
    data: aguardarIA
      ? { status: "preparando", etapa: "Encaixando as cenas" }
      : { status: "na_fila" },
  });

  // rascunho consumido (auditoria #29): as mídias moraram pro job de verdade,
  // então a pasta que sobrou e a linha "recebendo" do depósito já eram - antes a
  // linha ficava no banco pra sempre. O deleteMany condicional (dono + status)
  // garante que só rascunho MESMO some.
  const rascunhoConsumido = fontesEntrada.find(
    (f) => f.id === rascunhoDe && f.status === "recebendo",
  );
  if (rascunhoConsumido) {
    await fs
      .rm(pastaEntrada(rascunhoConsumido.id), { recursive: true, force: true })
      .catch(() => {});
    await prisma.job
      .deleteMany({
        where: { id: rascunhoConsumido.id, userId: user.id, status: "recebendo" },
      })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true, id: job.id });
}
