import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import {
  descreverCenas,
  geminiConfigurado,
  type CaixaFalha,
  type CenaParaAnalisar,
} from "@/lib/gemini-vision";
import { getCarteira, debitarClamp } from "@/lib/creditos";
import { custoAnaliseCenas, CREDITOS_FIXO } from "@/lib/precos";
import { QUADROS_ANALISE } from "@/lib/montagem";
import { registrarErroApp } from "@/lib/erros-app";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * ETAPA DE APROVAÇÃO DO EDITOR: a IA olha as cenas de apoio que a pessoa NÃO
 * descreveu e diz o que cada uma mostra + em que ponto dela está o melhor pedaço.
 *
 * Os quadros são tirados NO NAVEGADOR (canvas em cima do arquivo local) e chegam
 * aqui já em JPEG pequeno. Isso é de propósito: o vídeo de apoio pode ter 300 MB
 * e só os quadros interessam, então nada disso sobe pro servidor duas vezes.
 *
 * Cobra `CREDITOS_FIXO.analiseCena` por cena analisada, e SÓ NO SUCESSO (mesma
 * regra do Gerador de prompt): confere o saldo antes de chamar a IA e desconta
 * depois que as frases voltam. Falha da IA não cobra nada.
 *
 * O que sai daqui viaja junto no roteiro do job, então a fábrica encontra a
 * descrição pronta e NÃO descreve de novo: ninguém paga a mesma análise duas vezes.
 */

/** Teto por pedido: 2 minutos de base cabem no máximo 24 cenas de apoio
 *  (1 a cada 5s desde 06/08/2026; era 12 quando a regra era 1 a cada 10s). */
const MAX_CENAS = 24;

