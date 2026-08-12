import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import {
  geminiConfigurado,
  posicionarCenas,
  type CaixaFalha,
  type CenaParaPosicionar,
} from "@/lib/gemini-vision";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { custoPosicionarCenas, CREDITOS_FIXO } from "@/lib/precos";
import { APOIO_MIN, DURA_MANUAL_MIN, IMAGEM_MIN_SEG, MAX_VIDEO_SEG, maxApoios } from "@/lib/montagem";
import { registrarErroApp } from "@/lib/erros-app";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POSICIONAR AS CENAS POR IA (Editor automático, etapa de resumo).
 *
 * A IA ouve a fala do vídeo principal e diz em que SEGUNDO cada cena de apoio
 * entra. O resultado volta pra tela, a pessoa VÊ a linha do tempo com os tempos
 * reais e corrige o que quiser antes de mandar renderizar. Depois disso cada
 * apoio viaja com o campo `entra` preenchido, e o render passa a obedecer em vez
 * de decidir sozinho no meio do processo.
 *
 * POR QUE O ÁUDIO VAI JUNTO, e não a transcrição: o Whisper mora no worker
 * Python (a máquina que renderiza), não no servidor do site. O Gemini lê áudio
 * direto, então o navegador extrai a faixa do arquivo local (WAV 16 kHz mono,
 * ~2 MB por minuto) e uma chamada só resolve ouvir e encaixar. Nada do vídeo em
 * si sobe: é o mesmo princípio dos quadros do `descrever-cenas`.
 *
 * Cobra `CREDITOS_FIXO.posicionarCena` por cena posicionada, e SÓ NO SUCESSO.
 *
 * ERRO AQUI IMPEDE O VÍDEO (dono, 06/08/2026). Nenhuma resposta de falha sugere
 * "gerar assim mesmo": sem os segundos escolhidos a tela não libera o Aprovar e
 * gerar, e o crédito não é descontado. **Toda falha é anotada pro Diagnóstico**
 * (`registrarErroApp`), senão o dono só saberia que existe problema quando
 * alguém reclamasse que a tela não deixa gerar.
 */

/** Anota a falha pro /admin/diagnostico e devolve a resposta pra tela.
 *  Uma função só pra nenhum caminho de erro sair sem registro. */
function falhar(
  ctx: { userId?: string; quem?: string },
  http: number,
  erro: string,
  detalhe: string,
  extra: Record<string, unknown> = {},
) {
  registrarErroApp({
    area: "editor-posicionar",
    mensagem: erro,
    detalhe,
    userId: ctx.userId,
    quem: ctx.quem,
  });
  return NextResponse.json({ erro, ...extra }, { status: http });
}

/** Teto de áudio por pedido (base64). 2 min de WAV 16 kHz mono dão ~5 MB em
 *  base64; o dobro disso é folga de sobra e ainda cabe no inline do Gemini. */
const MAX_AUDIO_BASE64 = 12 * 1024 * 1024;

/** Aceita "data:audio/wav;base64,XXX" ou o base64 pelado. */
function soBase64(bruto: unknown): string {
  const s = String(bruto ?? "");
  const m = /^data:[^;]+;base64,(.+)$/.exec(s);
  return (m ? m[1] : s).trim();
}

function num(v: unknown, padrao = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
}

/**
 * Arruma o que a IA respondeu pra caber na linha do tempo de verdade.
 *
 * É a MESMA regra do `planejarApoios` (lib/montagem.ts) e do `planejar_apoios`
 * da fábrica: ordena pelo momento, empurra pra frente o que ficou em cima da
 * cena anterior e derruba o que não couber até o fim. Sem isso a IA poderia
 * devolver duas cenas no mesmo segundo, e a tela mostraria uma linha do tempo
 * que o render não teria como cumprir.
 *
 * O piso é POR CENA: foto vive a partir de 1s, vídeo a partir de 2s, e cena com
 * TAMANHO MANUAL (redimensionada no painel da etapa 5) vale a partir de meio
 * segundo - tratar foto como vídeo descartava cena que caberia, e o pedido
 * inteiro falhava com "não consegui encaixar todas as cenas".
 */
