import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { ORIGEM_SUPORTE, registrarOpenAIChat } from "@/lib/gastos-api";
import { responderSuporte, suporteIaConfigurado, type MsgIa } from "@/lib/suporte-ia";
import { PROMPT_SISTEMA, nomeDaRota, separarLinks } from "@/lib/suporte-base";
import { contextoDoUsuario } from "@/lib/suporte-usuario";
import { contextoDoPasso, respostaGuiada, type FalaBot } from "@/lib/suporte-guia";

export const runtime = "nodejs";
// Antes eram 300s por causa do cold start de ~45s do modelo da casa. Na OpenAI a
// resposta vem em poucos segundos; 60 é folga de sobra pra um pico de rede.
export const maxDuration = 60;

/**
 * Robô de suporte da plataforma (boia flutuante do painel).
 *
 * Roda no **gpt-5-mini** (`lib/suporte-ia.ts`) desde 12/08/2026 - antes era o
 * LLM da casa (qwen). O porquê da troca está no cabeçalho do `suporte-ia.ts`.
 * A conversa continua **de graça pro usuário** (não desconta crédito); o custo
 * fica com o dono e aparece em Finanças pela marca `ORIGEM_SUPORTE`.
 *
 * Ele só responde com o material da Central de Ajuda (`lib/suporte-base.ts`) e
 * devolve as telas pra onde a pessoa deve ir; inventar preço aqui seria pior que
 * não responder.
 *
 * POST { mensagens: [{ autor: "user" | "bot", texto }], rota? } -> { texto, links }
 */

const MAX_PERGUNTA = 500; // caracteres por fala
/**
 * Quantas falas do histórico voltam pro modelo (o widget já junta os balões
 * seguidos do robô numa fala só, então isto são ~5 idas e voltas). Segura o
 * "não entendi, explica melhor" e o "e o outro?" sem inchar o prompt, que já
 * tem ~30 mil caracteres de material.
 */
const HISTORICO = 10;

// Freio simples por usuário. Antes existia porque o servidor do LLM era um só e
// respondia devagar; agora o motivo é a CONTA: cada resposta custa dinheiro do
// dono e ninguém precisa de 12 respostas por minuto. Some quando o processo
// reinicia, o que é aceitável pra um limite anti-abuso.
const JANELA_MS = 60_000;
const MAX_NA_JANELA = 12;
const usos = new Map<string, number[]>();

function passouDoLimite(userId: string): boolean {
  const agora = Date.now();
  const recentes = (usos.get(userId) ?? []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  usos.set(userId, recentes);
  if (usos.size > 500) {
    // limpeza preguiçosa pra memória não crescer sem parar
    for (const [id, marcas] of usos) {
      if (marcas.every((t) => agora - t >= JANELA_MS)) usos.delete(id);
    }
  }
  return recentes.length > MAX_NA_JANELA;
}

type MsgCliente = { autor?: string; texto?: string };

/**
 * O widget ainda chama isto ao abrir a conversa e ao focar o campo de escrever.
 *
 * Não faz mais nada: existia pra acordar o modelo da casa, que o Ollama
 * descarregava depois de uns minutos parado e levava ~45s pra recarregar. Na
 * OpenAI não há o que aquecer. A rota continua de pé respondendo 204 pra não
 * quebrar aba que ficou aberta com a versão velha do JavaScript carregada.
 */
export async function GET() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  if (!suporteIaConfigurado()) {
    return NextResponse.json(
      { erro: "O assistente está fora do ar agora. Tente a Central de Ajuda." },
      { status: 503 },
    );
  }

  if (passouDoLimite(user.id)) {
    return NextResponse.json(
      { erro: "Calma, muitas perguntas seguidas. Espere um minutinho." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    mensagens?: MsgCliente[];
    rota?: string;
  };
  const historico = Array.isArray(body.mensagens) ? body.mensagens.slice(-HISTORICO) : [];
  const ultima = historico[historico.length - 1];

  if (!ultima || ultima.autor !== "user" || !ultima.texto?.trim()) {
    return NextResponse.json({ erro: "Escreva a sua dúvida." }, { status: 400 });
  }

  /**
   * Passo a passo: quem responde é o CÓDIGO, não o modelo (ver `suporte-guia.ts`).
   * Vale só pra "escolhi o caminho 1" e "pode seguir"; qualquer pergunta de
   * verdade continua indo pro modelo logo abaixo. Sai na hora, de graça.
   *
   * Continua valendo com o gpt-5-mini: passo a passo determinístico é o que
   * garante que "Passo 3 de 9" seja sempre o mesmo texto, por melhor que o
   * modelo seja.
   */
  const falas = historico
    .filter((m) => m.texto?.trim())
    .map((m) => ({
      autor: m.autor === "user" ? "user" : "bot",
      texto: m.texto!.trim(),
    })) as FalaBot[];

  const guiada = respostaGuiada(falas);
  if (guiada) return NextResponse.json({ texto: guiada.texto, links: guiada.links });

  /**
   * O que muda a cada pergunta vai no FIM do prompt de sistema, nesta ordem:
   * onde o passo a passo parou e quem está perguntando (saldo, assinatura,
   * vídeos, dívida, tela aberta).
   *
   * **A ordem não é estética.** O cache de prompt da OpenAI casa por PREFIXO:
   * com o material fixo na frente, os ~8 mil tokens dele são servidos por 1/10
   * do preço e só esta cauda paga cheio. Jogar o contexto pro começo fura o
   * cache em toda chamada e multiplica a conta por dez.
   */
  const contextoPasso = contextoDoPasso(falas);
  // dado de apoio: se a consulta falhar, responde sem ele em vez de dar erro
  const contextoUser = await contextoDoUsuario(user, body.rota).catch(() => "");

  const sistema = [PROMPT_SISTEMA, contextoPasso, contextoUser]
    .filter(Boolean)
    .join("\n\n");

  const mensagens: MsgIa[] = [
    { role: "system", content: sistema },
    ...historico
      .filter((m) => m.texto?.trim())
      .map((m) => ({
        role: m.autor === "user" ? ("user" as const) : ("assistant" as const),
        content: m.texto!.trim().slice(0, MAX_PERGUNTA),
      })),
  ];

  try {
    const { texto: bruto, uso } = await responderSuporte(mensagens);

    // contabilidade do dono (aba Finanças). Nunca derruba a resposta: se o
    // registro falhar, a pessoa recebe o que perguntou e o dono perde a linha.
    await registrarOpenAIChat(user.id, uso, ORIGEM_SUPORTE).catch(() => {});

    if (!bruto.trim()) throw new Error("resposta vazia");

    const { texto, rotas } = separarLinks(bruto);
    return NextResponse.json({
      texto,
      links: rotas.map((rota) => ({ rota, nome: nomeDaRota(rota) })),
    });
  } catch {
    return NextResponse.json(
      { erro: "Não consegui responder agora. Tente de novo em instantes." },
      { status: 502 },
    );
  }
}
