import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { AVISO_PAUSADO, CHAVES, podeGerar } from "@/lib/configuracao";
import { montarPromptCenaFruta } from "@/lib/viral-boost-prompt";
import { resolverBoost, type CorpoBoost } from "@/lib/boost-servidor";
import { baixarImagemEntrada } from "@/lib/imagem-entrada";
import { gerarImagemGrok } from "@/lib/imagem-robot";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { CUSTO_IMAGEM_LAB } from "@/lib/lab-custos";
import { salvarNaGaleria } from "@/lib/galeria-servidor";

export const runtime = "nodejs";
export const maxDuration = 800;

/**
 * Gera a CENA da historinha de fruta (a foto que depois vira o vídeo).
 *
 * Ela existe por um motivo técnico: o motor só aceita UMA imagem de referência
 * num vídeo de 15s. Aqui o vídeo é de 10s (que aceita as três fotos), então a
 * cena virou OPCIONAL: serve pra quem quer ver o quadro antes de gerar.
 * triângulo passam a caber. De quebra a pessoa vê a cena antes de gastar o vídeo.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await podeGerar(CHAVES.geracaoImagem, user.role))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }

  let body: CorpoBoost = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const r0 = await resolverBoost(body, user.id);
  if (!r0.ok) return NextResponse.json({ erro: r0.erro }, { status: 400 });
  const { h, frutas, cenario, formato } = r0.dados;

  const isAdmin = user.role === "admin" || user.role === "demo";
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < CUSTO_IMAGEM_LAB) {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo: CUSTO_IMAGEM_LAB },
        { status: 402 },
      );
    }
  }

  // as fotos das frutas são as referências, na ordem dos papéis
  const imagens = [];
  for (const f of frutas) {
    const img = await baixarImagemEntrada(f.imagem);
    if (!img) {
      return NextResponse.json({ erro: `Não consegui carregar ${f.nome}.` }, { status: 502 });
    }
    imagens.push({ base64: img.base64, mime: img.mime });
  }

  const prompt = montarPromptCenaFruta({ h, frutas, cenario, formato });
  const r = await gerarImagemGrok({ prompt, imagens });
  if (!r?.imagemUrl) {
    return NextResponse.json(
      { erro: "Não consegui montar a cena agora. Tente de novo (não descontamos créditos)." },
      { status: 502 },
    );
  }

  if (!isAdmin) {
    await debitarClamp(user.id, CUSTO_IMAGEM_LAB, "debito_geracao", {
      descricao: `Cena da historinha (${h.nome})`,
    }).catch(() => {});
  }

  // a cena também fica guardada em "Minhas imagens" (sem contexto: o vídeo dela
  // sai daqui do Boost, com as falas da historinha)
  await salvarNaGaleria({
    userId: user.id,
    origem: "boost",
    titulo: `${h.nome} (${frutas.map((f) => f.nome).join(", ")})`,
    imagemUrl: r.imagemUrl,
  });

  return NextResponse.json({
    ok: true,
    imagemUrl: r.imagemUrl,
    custo: isAdmin ? 0 : CUSTO_IMAGEM_LAB,
    ...(user.role === "admin" ? { prompt } : {}),
  });
}
