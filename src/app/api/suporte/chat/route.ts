import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dal";
import { chat, llmConfigurado } from "@/lib/llm";
import { PROMPT_SISTEMA, nomeDaRota, separarLinks } from "@/lib/suporte-base";
import { respostaGuiada, type FalaBot } from "@/lib/suporte-guia";

export const runtime = "nodejs";
// O LLM roda na máquina do dono, não numa nuvem: carregar o modelo do zero leva
// uns 45s e, quente, responde em ~10s. Limite curto aqui reprovava SEMPRE a
// primeira pergunta do dia. Melhor esperar do que devolver erro.
export const maxDuration = 300;

/**
 * Robô de suporte da plataforma (widget flutuante do painel).
 *
 * Roda no NOSSO LLM (qwen, `lib/llm.ts`): é servidor da casa, não tem custo por
 * chamada e por isso a conversa NÃO desconta crédito do usuário. Ele só responde
 * com o material da Central de Ajuda (`lib/suporte-base.ts`) e devolve as telas
 * pra onde a pessoa deve ir; inventar preço aqui seria pior que não responder.
 *
 * POST { mensagens: [{ autor: "user" | "bot", texto }] } -> { texto, links }
 */

const MAX_PERGUNTA = 500; // caracteres por fala
/**
 * Quantas falas do histórico voltam pro modelo (o widget já junta os balões
 * seguidos do robô numa fala só, então isto são ~5 idas e voltas). Segura o
 * "não entendi, explica melhor" e o "e o outro?" sem inchar o prompt, que já
 * tem 14 mil caracteres de material.
 */
const HISTORICO = 10;
const ESPERA_MS = 240_000; // paciência com a máquina de casa (ver maxDuration)

// Freio simples por usuário: o servidor do LLM é um só e responde devagar, então
// não dá pra deixar uma aba aberta martelando. Some quando o processo reinicia,
// o que é aceitável pra um limite anti-abuso.
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
 * Acorda o modelo (o widget chama isto ao ABRIR a conversa).
 *
 * O Ollama descarrega o modelo da memória depois de alguns minutos parado, e
 * carregar de volta leva ~45s. Como a pessoa demora pra digitar a primeira
 * pergunta, aquecer nesse intervalo faz a resposta chegar como se estivesse
 * sempre quente. Responde 204 na hora: quem chamou não espera nada.
 */
const aquecidos = new Map<string, number>();
const AQUECIMENTO_MS = 4 * 60_000;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !llmConfigurado()) return new Response(null, { status: 204 });

  const agora = Date.now();
  const ultimo = aquecidos.get(user.id) ?? 0;
  if (agora - ultimo < AQUECIMENTO_MS) return new Response(null, { status: 204 });
  aquecidos.set(user.id, agora);
  // limpeza preguiçosa: sem isto o mapa guardaria um registro por usuário pra
  // sempre, e num servidor que fica meses de pé isso só cresce
  if (aquecidos.size > 500) {
    for (const [id, quando] of aquecidos) {
      if (agora - quando >= AQUECIMENTO_MS) aquecidos.delete(id);
    }
  }

  // de propósito sem await: a resposta volta agora, o modelo carrega em paz
  chat([{ role: "user", content: "oi" }], { maxTokens: 1, timeoutMs: ESPERA_MS }).catch(() => {});
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  if (!llmConfigurado()) {
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

  const body = (await req.json().catch(() => ({}))) as { mensagens?: MsgCliente[] };
  const historico = Array.isArray(body.mensagens) ? body.mensagens.slice(-HISTORICO) : [];
  const ultima = historico[historico.length - 1];

  if (!ultima || ultima.autor !== "user" || !ultima.texto?.trim()) {
    return NextResponse.json({ erro: "Escreva a sua dúvida." }, { status: 400 });
  }

  /**
   * Passo a passo: quem responde é o CÓDIGO, não o modelo (ver `suporte-guia.ts`).
   * Vale só pra "escolhi o caminho 1" e "pode seguir"; qualquer pergunta de
   * verdade continua indo pro LLM logo abaixo. Sai na hora, sem espera.
   */
  const guiada = respostaGuiada(
    historico
      .filter((m) => m.texto?.trim())
      .map((m) => ({
        autor: m.autor === "user" ? "user" : "bot",
        texto: m.texto!.trim(),
      })) as FalaBot[],
  );
  if (guiada) return NextResponse.json({ texto: guiada.texto, links: guiada.links });

  const mensagens = [
    { role: "system" as const, content: PROMPT_SISTEMA },
    ...historico
      .filter((m) => m.texto?.trim())
      .map((m) => ({
        role: m.autor === "user" ? ("user" as const) : ("assistant" as const),
        content: m.texto!.trim().slice(0, MAX_PERGUNTA),
      })),
  ];

  try {
    const bruto = await chat(mensagens, {
      temperature: 0.2, // suporte não é lugar de criatividade
      // Teto é a segunda trava do "seja curto": mesmo que o modelo ignore a
      // regra do prompt, ele não despeja um textão. Não abaixar de ~280: o
      // roteiro "que tipo de vídeo" é a resposta longa permitida e sairia
      // cortada no meio da lista.
      maxTokens: 280,
      timeoutMs: ESPERA_MS,
    });
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
