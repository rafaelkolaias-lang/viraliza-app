import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { montarPromptProduto } from "@/lib/produto-shot";
import { gerarVideoGrok, type ArquivoImagem } from "@/lib/video-robot";
import { custoVideoAvatar } from "@/lib/avatar-modelo";
import { getCarteira, debitar } from "@/lib/creditos";

export const runtime = "nodejs";
export const maxDuration = 800;

/**
 * PONTE DEV (localhost): recebe o avatar escolhido + fotos do produto + opções,
 * monta o prompt pt-BR e roda o robô do Grok (Selenium no PC do Lucas) pra gerar
 * o vídeo. Devolve a URL local do mp4 pra tocar no localhost. Admin-only por
 * enquanto (dirige o navegador local). FUTURO: vai pro serverrk.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: {
    avatarUrl?: string;
    produtoFotos?: string[];
    apresentacao?: string;
    cenario?: string;
    duracao?: number;
    produtoNome?: string;
    titulo?: string;
    gerarClose?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  if (!body.avatarUrl) {
    return NextResponse.json({ erro: "Escolha um avatar." }, { status: 400 });
  }
  if (!body.apresentacao) {
    return NextResponse.json({ erro: "Escolha como o produto aparece." }, { status: 400 });
  }
  const fotos = Array.isArray(body.produtoFotos) ? body.produtoFotos : [];
  if (!fotos.length) {
    return NextResponse.json({ erro: "Envie ao menos 1 foto do produto." }, { status: 400 });
  }

  // avatar -> bytes
  let avatar: ArquivoImagem;
  try {
    avatar = await resolverAvatar(body.avatarUrl);
  } catch {
    return NextResponse.json({ erro: "Não consegui carregar o avatar." }, { status: 400 });
  }

  // fotos do produto (data URLs) -> bytes
  const produtos: ArquivoImagem[] = [];
  for (const f of fotos.slice(0, 3)) {
    const img = dataUrlParaImagem(f);
    if (img) produtos.push(img);
  }
  if (!produtos.length) {
    return NextResponse.json({ erro: "Fotos do produto inválidas." }, { status: 400 });
  }

  // custo: 6s = 250 créditos, 10s = 300. Admin/demo não pagam (igual ao resto).
  const dur = Number(body.duracao) || 6;
  const custo = custoVideoAvatar(dur);
  const isAdmin = user.role === "admin" || user.role === "demo";

  // checa saldo ANTES de gastar a geração (o débito de fato só sai se o vídeo vier)
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < custo) {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo },
        { status: 402 },
      );
    }
  }

  // foto de referência do cenário (docs/referencias), conforme o cenário escolhido
  const cenarioRef = await resolverCenarioRef(body.cenario);

  const prompt = montarPromptProduto({
    apresentacao: String(body.apresentacao),
    gerarClose: body.gerarClose !== false,
    produtoNome: body.produtoNome,
    titulo: typeof body.titulo === "string" ? body.titulo.slice(0, 160) : undefined,
    duracaoSeg: dur,
    cenario: body.cenario,
    temRefCenario: !!cenarioRef,
  });

  const r = await gerarVideoGrok({
    prompt,
    avatar,
    produtos,
    cenarioRef: cenarioRef ?? undefined,
    duracaoSeg: dur,
  });

  if (!r.ok || !r.videoUrl) {
    return NextResponse.json({ erro: r.erro ?? "Falha ao gerar o vídeo.", log: r.log }, { status: 502 });
  }

  // cobra os créditos SÓ agora que o vídeo saiu (falha não desconta). Admin não paga.
  if (!isAdmin) {
    try {
      await debitar(user.id, custo, "debito_geracao", {
        descricao: `Vídeo com avatar (${dur}s)`,
      });
    } catch {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo },
        { status: 402 },
      );
    }
  }

  // registra como um vídeo "pronto" pra aparecer em Meus vídeos (e virar editável
  // + watermarkável, que leem tudo da tabela Job). Se falhar, ainda devolve a URL.
  try {
    await prisma.job.create({
      data: {
        userId: user.id,
        produto: (body.titulo?.trim() || "Vídeo com avatar").slice(0, 255),
        tipo: "produto",
        formato: "legenda",
        variantes: 1,
        status: "pronto",
        duracao: dur,
        saidas: JSON.stringify([r.videoUrl]),
        midias: JSON.stringify([{ arquivo: r.videoUrl }]),
      },
    });
  } catch (e) {
    console.error("[avatar-video] falhou ao registrar em Meus vídeos", e);
  }

  return NextResponse.json({ ok: true, videoUrl: r.videoUrl, prompt, log: r.log });
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

// cada cenário aponta pra foto de referência real (docs/referencias). Cozinha e
// penteadeira ainda não têm foto, então vão sem referência (só o texto do prompt).
const CENARIO_REF: Record<string, string> = {
  sala: "casasala.png",
  sala_tijolo: "casasimples.png",
  quarto: "quarto.png",
  quintal: "quintal.png",
};

/** Lê a foto de referência do cenário escolhido (ou null se não tiver). */
async function resolverCenarioRef(cenario?: string): Promise<ArquivoImagem | null> {
  const arquivo = cenario ? CENARIO_REF[cenario] : undefined;
  if (!arquivo) return null;
  try {
    const abs = path.join(process.cwd(), "docs", "referencias", arquivo);
    const bytes = await readFile(abs);
    const ext = path.extname(abs).replace(".", "").toLowerCase() || "png";
    return { bytes, ext };
  } catch {
    return null;
  }
}

/** Resolve o avatar: URL local do app (public) ou URL externa (serverrk). */
async function resolverAvatar(url: string): Promise<ArquivoImagem> {
  if (url.startsWith("/")) {
    const abs = path.join(process.cwd(), "public", url.replace(/^\/+/, ""));
    const bytes = await readFile(abs);
    const ext = path.extname(abs).replace(".", "").toLowerCase() || "png";
    return { bytes, ext };
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("fetch avatar falhou");
  const bytes = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
  return { bytes, ext: MIME_EXT[mime] ?? "png" };
}

/** Converte um data URL base64 em bytes + extensão. */
function dataUrlParaImagem(dataUrl: string): ArquivoImagem | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const ext = MIME_EXT[m[1]] ?? "png";
  return { bytes: Buffer.from(m[2], "base64"), ext };
}
