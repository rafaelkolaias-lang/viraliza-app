import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { AVISO_PAUSADO, CHAVES, podeGerar } from "@/lib/configuracao";
import { montarPromptImagemLab } from "@/lib/lab-prompt";
import { estiloPorChave, variacaoPovPorChave } from "@/lib/estilos-camera";
import { baixarImagemEntrada, dataUrlParaEntrada } from "@/lib/imagem-entrada";
import { gerarImagemGrok } from "@/lib/imagem-robot";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { CUSTO_IMAGEM_LAB } from "@/lib/lab-custos";
import { salvarNaGaleria } from "@/lib/galeria-servidor";
import { cenarioDoUsuario } from "@/lib/cenarios-usuario";
import { midiaCenario } from "@/lib/lab-midia";

export const runtime = "nodejs";
export const maxDuration = 800;

/**
 * Gera a IMAGEM do Viraliza Lab (avatar + produto na cena escolhida).
 *
 * Motor: robô do Grok no serverrk (só ele; o gpt-image ficou de fora por custo e
 * por bloquear roupa comum na moderação). Qual conta do Grok usa vem do
 * imagem-robot.ts (env GROK_CONTA_IMAGEM). Só cobra depois que a imagem existe.
 *
 * O resultado entra sozinho em "Minhas imagens" com o contexto da cena, pra
 * pessoa nunca perder o que já pagou. Salvar como INFLUENCIADOR continua sendo
 * um clique dela, senão a galeria de avatares enche de tentativa descartada.
 */

