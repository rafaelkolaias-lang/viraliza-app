import "server-only";

import type { VozOpcao } from "@/lib/vozes";

// Busca as vozes de UMA conta ElevenLabs (a do usuário, no BYO). Mesma chamada que
// usaríamos pra sua conta: muda só a chave. Inclui as vozes que o usuário clonou.
// Lança se a chave for inválida (ex.: 401) pra quem chama tratar.
export async function listarVozesDaChave(apiKey: string): Promise<VozOpcao[]> {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`ElevenLabs respondeu ${r.status}`);
  const data = (await r.json()) as {
    voices?: Array<{
      voice_id: string;
      name: string;
      labels?: Record<string, string> | null;
    }>;
  };
  return (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    nome: v.name,
    genero: (v.labels?.gender ?? "").toLowerCase().startsWith("m") ? "m" : "f",
  }));
}
