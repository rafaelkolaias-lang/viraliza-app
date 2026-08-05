import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { gerarPromptIA, type ImagemVisao } from "@/lib/gerador-prompt";
import { IDIOMAS_FALA } from "@/lib/avatar-modelo";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { CUSTO_PROMPT_LAB } from "@/lib/lab-custos";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Gerador de prompt: recebe as fotos (avatar opcional + produto), o que a pessoa
 * quer e o formato (normal UGC ou JSON), e devolve o prompt pronto escrito pela
 * IA seguindo a metodologia da aula.
 *
 * Cobra `CUSTO_PROMPT_LAB` créditos, e SÓ NO SUCESSO: o saldo é conferido antes
 * de chamar a IA (pra pessoa levar o aviso em vez de esperar à toa) e o desconto
 * acontece depois que o prompt volta pronto. Falha da IA não cobra nada.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let body: {
    avatarFoto?: string; // data URL da pessoa (opcional)
    produtoFotos?: string[]; // data URLs do produto (1 a 3)
    descricao?: string;
    formato?: string; // "normal" | "json"
    duracao?: number;
    comFala?: boolean;
    idioma?: string; // chave de IDIOMAS_FALA
    estilo?: string; // chave de ESTILOS_VIDEO (ugc padrão)
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const paraImagem = (dataUrl: unknown): ImagemVisao | null => {
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl ?? ""));
    return m ? { mime: m[1], base64: m[2] } : null;
  };

  const imagens: ImagemVisao[] = [];
  const avatarImg = body.avatarFoto ? paraImagem(body.avatarFoto) : null;
  if (avatarImg) imagens.push(avatarImg);
  for (const f of (Array.isArray(body.produtoFotos) ? body.produtoFotos : []).slice(0, 3)) {
    const img = paraImagem(f);
    if (img) imagens.push(img);
  }
  if (!imagens.length) {
    return NextResponse.json(
      { erro: "Envie ao menos 1 foto (do produto ou do avatar)." },
      { status: 400 },
    );
  }

  // demo entra junto com admin: em todo o resto do app ela gera sem pagar
  const isAdmin = user.role === "admin" || user.role === "demo";
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < CUSTO_PROMPT_LAB) {
      return NextResponse.json(
        {
          erro: `Você precisa de ${CUSTO_PROMPT_LAB} créditos pra gerar o prompt. Compre na aba Créditos.`,
          faltaCreditos: true,
          custo: CUSTO_PROMPT_LAB,
        },
        { status: 402 },
      );
    }
  }

  const prompt = await gerarPromptIA(
    imagens,
    {
      temAvatar: !!avatarImg,
      descricao: typeof body.descricao === "string" ? body.descricao.slice(0, 600) : undefined,
      formato: body.formato === "json" ? "json" : "normal",
      duracaoSeg: Number(body.duracao) === 10 ? 10 : Number(body.duracao) === 15 ? 15 : 6,
      comFala: body.comFala !== false,
      idiomaFala:
        IDIOMAS_FALA.find((i) => i.chave === body.idioma)?.fala ?? IDIOMAS_FALA[0].fala,
      estilo: typeof body.estilo === "string" ? body.estilo : undefined,
    },
    user.id,
  );

  if (!prompt) {
    return NextResponse.json(
      { erro: "Não consegui gerar agora. Tente de novo em instantes (não descontamos créditos)." },
      { status: 502 },
    );
  }

  if (!isAdmin) {
    await debitarClamp(user.id, CUSTO_PROMPT_LAB, "debito_geracao", {
      descricao: "Gerador de prompt",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, prompt });
}