/** Mapa cenário do Lab -> cenário do motor (mesma lista do lab-cenario.tsx). */
const CENARIO_MOTOR: Record<string, string | undefined> = {
  casa: "sala",
  casa_simples: "sala_tijolo",
  ar_livre: "quintal",
  cozinha: "cozinha",
  quarto: "quarto",
  // "academia" saiu daqui de propósito: agora cada academia tem foto própria e a
  // descrição específica dela fica no CENARIO_LIVRE (a genérica do motor perdia
  // o estilo da foto que a pessoa escolheu)
};
const CENARIO_LIVRE: Record<string, string> = {
  estudio: "a simple photo studio with a plain seamless backdrop and soft softbox light",
  escritorio: "a simple office with a desk, chair and a computer blurred in the background",
  banheiro: "an ordinary home bathroom, sink with mirror and light tiles blurred behind",
  praia: "a sunny Brazilian beach, sand and sea blurred in the background",
  cafeteria: "a cozy coffee shop, wooden counter and tables blurred in the background",
  loja: "the inside of a clothing store, racks and shelves blurred in the background",
  // ---- cenários com foto de exemplo (media/lab/cenarios/<chave>.jpg) ----
  academia:
    "a modern gym free weights area with benches, racks and machines, yellow pillars and a high blue industrial ceiling, bright daylight from big windows",
  academia_mov:
    "a busy modern gym with a few people training far in the blurred background, blue industrial ceiling with square led light frames, benches and barbell racks",
  academia_escura:
    "a spacious gym with a dark ceiling full of small spotlights, light wooden floor and black weight machines",
  academia_amarela:
    "a gym dumbbells area with yellow pillars, large wall mirrors, racks of dumbbells and weight plates, blue industrial ceiling",
  academia_verde:
    "a gym with lime green and yellow pillars, black ceiling with rectangular led light frames and dark rubber floor tiles",
  quarto_clean:
    "a minimalist cream bedroom corner with an arched black floor mirror, fluffy rug, pampas grass in a vase and sheer white curtains, soft daylight",
  quarto_tv:
    "a simple real Brazilian bedroom with a floral bedspread, a wall mounted TV and light curtains, natural daylight",
  gamer_rgb:
    "a gamer room glowing with red and blue RGB led strips, desk with dual monitors and a gaming chair, light haze",
  gamer_azul:
    "a gaming corner bathed in cyan blue led light, white gaming chair, dual monitors and glowing shelves with collectible figures",
  neon_roxo:
    "a bedroom lit by purple and pink neon lights, dark shelves with decor and neon signs on the wall, moody night vibe",
  estudio_neon:
    "a dark room with a purple neon strip along the ceiling, black walls, white floating shelves with collectibles and purple hanging bulbs",
  galeria:
    "a bright minimalist room with framed black and white prints arranged on a white wall, soft daylight",
  camarim:
    "a bright dressing room corner with a hollywood style mirror framed by warm glowing bulbs, white paneled wall and a small stool with flowers",
  loja_tech:
    "the inside of a premium electronics store, backlit shelves neatly displaying gadgets and headphones",
  cidade:
    "a modern downtown street with tall glass office buildings, string lights and stone pavement on a sunny day",
  parque: "a green city park with a wide lawn and leafy trees on a sunny day, blue sky with soft clouds",
  varanda:
    "a wooden balcony deck with a railing overlooking green forest hills and mountains, blue sky",
  por_do_sol:
    "a riverside boardwalk at golden sunset, wooden deck, lamp posts and calm water reflecting the sun",
  resort:
    "a tropical resort wooden boardwalk over clear turquoise shallow sea, bright blue sky, white gazebos in the distance",
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  if (!(await podeGerar(CHAVES.geracaoImagem, user.role))) {
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
    // só pra galeria "Minhas imagens" conseguir remontar a cena depois
    produtoId?: string;
    produtoMeu?: boolean;
    avatarId?: string;
    avatarNome?: string;
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

  // A FOTO do cenário é a referência de LUGAR: vai como ÚLTIMA imagem anexada e
  // o prompt manda usar EXATAMENTE aquele ambiente (foto > descrição escrita).
  let cenarioFoto: { base64: string; mime: string } | null = null;
  if (cenario.startsWith("meu:")) {
    // cenário PRÓPRIO: a foto que a pessoa subiu (obrigatória — sem ela não gera)
    const meu = await cenarioDoUsuario(user.id, cenario.slice(4));
    if (!meu) {
      return NextResponse.json({ erro: "Esse cenário não existe mais." }, { status: 400 });
    }
    cenarioFoto = await baixarImagemEntrada(meu.imagemUrl);
    if (!cenarioFoto) {
      return NextResponse.json(
        { erro: "Não consegui ler a foto do seu cenário. Tente subir de novo." },
        { status: 400 },
      );
    }
  } else if (cenario !== "outros" && /^[a-z0-9_]+$/.test(cenario)) {
    // cenário da PLATAFORMA: usa a MESMA foto do card (media/lab/cenarios/<chave>.jpg).
    // A foto é obrigatória: o que a pessoa viu no card é o que entra na geração.
    cenarioFoto = await baixarImagemEntrada(midiaCenario(cenario));
    if (!cenarioFoto) {
      return NextResponse.json(
        { erro: "Não consegui carregar a foto desse cenário. Tente de novo em instantes." },
        { status: 502 },
      );
    }
  }

  // demo entra junto com admin: em todo o resto do app ela gera sem pagar
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

  // a variação só existe no estilo Mãos (POV): segurando ou produto parado
  const variacao = estilo.chave === "maos" ? variacaoPovPorChave(body.variacao) : null;

  const prompt = montarPromptImagemLab({
    estilo: estilo.chave,
    cena,
    cenario,
    cenarioTexto: body.cenarioTexto,
    cenarioMotor: CENARIO_MOTOR[cenario],
    cenarioLivre: CENARIO_LIVRE[cenario],
    cenarioFoto: !!cenarioFoto,
    comAvatar,
    produtoNome: body.produtoNome,
    variacaoExtra: variacao?.extra,
    semMaos: variacao ? !variacao.temMaos : false,
  });

  // ordem das imagens: pessoa primeiro (identidade), produto depois e, se tiver,
  // a foto do cenário próprio POR ÚLTIMO (o prompt chama ela de "LAST photo")
  const entradas = comAvatar && avatar ? [avatar, produto] : [produto];
  if (cenarioFoto) entradas.push(cenarioFoto);

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

  // Toda imagem gerada entra em "Minhas imagens" com as escolhas que a criaram:
  // é isso que deixa o card virar "Novo vídeo" sem refazer a imagem. Virar
  // INFLUENCIADOR continua sendo escolha dela (botão "Salvar como influencer").
  const imagemId = await salvarNaGaleria({
    userId: user.id,
    origem: "lab",
    titulo: body.produtoNome || `Imagem do Lab (${estilo.label})`,
    imagemUrl: url,
    contexto: {
      estilo: estilo.chave,
      variacao: variacao?.chave ?? null,
      cena,
      cenario,
      cenarioTexto: body.cenarioTexto,
      produtoId: body.produtoId,
      produtoTitulo: body.produtoNome,
      produtoImagem: body.produtoImagem,
      produtoMeu: !!body.produtoMeu,
      avatarId: body.avatarId,
      avatarNome: body.avatarNome,
      avatarImagem: body.avatarUrl,
    },
  });

  return NextResponse.json({
    ok: true,
    imagemUrl: url,
    imagemId,
    motor: "grok",
    custo: isAdmin ? 0 : CUSTO_IMAGEM_LAB,
    // o prompt cru é só pra depuração do admin (demo não vê)
    ...(user.role === "admin" ? { prompt } : {}),
  });
}
