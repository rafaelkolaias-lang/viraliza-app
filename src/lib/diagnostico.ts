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
  if (/eleven|text_to_speech|xi-api|convert_with_timestamps/.test(t))
    servico = "ElevenLabs (voz)";
  else if (/gemini|genai|google.*api|api key not valid|generativelanguage/.test(t))
    servico = "Gemini (copy/imagem)";
  else if (/\bveo\b/.test(t)) servico = "Veo (vídeo IA)";
  else if (/ffmpeg|libx264|codec/.test(t)) servico = "Edição (ffmpeg)";
  else if (/não gerou v[ií]deo|nao gerou video|a f[áa]brica/.test(t))
    servico = "Fábrica";

  return { servico, semCredito };
}

export interface ChaveSaldo {
  rotulo: string;
  ok: boolean;
  usado?: number;
  limite?: number;
  restante?: number;
  tier?: string;
  msg?: string;
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
        };
      } catch {
        return { rotulo, ok: false, msg: "sem resposta" };
      }
    }),
  );

  return { configurado: true, chaves };
}
