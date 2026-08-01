import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { AVISO_PAUSADO, CHAVES, podeGerar } from "@/lib/configuracao";
import { gerarImagemGrok, grokImagemConfigurado } from "@/lib/imagem-robot";
import { promptAvatarDaFoto } from "@/lib/avatar-foto";
import { dataUrlParaEntrada } from "@/lib/imagem-entrada";
import { CUSTO_AVATAR, registrarAvatar } from "@/lib/avatares";
import { getCarteira, debitar } from "@/lib/creditos";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * "Avatar da minha foto": recebe UMA foto real da pessoa (data URL), gera um retrato
 * de avatar dela no gpt-image-1 (image-to-image), sobe pro serverrk e registra.
 * Cobra CUSTO_AVATAR (admin/demo nao pagam), so DEPOIS da foto pronta e hospedada.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await podeGerar(CHAVES.geracaoImagem, user.role))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }
  if (!grokImagemConfigurado()) {
    return NextResponse.json({ erro: "Geração de imagem indisponível agora." }, { status: 503 });
  }

  let body: { nome?: string; foto?: string; genero?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) {
    return NextResponse.json({ erro: "Dê um nome ao avatar." }, { status: 400 });
  }

  const foto = dataUrlParaEntrada(body.foto);
  if (!foto) {
    return NextResponse.json({ erro: "Envie uma foto válida (JPG ou PNG, até 12MB)." }, { status: 400 });
  }

  const isAdmin = user.role === "admin" || user.role === "demo";

  // 1. checa saldo ANTES de gastar a chamada da OpenAI
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < CUSTO_AVATAR) {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo: CUSTO_AVATAR },
        { status: 402 },
      );
    }
  }

  // 2. gera a foto do avatar a partir da foto real
  const r = await gerarImagemGrok({
    prompt: promptAvatarDaFoto(),
    imagens: [{ base64: foto.base64, mime: foto.mime }],
  });
  // o Grok já devolve a foto hospedada no serverrk
  const url = r?.imagemUrl ?? null;
  if (!url) {
    return NextResponse.json(
      { erro: "Não consegui gerar o avatar agora. Tente de novo (não descontamos créditos)." },
      { status: 502 },
    );
  }

  // 4. cobra e registra
  if (!isAdmin) {
    try {
      await debitar(user.id, CUSTO_AVATAR, "debito_geracao", { descricao: `Avatar "${nome}" (foto)` });
    } catch {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo: CUSTO_AVATAR },
        { status: 402 },
      );
    }
  }

  const avatar = await registrarAvatar({
    userId: user.id,
    nome,
    genero: body.genero === "male" ? "male" : "female",
    imagemUrl: url,
    escolhas: { origem: "foto" },
  });

  return NextResponse.json({ ok: true, avatar });
}
