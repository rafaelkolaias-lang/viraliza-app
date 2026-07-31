import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { montarPromptProduto, montarPromptAvatarPronto, montarPromptLivre } from "@/lib/produto-shot";
import { gerarVideoGrok, type ArquivoImagem } from "@/lib/video-robot";
import { custoVideoAvatar, IDIOMAS_FALA } from "@/lib/avatar-modelo";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { criarNotificacao } from "@/lib/notificacoes";
import { subirAvatar } from "@/lib/serverrk-upload";

export const runtime = "nodejs";
export const maxDuration = 1600;

/**
 * Gera o vídeo com avatar de forma ASSÍNCRONA: valida tudo, cria o Job como
 * "processando" (já aparece em Meus vídeos com a etapa) e responde na hora com o
 * jobId. A geração de verdade roda em background (after): manda pro robô do Grok
 * no serverrk (que tem FILA, um por vez), e quando o mp4 sai a gente debita os
 * créditos, marca o Job "pronto" (com thumb) e manda a notificação do sininho.
 * Falha não cobra. A pessoa pode fechar a aba: o vídeo aparece sozinho.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: {
    avatarUrl?: string;
    produtoFotos?: string[];
    apresentacao?: string;
    cenario?: string;
    cenarioTexto?: string;
    duracao?: number;
    produtoNome?: string;
    titulo?: string;
    gerarClose?: boolean;
    comFala?: boolean;
    qualidade?: string;
    plataforma?: string; // "carrinho" (Shopee/TikTok Shop) | "link" (muda o CTA da fala)
    imagemUnica?: boolean; // 15s: manda SÓ a imagem do avatar-com-produto pro Grok
    livre?: boolean; // Vídeo livre: prompt exato da pessoa + imagens de referência
    promptLivre?: string;
    imagens?: string[]; // livre: data URLs (celular) ou URLs de avatar da plataforma
    idioma?: string; // livre: chave do idioma da fala (pt padrão, en, es)
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  // modo imagemUnica (vídeo de 15s): a foto do avatar JÁ tem o produto e o cenário,
  // então NÃO exige fotos de produto nem "como aparece" nem cenário separado.
  const imagemUnica = !!body.imagemUnica;
  // modo livre: a pessoa escreve o prompt (vai EXATO pro Grok, só com a abertura
  // UGC na frente) e anexa as imagens que quiser. 15s aceita SÓ 1 imagem.
  const livre = !!body.livre;

  const dur = Number(body.duracao) || 6;
  const comFala = body.comFala !== false;

  let avatar: ArquivoImagem;
  const produtos: ArquivoImagem[] = [];
  let textoLivre = "";
  let avatarUrlEntrada: string | null = body.avatarUrl ?? null;

  if (livre) {
    textoLivre = typeof body.promptLivre === "string" ? body.promptLivre.trim().slice(0, 4000) : "";
    if (!textoLivre) {
      return NextResponse.json({ erro: "Escreva o que você quer no vídeo." }, { status: 400 });
    }
    const imgs = (Array.isArray(body.imagens) ? body.imagens : []).filter(
      (s): s is string => typeof s === "string" && !!s,
    );
    if (!imgs.length) {
      return NextResponse.json({ erro: "Anexe ao menos 1 imagem de referência." }, { status: 400 });
    }
    // 15s: o Grok só aceita 1 imagem de referência. 6s/10s: até 3.
    const max = dur >= 15 ? 1 : 3;
    if (imgs.length > max) {
      return NextResponse.json(
        { erro: dur >= 15 ? "Vídeo de 15s aceita só 1 imagem." : "No máximo 3 imagens." },
        { status: 400 },
      );
    }
    // 1ª imagem entra como "avatar" (principal) e as demais como referências extras
    const resolvidas: ArquivoImagem[] = [];
    for (const s of imgs) {
      try {
        const img = s.startsWith("data:") ? dataUrlParaImagem(s) : await resolverAvatar(s);
        if (img) resolvidas.push(img);
      } catch {
        /* imagem que falhou fica de fora; valida o total abaixo */
      }
    }
    if (!resolvidas.length) {
      return NextResponse.json({ erro: "Não consegui carregar as imagens." }, { status: 400 });
    }
    avatar = resolvidas[0];
    produtos.push(...resolvidas.slice(1));
    // pra auditoria (admin/reportes): se a 1ª imagem é URL da plataforma, guarda ela
    avatarUrlEntrada = imgs[0].startsWith("data:") ? null : imgs[0];
  } else {
    if (!body.avatarUrl) {
      return NextResponse.json({ erro: "Escolha um avatar." }, { status: 400 });
    }
    if (!imagemUnica && !body.apresentacao) {
      return NextResponse.json({ erro: "Escolha como o produto aparece." }, { status: 400 });
    }

    // avatar -> bytes
    try {
      avatar = await resolverAvatar(body.avatarUrl);
    } catch {
      return NextResponse.json({ erro: "Não consegui carregar o avatar." }, { status: 400 });
    }

    // fotos do produto: só no modo normal (6s/10s). No imagemUnica vai vazio.
    if (!imagemUnica) {
      const fotos = Array.isArray(body.produtoFotos) ? body.produtoFotos : [];
      if (!fotos.length) {
        return NextResponse.json({ erro: "Envie ao menos 1 foto do produto." }, { status: 400 });
      }
      for (const f of fotos.slice(0, 3)) {
        const img = dataUrlParaImagem(f);
        if (img) produtos.push(img);
      }
      if (!produtos.length) {
        return NextResponse.json({ erro: "Fotos do produto inválidas." }, { status: 400 });
      }
    }
  }

  // custo depende da duração E da fala (sem fala custa menos). Admin/demo não pagam.
  const custo = custoVideoAvatar(dur, comFala);
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

  // no imagemUnica e no livre NÃO manda cenário separado
  const cenarioRef = imagemUnica || livre ? null : await resolverCenarioRef(body.cenario);
  const tituloLimpo = typeof body.titulo === "string" ? body.titulo.slice(0, 160) : undefined;
  const plataforma = body.plataforma === "link" ? "link" : "carrinho";

  const idiomaFala =
    IDIOMAS_FALA.find((i) => i.chave === body.idioma)?.fala ?? IDIOMAS_FALA[0].fala;
  const prompt = livre
    ? montarPromptLivre({ texto: textoLivre, duracaoSeg: dur, comFala, idiomaFala })
    : imagemUnica
    ? montarPromptAvatarPronto({ titulo: tituloLimpo, duracaoSeg: dur, comFala, plataforma })
    : montarPromptProduto({
        apresentacao: String(body.apresentacao),
        gerarClose: body.gerarClose !== false,
        produtoNome: body.produtoNome,
        titulo: tituloLimpo,
        duracaoSeg: dur,
        cenario: body.cenario,
        cenarioTexto: typeof body.cenarioTexto === "string" ? body.cenarioTexto.slice(0, 300) : undefined,
        temRefCenario: !!cenarioRef,
        comFala,
        plataforma,
      });

  // 1. cria o Job JÁ como "processando": aparece na hora em Meus vídeos
  // no livre o nome vem da 1ª linha do prompt (sem "#" de título de ficha)
  const nomeLivre = livre
    ? textoLivre.split("\n")[0].replace(/^#+\s*/, "").trim()
    : "";
  const nomeVideo = (
    body.titulo?.trim() ||
    body.produtoNome?.trim() ||
    nomeLivre ||
    "Vídeo com avatar"
  ).slice(0, 255);
  const job = await prisma.job.create({
    data: {
      userId: user.id,
      produto: nomeVideo,
      tipo: "produto",
      formato: "legenda",
      variantes: 1,
      status: "renderizando",
      etapa: "A IA está gravando seu vídeo (3 a 5 min)",
      duracao: dur,
    },
  });

  // 2. a geração de verdade roda em BACKGROUND, depois da resposta (a pessoa pode
  // fechar a aba). O serverrk tem fila: se tiver gente na frente, espera a vez.
  const userId = user.id;
  after(async () => {
    // guarda as MÍDIAS DE ENTRADA (avatar usado + fotos do produto) no job: o
    // admin vê nos Reportes o que a pessoa mandou vs o que saiu. Falha não trava.
    try {
      const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
      const fotosUrls: string[] = [];
      for (let i = 0; i < produtos.length; i++) {
        const p = produtos[i];
        const u = await subirAvatar(`entrada-${job.id}-${i}.${p.ext}`, p.bytes, MIME[p.ext] ?? "image/png");
        if (u) fotosUrls.push(u);
      }
      // livre com a 1ª imagem vinda do celular (data URL): sobe ela também
      if (livre && !avatarUrlEntrada) {
        avatarUrlEntrada =
          (await subirAvatar(`entrada-${job.id}-a.${avatar.ext}`, avatar.bytes, MIME[avatar.ext] ?? "image/png")) ??
          null;
      }
      await prisma.job.update({
        where: { id: job.id },
        data: {
          opcoes: JSON.stringify({
            entrada: {
              avatarUrl: avatarUrlEntrada,
              produtoFotos: fotosUrls,
              cenario: body.cenario ?? null,
              comFala,
              plataforma,
              imagemUnica,
              ...(livre ? { livre: true, promptLivre: textoLivre } : {}),
            },
          }),
        },
      });
    } catch (e) {
      console.error("[avatar-video] falhou ao guardar as entradas", e);
    }

    try {
      const r = await gerarVideoGrok({
        prompt,
        avatar,
        produtos,
        cenarioRef: cenarioRef ?? undefined,
        duracaoSeg: dur,
        qualidade: body.qualidade || "720p",
        semAudio: !comFala,
      });

      if (!r.ok || !r.videoUrl) {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "erro", etapa: null, erro: r.erro ?? "Falha ao gerar o vídeo." },
        });
        await criarNotificacao({
          userId,
          tipo: "video_erro",
          titulo: "Falha ao gerar seu vídeo",
          mensagem: `Não consegui gerar "${nomeVideo}". Tente de novo (não descontamos créditos).`,
          link: "/painel",
          jobId: job.id,
        }).catch(() => {});
        return;
      }

      // cobra SÓ agora que o vídeo saiu (falha não desconta). Admin/demo não pagam.
      // debitarClamp nunca deixa negativo: se o saldo mudou, cobra o que der.
      if (!isAdmin) {
        await debitarClamp(userId, custo, "debito_geracao", {
          descricao: `${livre ? "Vídeo livre" : "Vídeo com avatar"} (${dur}s, ${comFala ? "com fala" : "sem fala"})`,
          jobId: job.id,
        }).catch(() => {});
      }

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "pronto",
          etapa: null,
          saidas: JSON.stringify([r.videoUrl]),
          midias: JSON.stringify([{ arquivo: r.videoUrl, ...(r.thumbUrl ? { thumb: r.thumbUrl } : {}) }]),
        },
      });
      await criarNotificacao({
        userId,
        tipo: "video_pronto",
        titulo: "Seu vídeo com avatar ficou pronto!",
        mensagem: `"${nomeVideo}" já está em Meus vídeos.`,
        link: "/painel",
        jobId: job.id,
      }).catch(() => {});
    } catch (e) {
      console.error("[avatar-video] geração em background falhou", e);
      await prisma.job
        .update({
          where: { id: job.id },
          data: { status: "erro", etapa: null, erro: "Falha inesperada ao gerar. Tente de novo." },
        })
        .catch(() => {});
    }
  });

  // 3. responde na hora: a UI manda a pessoa acompanhar em Meus vídeos.
  // O prompt (a "receita") só volta pro admin ver/copiar.
  return NextResponse.json({
    ok: true,
    jobId: job.id,
    custo,
    ...(user.role === "admin" ? { prompt } : {}),
  });
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