function encaixar(
  cenas: { i: number; entra: number; dur: number; porque: string; minDur: number }[],
  durBase: number,
) {
  const ordenadas = [...cenas].sort((a, b) => a.entra - b.entra);
  const saida: { i: number; entra: number; dur: number; porque: string }[] = [];
  let cursor = 0;
  for (let k = 0; k < ordenadas.length; k++) {
    const c = ordenadas[k];
    const minDur = c.minDur;
    let entra = Math.max(cursor, Math.min(c.entra, durBase));
    let dur = c.dur;

    // se houver uma próxima cena, encurtamos a atual caso a próxima queira entrar antes
    if (k < ordenadas.length - 1) {
      const prox = ordenadas[k + 1];
      if (prox.entra > entra && prox.entra < entra + dur) {
        const durCortada = prox.entra - entra;
        dur = durCortada >= minDur ? durCortada : minDur;
      }
    }

    // Colada no fim do vídeo sobra menos que o mínimo do tipo, e a cena morreria
    // aqui. Antes de perder a cena, recuamos a entrada dela o tanto que precisar
    // pra caber, sem nunca voltar atrás do que já foi ocupado (o cursor).
    if (durBase - entra < minDur) {
      entra = Math.max(cursor, durBase - minDur);
    }

    // garante que não passe da duração do vídeo principal
    dur = Math.min(dur, durBase - entra);

    if (dur < minDur) continue;

    saida.push({
      i: c.i,
      entra: Number(entra.toFixed(2)),
      dur: Number(dur.toFixed(2)),
      porque: c.porque,
    });
    cursor = entra + dur;
  }
  return saida;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });
  const ctx = { userId: user.id, quem: `${user.nome} (${user.email})` };

  if (!geminiConfigurado()) {
    return falhar(
      ctx,
      503,
      "O posicionamento por IA está fora do ar agora, então não dá pra gerar este vídeo. Tente daqui a pouco.",
      "Nenhuma GEMINI_API_KEY válida no ambiente do site (geminiConfigurado() = false).",
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return falhar(ctx, 400, "Dados inválidos.", "Corpo do pedido não é JSON válido.");
  }

  const durBase = Math.min(MAX_VIDEO_SEG, Math.max(0, num(body.durBase)));
  if (durBase <= 0) {
    return falhar(
      ctx,
      400,
      "Não consegui ler a duração do vídeo principal.",
      `durBase recebido: ${JSON.stringify(body.durBase)}`,
    );
  }

  // só entram as cenas que cabem na regra de 1 apoio a cada SEG_POR_APOIO
  const cabem = maxApoios(durBase);
  const cenas: CenaParaPosicionar[] = [];
  const duracaoPorCena = new Map<number, number>();
  const minDurPorCena = new Map<number, number>();
  for (const cru of (Array.isArray(body.cenas) ? body.cenas : []).slice(0, cabem)) {
    if (!cru || typeof cru !== "object") continue;
    const o = cru as Record<string, unknown>;
    const i = Number(o.i);
    const dur = num(o.dur);
    // foto fica menos tempo na tela que vídeo, então o piso muda com o tipo.
    // `manual` = a pessoa redimensionou a cena no painel da etapa 5, e aí o
    // tamanho dela MANDA (dono, 11/08/2026): o piso cai pra meio segundo.
    const minDur =
      o.manual === true ? DURA_MANUAL_MIN : o.tipo === "image" ? IMAGEM_MIN_SEG : APOIO_MIN;
    if (!Number.isInteger(i) || i < 0 || dur < minDur) continue;
    cenas.push({
      i,
      tipo: o.tipo === "image" ? "image" : "video",
      descricao: String(o.descricao ?? "").trim().slice(0, 400),
      dur,
    });
    duracaoPorCena.set(i, dur);
    minDurPorCena.set(i, minDur);
  }

  if (!cenas.length) {
    return falhar(
      ctx,
      400,
      "Não há cena de apoio pra posicionar nesse vídeo.",
      `Nenhuma cena válida no pedido (cabem ${cabem} em ${durBase.toFixed(1)}s de base).`,
    );
  }

  const audioCru = soBase64(body.audio);
  const audio =
    audioCru.length > 100 && audioCru.length <= MAX_AUDIO_BASE64
      ? { mime: String(body.audioMime ?? "audio/wav"), base64: audioCru }
      : null;

  // demo entra junto com admin: em todo o resto do app ela usa sem pagar
  const isAdmin = user.role === "admin" || user.role === "demo";
  const custo = custoPosicionarCenas(cenas.length);
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < custo) {
      return falhar(
        ctx,
        402,
        `Você precisa de ${custo} créditos pra a IA posicionar ${cenas.length} ${cenas.length === 1 ? "cena" : "cenas"}. Compre na aba Créditos pra conseguir gerar este vídeo.`,
        `Saldo ${saldoCentavos} < custo ${custo} (${cenas.length} cenas).`,
        { faltaCreditos: true, custo },
      );
    }
  }

  const p = (body.produto && typeof body.produto === "object" ? body.produto : {}) as Record<
    string,
    unknown
  >;
  let posicoes: Awaited<ReturnType<typeof posicionarCenas>> = {};
  // caixa que volta com o motivo REAL quando o Google recusa a chamada (cota do
  // dia, chave inválida, modelo aposentado). Sem ela, toda falha virava
  // "a IA respondeu mal" no Diagnóstico, e o dono procurava no lugar errado.
  const diag: CaixaFalha = { falha: null };
  try {
    posicoes = await posicionarCenas(
      audio,
      cenas,
      durBase,
      { userId: user.id, origem: "editor-posicionar" },
      {
        base: String(body.descricaoBase ?? "").trim().slice(0, 400),
        produto: {
          nome: String(p.nome ?? "").trim().slice(0, 120),
          preco: String(p.preco ?? "").trim().slice(0, 20),
        },
      },
      diag,
    );
  } catch (e) {
    // exceção inesperada (rede, resposta torta): o vídeo não sai, e o dono
    // precisa ver o motivo real no Diagnóstico
    return falhar(
      ctx,
      502,
      "A IA não conseguiu posicionar as cenas agora. Tente de novo (não descontamos créditos).",
      `${(e as Error)?.name ?? "Erro"}: ${(e as Error)?.message ?? String(e)}`,
    );
  }

  const descricaoAudio = audio
    ? `${Math.round(audio.base64.length / 1024)} KB`
    : "NÃO enviado (vídeo mudo ou o navegador não leu a faixa)";

  // A IA pode pular uma cena. Como o vídeo agora SÓ sai com a linha do tempo
  // inteira decidida aqui, quem ela pulou ganha a distribuição em intervalos
  // iguais (a mesma conta de reserva da tela e do render) em vez de voltar sem
  // posição: uma cena sem `entra` faria o render escolher escondido justamente o
  // que este passo existe pra evitar.
  const brutas = cenas.map((c, k) => {
    const p = posicoes[c.i];
    return {
      i: c.i,
      entra: p ? p.entra : (durBase * (k + 1)) / (cenas.length + 1),
      dur: duracaoPorCena.get(c.i) ?? (c.tipo === "image" ? IMAGEM_MIN_SEG : APOIO_MIN),
      minDur: minDurPorCena.get(c.i) ?? (c.tipo === "image" ? IMAGEM_MIN_SEG : APOIO_MIN),
      porque: p?.porque ?? "",
      daIA: !!p,
    };
  });
  const semIA = brutas.filter((b) => !b.daIA).length;

  // a IA não acertou NENHUMA: isso é falha, não resultado. Nada é cobrado e a
  // tela continua travada (o vídeo não sai sem este passo).
  //
  // Quando a `diag` voltou preenchida, o Google RECUSOU a chamada e o texto nem
  // chegou: aí o Diagnóstico recebe o status e a resposta dele em vez do genérico
  // "respondeu mas não veio nada". Cota estourada ganha aviso próprio na tela
  // porque, nesse caso, "tente de novo" é conselho errado: só vira amanhã.
  if (semIA === cenas.length) {
    const f = diag.falha;
    return falhar(
      ctx,
      f?.cota ? 429 : 502,
      f?.cota
        ? "A IA do Google atingiu o limite de uso de hoje, então este passo não roda agora. Não descontamos créditos: avise o suporte."
        : f
          ? "A IA do Google não respondeu agora. Tente de novo em alguns minutos (não descontamos créditos)."
          : "A IA não conseguiu posicionar as cenas agora. Tente de novo (não descontamos créditos).",
      f
        ? `O Google recusou a chamada, nenhuma das ${cenas.length} cena(s) voltou. ${f.detalhe}. Áudio: ${descricaoAudio}.`
        : `Gemini respondeu, mas nada aproveitável: 0 de ${cenas.length} cena(s) posicionada(s). Áudio: ${descricaoAudio}.`,
    );
  }

  const encaixadas = encaixar(brutas, durBase);
  if (encaixadas.length < cenas.length) {
    // sobrou cena sem lugar depois do encaixe: entregar assim deixaria o render
    // decidir o resto, que é o que este passo existe pra evitar
    return falhar(
      ctx,
      502,
      "Não consegui encaixar todas as cenas na linha do tempo. Tente de novo, ou volte e corte alguma cena pra sobrar espaço (não descontamos créditos).",
      `${encaixadas.length} de ${cenas.length} cena(s) couberam em ${durBase.toFixed(1)}s de base. Áudio: ${descricaoAudio}.`,
    );
  }

  // resultado parcial ainda é problema: o dono precisa ver que a IA está
  // degradando, mesmo com a tela seguindo em frente
  if (semIA > 0) {
    registrarErroApp({
      area: "editor-posicionar",
      mensagem: `A IA posicionou só ${cenas.length - semIA} de ${cenas.length} cenas; o resto foi distribuído por tempo.`,
      detalhe: `Cobrado só pelas ${cenas.length - semIA} que ela decidiu. Áudio: ${descricaoAudio}.`,
      userId: user.id,
      quem: `${user.nome} (${user.email})`,
    });
  }

  // paga só pelo que a IA decidiu de verdade: cena distribuída por tempo não é cobrada
  const cobradas = cenas.length - semIA;
  if (!isAdmin) {
    await debitarClamp(user.id, custoPosicionarCenas(cobradas), "debito_geracao", {
      descricao: `Editor: posicionamento de ${cobradas} ${cobradas === 1 ? "cena" : "cenas"}`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    cenas: encaixadas,
    semAudio: !audio,
    /** quantas a IA não decidiu (foram distribuídas por tempo) */
    estimadas: semIA,
    creditos: isAdmin ? 0 : custoPosicionarCenas(cobradas),
    porCena: CREDITOS_FIXO.posicionarCena,
  });
}
