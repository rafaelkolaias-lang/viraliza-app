import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { AVISO_PAUSADO, CHAVES, podeGerar } from "@/lib/configuracao";
import { montarJsonAvatar, promptImagemAvatar } from "@/lib/avatar-json";
import type { EscolhasAvatar } from "@/lib/avatar-modelo";
import { gerarImagemGrok, grokImagemConfigurado } from "@/lib/imagem-robot";
import { baixarImagemEntrada } from "@/lib/imagem-entrada";
import { midiaPele, midiaCabeloEstilo, midiaCorpo } from "@/lib/lab-midia";
import { CABELO_ESTILOS } from "@/lib/avatar-modelo";
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
/**
 * Explica pro motor o que cada foto de referência governa. Sem isso ele copia o
 * ROSTO das amostras (a foto de pele e a de corte têm gente nelas) e o
 * influenciador sai com a cara da modelo da amostra, não com a que o texto pediu.
 */
function blocoReferencias(quantas: number): string {
  if (!quantas) return "";
  return [
    `REFERENCE IMAGES (${quantas} attached), READ CAREFULLY: each attached photo is a MATERIAL SAMPLE, never an identity.`,
    "Reference 1 = SKIN TONE and skin texture only. Reference 2 = HAIRCUT shape and hair texture only. Reference 3 = BODY TYPE and proportions only.",
    "Do NOT copy the face, the eyes, the nose, the mouth, the expression, the clothes, the pose, the background or the framing of ANY reference. Copy only the specific attribute listed for each one.",
    "The face and the identity come from the written description above, not from the photos.",
  ].join(" ");
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  }
  if (!(await podeGerar(CHAVES.geracaoImagem, user.role))) {
    return NextResponse.json({ erro: AVISO_PAUSADO, pausado: true }, { status: 503 });
  }
  if (!grokImagemConfigurado()) {
    return NextResponse.json({ erro: "Geração de imagem indisponível agora." }, { status: 503 });
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
    // trava no servidor (a tela vai de 18 a 70, mas a rota aceitava qualquer
    // número vindo de fora, inclusive idade de menor)
    idade: Math.min(70, Math.max(18, Number(body.idade) || 26)),
    tomPele: String(body.tomPele ?? "morena"),
    formatoRosto: String(body.formatoRosto ?? "oval"),
    olhos: String(body.olhos ?? "castanho_escuro"),
    cabeloCor: String(body.cabeloCor ?? "castanho"),
    cabeloEstilo: body.cabeloEstilo ? String(body.cabeloEstilo) : undefined,
    cabeloComprimento: String(body.cabeloComprimento ?? "ombro"),
    cabeloTextura: String(body.cabeloTextura ?? "ondulado"),
    tipoFisico: String(body.tipoFisico ?? "magra"),
    expressao: String(body.expressao ?? "sorriso_leve"),
    maquiagem: String(body.maquiagem ?? "leve"),
    marcas: String(body.marcas ?? ""),
    cenario: String(body.cenario ?? "quarto"),
    estilo: String(body.estilo ?? "natural"),
    camisa: body.camisa ? String(body.camisa) : undefined,
    camisaCor: body.camisaCor ? String(body.camisaCor).slice(0, 20) : undefined,
    camisaTipo: body.camisaTipo ? String(body.camisaTipo) : undefined,
    barba: !!body.barba,
    oculos: !!body.oculos,
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

  // As fotos que a pessoa escolheu no assistente (pele, corte de cabelo e tipo
  // físico) já estão no serverrk e vão junto como REFERÊNCIA. Além de acertar
  // muito mais, é o que faz o Imagine devolver UMA imagem: sem nenhuma foto
  // anexada ele sempre gera quatro variações.
  const genero = escolhas.genero === "male" ? "male" : "female";
  const corte = CABELO_ESTILOS.find((c) => c.chave === escolhas.cabeloEstilo);
  const referencias = [
    midiaPele(escolhas.tomPele),
    corte ? midiaCabeloEstilo(corte.genero, corte.chave) : null,
    midiaCorpo(genero, escolhas.tipoFisico),
  ].filter((u): u is string => !!u);

  const imagens = (await Promise.all(referencias.map((u) => baixarImagemEntrada(u))))
    .filter((i) => !!i)
    .map((i) => ({ base64: i!.base64, mime: i!.mime }));

  // Motor: robô do Grok, o mesmo da imagem do Lab e do vídeo. Ele já devolve a
  // foto hospedada no serverrk, então não precisa subir nada aqui.
  const r = await gerarImagemGrok({ prompt: `${prompt} ${blocoReferencias(imagens.length)}`.trim(), imagens });
  const url = r?.imagemUrl ?? null;
  if (!url) {
    return NextResponse.json(
      { erro: "Não consegui gerar a foto agora. Tente de novo (não descontamos créditos)." },
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
