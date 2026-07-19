import "server-only";

/**
 * Diagnóstico de erros de render + saldo de tokens.
 * - classificarErro: lê a mensagem de erro do job e adivinha QUEM falhou
 *   (ElevenLabs / Gemini / Veo / ffmpeg...) e se foi por falta de crédito.
 * - elevenSaldo: consulta o saldo de caracteres de cada chave ElevenLabs.
 */

export type ServicoErro =
  | "ElevenLabs (voz)"
  | "Gemini (copy/imagem)"
  | "Veo (vídeo IA)"
  | "Edição (ffmpeg)"
  | "Fábrica"
  | "Outro";

export interface ErroClassificado {
  servico: ServicoErro;
  /** true quando o erro tem cara de cota/crédito esgotado */
  semCredito: boolean;
  /** explicação curta e humana da causa provável (pra mostrar no painel) */
  motivo?: string;
}

export function classificarErro(erro?: string | null): ErroClassificado {
  const t = (erro || "").toLowerCase();
  const semCredito =
    /quota|cota|esgot|exceed|limit|429|insufficient|sem cr[eé]dito|credit|resource_exhausted|too many requests/.test(
      t,
    );

  // a ordem importa: a causa raiz (eleven/gemini) costuma aparecer no log mesmo
  // quando a mensagem final é "a fábrica não gerou vídeo".
  let servico: ServicoErro = "Outro";
  if (/eleven|text_to_speech|xi-api|convert_with_timestamps|\[voz\]|voz=|library voices/.test(t))
    servico = "ElevenLabs (voz)";
  else if (/gemini|genai|google.*api|api key not valid|generativelanguage/.test(t))
    servico = "Gemini (copy/imagem)";
  else if (/\bveo\b/.test(t)) servico = "Veo (vídeo IA)";
  else if (/ffmpeg|libx264|codec/.test(t)) servico = "Edição (ffmpeg)";
  else if (/não gerou v[ií]deo|nao gerou video|a f[áa]brica/.test(t))
    servico = "Fábrica";

  // motivo humano da causa mais provável
  let motivo: string | undefined;
  if (/library voices|paid_plan_required|402/.test(t))
    motivo = "Voz exige plano PAGO (voz 'library' da ElevenLabs). Precisa de chave paga ou troque a voz.";
  else if (/exceeds your quota|character.*quota|cota|quota/.test(t) && servico === "ElevenLabs (voz)")
    motivo = "Cota de caracteres da(s) chave(s) ElevenLabs esgotada.";
  else if (/api key not valid|invalid api key|unauthorized|\b401\b/.test(t))
    motivo = "Chave de API inválida ou sem permissão.";
  else if (/resource_exhausted|gemini.*quota/.test(t))
    motivo = "Cota do Gemini esgotada.";
  else if (semCredito) motivo = "Cota/crédito esgotado.";

  return { servico, semCredito, motivo };
}

export interface ChaveSaldo {
  rotulo: string;
  ok: boolean;
  usado?: number;
  limite?: number;
  restante?: number;
  tier?: string;
  msg?: string;
  /** ISO da próxima renovação da cota (quando a ElevenLabs zera o contador) */
  resetEm?: string;
}

export interface ElevenSaldo {
  configurado: boolean;
  chaves: ChaveSaldo[];
}

function mascarar(k: string, i: number) {
  const fim = k.slice(-4);
  return `Chave #${i + 1} (…${fim})`;
}

/** Consulta o saldo de cada chave ElevenLabs (precisa de ELEVENLABS_API_KEYS no env). */
export async function elevenSaldo(): Promise<ElevenSaldo> {
  const raw =
    process.env.ELEVENLABS_API_KEYS || process.env.ELEVENLABS_API_KEY || "";
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) return { configurado: false, chaves: [] };

  const chaves = await Promise.all(
    keys.map(async (k, i): Promise<ChaveSaldo> => {
      const rotulo = mascarar(k, i);
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(
          "https://api.elevenlabs.io/v1/user/subscription",
          { headers: { "xi-api-key": k }, cache: "no-store", signal: ctrl.signal },
        );
        clearTimeout(to);
        if (!r.ok) return { rotulo, ok: false, msg: `HTTP ${r.status}` };
        const d = (await r.json()) as {
          character_count?: number;
          character_limit?: number;
          tier?: string;
          next_character_count_reset_unix?: number;
        };
        const usado = d.character_count ?? 0;
        const limite = d.character_limit ?? 0;
        return {
          rotulo,
          ok: true,
          usado,
          limite,
          restante: Math.max(0, limite - usado),
          tier: d.tier,
          resetEm: d.next_character_count_reset_unix
            ? new Date(d.next_character_count_reset_unix * 1000).toISOString()
            : undefined,
        };
      } catch {
        return { rotulo, ok: false, msg: "sem resposta" };
      }
    }),
  );

  return { configurado: true, chaves };
}
