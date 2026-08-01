import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { AVISO_PAUSADO, CHAVES, estaLigado } from "@/lib/configuracao";
import { montarJsonAvatar, promptImagemAvatar } from "@/lib/avatar-json";
import type { EscolhasAvatar } from "@/lib/avatar-modelo";
import { gerarImagem, openaiConfigurado } from "@/lib/openai-image";
import { subirAvatar } from "@/lib/serverrk-upload";
import { CUSTO_AVATAR, registrarAvatar } from "@/lib/avatares";
import { getCarteira, debitar } from "@/lib/creditos";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cria o avatar de verdade: monta o JSON do quiz, vira prompt, gera a foto no
 * gpt-image-1 (OpenAI), sobe pro serverrk (media.univershoop.com/avatares) e
 * registra no banco. Cobra CUSTO_AVATAR creditos (admin/demo nao pagam). So debita
 * DEPOIS da foto pronta e hospedada, entao falha nao cobra.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }
  if (!(await estaLigado(CHAVES.geracaoImagem))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }
  if (!openaiConfigurado()) {
    return NextResponse.json({ erro: "Geração indisponível no momento." }, { status: 503 });
  }

  let body: Partial<EscolhasAvatar> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  if (nome.length < 2) {
    return NextResponse.json({ erro: "Dê um nome ao avatar." }, { status: 400 });
  }

  const escolhas: EscolhasAvatar = {
    nome,
    genero: body.genero === "male" ? "male" : "female",
    idade: Number(body.idade) || 26,
    tomPele: String(body.tomPele ?? "morena_clara"),
    formatoRosto: String(body.formatoRosto ?? "oval"),
    olhos: String(body.olhos ?? "castanho_escuro"),
    cabeloCor: String(body.cabeloCor ?? "castanho_escuro"),
    cabeloComprimento: String(body.cabeloComprimento ?? "ombro"),
    cabeloTextura: String(body.cabeloTextura ?? "ondulado"),
    tipoFisico: String(body.tipoFisico ?? "magra"),
    expressao: String(body.expressao ?? "sorriso_leve"),
    maquiagem: String(body.maquiagem ?? "leve"),
    marcas: String(body.marcas ?? ""),
    cenario: String(body.cenario ?? "quarto"),
    estilo: String(body.estilo ?? "natural"),
  };

  const isAdmin = user.role === "admin" || user.role === "demo";

  // 1. checa saldo ANTES de gastar a chamada da OpenAI (usuario pagante)
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < CUSTO_AVATAR) {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo: CUSTO_AVATAR },
        { status: 402 },
      );
    }
  }

  // 2. monta JSON + prompt e gera a foto
  const json = montarJsonAvatar(escolhas);
  const prompt = promptImagemAvatar(json);

  const img = await gerarImagem(prompt);
  if (!img) {
    return NextResponse.json(
      { erro: "Não consegui gerar a foto agora. Tente de novo (não descontamos créditos)." },
      { status: 502 },
    );
  }

  // 3. sobe pro serverrk
  const nomeArquivo = `${randomUUID()}.png`;
  const url = await subirAvatar(nomeArquivo, Buffer.from(img.base64, "base64"), img.mime);
  if (!url) {
    return NextResponse.json(
      { erro: "Falha ao salvar o avatar. Tente de novo (não descontamos créditos)." },
      { status: 502 },
    );
  }

  // 4. cobra os creditos (so agora que deu tudo certo) e registra
  if (!isAdmin) {
    try {
      await debitar(user.id, CUSTO_AVATAR, "debito_geracao", {
        descricao: `Avatar "${escolhas.nome}"`,
      });
    } catch {
      // saldo mudou entre a checagem e agora: nao registra o avatar
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo: CUSTO_AVATAR },
        { status: 402 },
      );
    }
  }

  const avatar = await registrarAvatar({
    userId: user.id,
    nome: escolhas.nome,
    genero: escolhas.genero,
    imagemUrl: url,
    escolhas,
  });

  return NextResponse.json({
    ok: true,
    avatar,
    // so o admin ve o prompt/JSON (o "segredo" da camada travada)
    ...(user.role === "admin" ? { json, prompt } : {}),
  });
}