/** Aceita "data:image/jpeg;base64,XXX" ou o base64 pelado. */
function soBase64(bruto: unknown): string {
  const s = String(bruto ?? "");
  const m = /^data:[^;]+;base64,(.+)$/.exec(s);
  return (m ? m[1] : s).trim();
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  // toda falha daqui é anotada pro /admin/diagnostico (dono, 06/08/2026): a
  // pessoa via um aviso vermelho na tela e o dono não ficava sabendo de nada
  const anotar = (mensagem: string, detalhe: string) =>
    registrarErroApp({
      area: "editor-descrever-cenas",
      mensagem,
      detalhe,
      userId: user.id,
      quem: `${user.nome} (${user.email})`,
    });

  if (!geminiConfigurado()) {
    const msg =
      "A análise de cenas está fora do ar agora. Você pode descrever as cenas na mão e gerar normalmente.";
    anotar(msg, "Nenhuma GEMINI_API_KEY válida no ambiente do site (geminiConfigurado() = false).");
    return NextResponse.json({ erro: msg }, { status: 503 });
  }

  let body: { cenas?: unknown; produto?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }

  // contexto opcional do produto (06/08/2026): com "É um produto? Sim" a tela
  // manda nome/preço/descrição pra IA saber do que o vídeo trata. Sem nome não
  // vale nada (é ele que dá o assunto).
  const p = (
    body.produto && typeof body.produto === "object" ? body.produto : {}
  ) as Record<string, unknown>;
  const produto = {
    nome: String(p.nome ?? "").trim().slice(0, 120),
    preco: String(p.preco ?? "").trim().slice(0, 20),
    descricao: String(p.descricao ?? "").trim().slice(0, 300),
  };

  const cenas: CenaParaAnalisar[] = [];
  for (const cru of (Array.isArray(body.cenas) ? body.cenas : []).slice(0, MAX_CENAS)) {
    if (!cru || typeof cru !== "object") continue;
    const o = cru as Record<string, unknown>;
    const i = Number(o.i);
    if (!Number.isInteger(i) || i < 0) continue;
    const quadros = (Array.isArray(o.quadros) ? o.quadros : [])
      .slice(0, QUADROS_ANALISE)
      .map(soBase64)
      .filter((q) => q.length > 100); // quadro vazio/preto não vale a chamada
    if (!quadros.length) continue;
    cenas.push({ i, tipo: o.tipo === "image" ? "image" : "video", quadros });
  }

  if (!cenas.length) {
    const msg = "Não consegui ler os quadros dessas cenas. Descreva na mão e siga em frente.";
    anotar(
      msg,
      "Nenhuma cena com quadro aproveitável chegou (o navegador não conseguiu tirar os JPEGs do arquivo local).",
    );
    return NextResponse.json({ erro: msg }, { status: 400 });
  }

  // demo entra junto com admin: em todo o resto do app ela usa sem pagar
  const isAdmin = user.role === "admin" || user.role === "demo";
  const custo = custoAnaliseCenas(cenas.length);
  if (!isAdmin) {
    const { saldoCentavos } = await getCarteira(user.id);
    if (saldoCentavos < custo) {
      const msg = `Você precisa de ${custo} créditos pra analisar ${cenas.length} ${cenas.length === 1 ? "cena" : "cenas"}. Compre na aba Créditos, ou descreva as cenas na mão (isso é de graça).`;
      anotar(msg, `Saldo ${saldoCentavos} < custo ${custo} (${cenas.length} cenas).`);
      return NextResponse.json({ erro: msg, faltaCreditos: true, custo }, { status: 402 });
    }
  }

  let analisadas: Awaited<ReturnType<typeof descreverCenas>> = {};
  // caixa que volta com o motivo REAL quando o Google recusa a chamada (cota do
  // dia, chave inválida, modelo aposentado). Sem ela, toda falha virava
  // "a IA respondeu mal" no Diagnóstico, e o dono procurava no lugar errado.
  const diag: CaixaFalha = { falha: null };
  try {
    analisadas = await descreverCenas(
      cenas,
      { userId: user.id, origem: "editor-cenas" },
      produto.nome ? produto : undefined,
      diag,
    );
  } catch (e) {
    const msg = "A IA não conseguiu ler as cenas agora. Tente de novo ou descreva na mão (não descontamos créditos).";
    anotar(msg, `${(e as Error)?.name ?? "Erro"}: ${(e as Error)?.message ?? String(e)}`);
    return NextResponse.json({ erro: msg }, { status: 502 });
  }
  const achadas = Object.keys(analisadas).length;
  if (!achadas) {
    // `diag` preenchida = o Google recusou a chamada e o texto nem chegou. Cota
    // estourada ganha aviso próprio: "tente de novo" seria conselho errado.
    const f = diag.falha;
    const msg = f?.cota
      ? "A IA do Google atingiu o limite de uso de hoje. Descreva as cenas na mão e siga em frente (não descontamos créditos)."
      : f
        ? "A IA do Google não respondeu agora. Tente de novo em alguns minutos, ou descreva na mão (não descontamos créditos)."
        : "A IA não conseguiu ler as cenas agora. Tente de novo ou descreva na mão (não descontamos créditos).";
    anotar(
      msg,
      f
        ? `O Google recusou a chamada, nenhuma das ${cenas.length} cena(s) voltou. ${f.detalhe}.`
        : `Gemini respondeu, mas nenhuma das ${cenas.length} cena(s) voltou com descrição aproveitável.`,
    );
    return NextResponse.json({ erro: msg }, { status: f?.cota ? 429 : 502 });
  }

  // paga só pelo que voltou descrito: cena que a IA pulou não é cobrada
  if (!isAdmin) {
    await debitarClamp(user.id, custoAnaliseCenas(achadas), "debito_geracao", {
      descricao: `Editor: análise de ${achadas} ${achadas === 1 ? "cena" : "cenas"}`,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    cenas: analisadas,
    creditos: isAdmin ? 0 : custoAnaliseCenas(achadas),
    porCena: CREDITOS_FIXO.analiseCena,
  });
}
