import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { AVISO_PAUSADO, CHAVES, estaLigado } from "@/lib/configuracao";
import { editarImagem, openaiConfigurado } from "@/lib/openai-image";
import { promptAvatarComProduto } from "@/lib/avatar-foto";
import { dataUrlParaEntrada, baixarImagemEntrada } from "@/lib/imagem-entrada";
import { subirAvatar } from "@/lib/serverrk-upload";
import { CUSTO_AVATAR, registrarAvatar } from "@/lib/avatares";
import { getCarteira, debitar } from "@/lib/creditos";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * "Avatar com produto": junta a PESSOA (um avatar salvo -> `pessoaUrl`, OU uma foto
 * enviada -> `pessoaFoto`) com a FOTO DO PRODUTO (`produtoFoto`) e gera a imagem da
 * pessoa usando o produto (segurando, passando no rosto/cabelo, vestindo...), tudo
 * no gpt-image-1 (image-to-image). Cobra CUSTO_AVATAR (admin/demo nao pagam), so
 * DEPOIS de pronta e hospedada. A imagem entra na galeria como um avatar novo.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await estaLigado(CHAVES.geracaoImagem))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }
  if (!openaiConfigurado()) {
    return NextResponse.json({ erro: "Geração indisponível no momento." }, { status: 503 });
  }

  let body: {
    nome?: string;
    pessoaUrl?: string;
    pessoaFoto?: string;
    produtoFoto?: string;
    uso?: string;
    produtoNome?: string;
    genero?: string;
    cenario?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) {
    return NextResponse.json({ erro: "Dê um nome à imagem." }, { status: 400 });
  }

  // pessoa: prioriza avatar salvo (URL); senão a foto enviada
  const pessoa = body.pessoaUrl
    ? await baixarImagemEntrada(body.pessoaUrl)
    : dataUrlParaEntrada(body.pessoaFoto);
  if (!pessoa) {
    return NextResponse.json(
      { erro: "Escolha um avatar salvo ou envie uma foto de pessoa válida." },
      { status: 400 },
    );
  }

  const produto = dataUrlParaEntrada(body.produtoFoto);
  if (!produto) {
    return NextResponse.json(
      { erro: "Envie a foto do produto (JPG ou PNG, até 12MB)." },
      { status: 400 },
    );
  }

  const uso = String(body.uso ?? "segurando");

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

  // 2. gera a imagem: pessoa (base) + produto (referencia), no cenário escolhido
  const prompt = promptAvatarComProduto(uso, body.produtoNome, body.cenario);
  const img = await editarImagem(prompt, [pessoa, produto]);
  if (!img) {
    return NextResponse.json(
      { erro: "Não consegui gerar a imagem agora. Tente de novo (não descontamos créditos)." },
      { status: 502 },
    );
  }

  // 3. sobe pro serverrk
  const url = await subirAvatar(`${randomUUID()}.png`, Buffer.from(img.base64, "base64"), img.mime);
  if (!url) {
    return NextResponse.json(
      { erro: "Falha ao salvar a imagem. Tente de novo (não descontamos créditos)." },
      { status: 502 },
    );
  }

  // 4. cobra e registra
  if (!isAdmin) {
    try {
      await debitar(user.id, CUSTO_AVATAR, "debito_geracao", { descricao: `Avatar com produto "${nome}"` });
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
    escolhas: { origem: "produto", uso, produtoNome: body.produtoNome ?? "", cenario: body.cenario ?? "" },
  });

  return NextResponse.json({ ok: true, avatar });
}
