import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { AVISO_PAUSADO, CHAVES, estaLigado } from "@/lib/configuracao";
import { montarPromptImagemLab } from "@/lib/lab-prompt";
import { estiloPorChave, variacaoPovPorChave } from "@/lib/estilos-camera";
import { baixarImagemEntrada, dataUrlParaEntrada } from "@/lib/imagem-entrada";
import { gerarImagemGrok } from "@/lib/imagem-robot";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { CUSTO_IMAGEM_LAB } from "@/lib/lab-custos";

export const runtime = "nodejs";
export const maxDuration = 800;

/**
 * Gera a IMAGEM do Viraliza Lab (avatar + produto na cena escolhida).
 *
 * Motor: robô do Grok no serverrk (só ele; o gpt-image ficou de fora por custo e
 * por bloquear roupa comum na moderação). Qual conta do Grok usa vem do
 * imagem-robot.ts (env GROK_CONTA_IMAGEM). Só cobra depois que a imagem existe;
 * quem salva na galeria é o botão "Salvar como influencer" da tela.
 */

/** Mapa cenário do Lab -> cenário do motor (mesma lista do lab-cenario.tsx). */
const CENARIO_MOTOR: Record<string, string | undefined> = {
  casa: "sala",
  ar_livre: "quintal",
  academia: "academia",
  cozinha: "cozinha",
  quarto: "quarto",
};
const CENARIO_LIVRE: Record<string, string> = {
  estudio: "a simple photo studio with a plain seamless backdrop and soft softbox light",
  escritorio: "a simple office with a desk, chair and a computer blurred in the background",
  banheiro: "an ordinary home bathroom, sink with mirror and light tiles blurred behind",
  praia: "a sunny Brazilian beach, sand and sea blurred in the background",
  cafeteria: "a cozy coffee shop, wooden counter and tables blurred in the background",
  loja: "the inside of a clothing store, racks and shelves blurred in the background",
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await estaLigado(CHAVES.geracaoImagem))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }

  let body: {
    estilo?: string;
    cena?: string;
    cenario?: string;
    cenarioTexto?: string;
    produtoImagem?: string; // URL (Shopee/meus) ou dataURL
    produtoNome?: string;
    avatarUrl?: string; // URL do avatar; vazio = sem pessoa (POV)
    variacao?: string; // POV: "maos" (segurando) ou "parado" (produto na bancada)
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  const estilo = estiloPorChave(body.estilo);
  const cena = String(body.cena ?? "").trim();
  const cenario = String(body.cenario ?? "").trim();
  if (!estilo || cena.length < 15 || !cenario) {
    return NextResponse.json(
      { erro: "Faltou escolher o estilo, a descrição da cena ou o cenário." },
      { status: 400 },
    );
  }

  const produto =
    (await baixarImagemEntrada(body.produtoImagem)) ?? dataUrlParaEntrada(body.produtoImagem);
  if (!produto) {
    return NextResponse.json({ erro: "Não consegui ler a foto do produto." }, { status: 400 });
  }

  // POV (Mãos) ou "Nenhum": sem foto de pessoa, a IA cria mãos/pessoa anônima
  const avatar = body.avatarUrl ? await baixarImagemEntrada(body.avatarUrl) : null;
  const comAvatar = !!avatar;

  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < CUSTO_IMAGEM_LAB) {
      return NextResponse.json(
        { erro: "Créditos insuficientes.", faltaCreditos: true, custo: CUSTO_IMAGEM_LAB },
        { status: 402 },
      );
    }
  }

  // a variação só existe no estilo Mãos (POV): segurando ou produto parado
  const variacao = estilo.chave === "maos" ? variacaoPovPorChave(body.variacao) : null;

  const prompt = montarPromptImagemLab({
    estilo: estilo.chave,
    cena,
    cenario,
    cenarioTexto: body.cenarioTexto,
    cenarioMotor: CENARIO_MOTOR[cenario],
    cenarioLivre: CENARIO_LIVRE[cenario],
    comAvatar,
    produtoNome: body.produtoNome,
    variacaoExtra: variacao?.extra,
    semMaos: variacao ? !variacao.temMaos : false,
  });

  // ordem das imagens: pessoa primeiro (identidade), produto depois
  const entradas = comAvatar && avatar ? [avatar, produto] : [produto];

  // Motor: robô do Grok (decisão do Lucas: só Grok aqui, sem cair no gpt-image,
  // que além de custar tem moderação sensível demais com roupa).
  const noGrok = await gerarImagemGrok({
    prompt,
    imagens: entradas.map((i) => ({ base64: i.base64, mime: i.mime })),
  });
  const url = noGrok?.imagemUrl ?? null;

  if (!url) {
    return NextResponse.json(
      {
        erro: "Não consegui gerar a imagem agora. Tente de novo em instantes (não descontamos créditos).",
      },
      { status: 502 },
    );
  }

  if (!isAdmin) {
    await debitarClamp(user.id, CUSTO_IMAGEM_LAB, "debito_geracao", {
      descricao: `Imagem do Lab (${estilo.label})`,
    }).catch(() => {});
  }

  // NÃO salva sozinho na galeria: a pessoa costuma gerar algumas vezes até
  // gostar. Quem salva é o botão "Salvar como influencer" (POST /api/avatar/subir
  // com a url), pra galeria não encher de tentativa descartada.
  return NextResponse.json({
    ok: true,
    imagemUrl: url,
    motor: "grok",
    custo: isAdmin ? 0 : CUSTO_IMAGEM_LAB,
    ...(isAdmin ? { prompt } : {}),
  });
}
