// Vozes do "Selecionar Voz" (Fase 1 - lista curada da SUA conta ElevenLabs).
//
// Estes ids são os "voice_id" da ElevenLabs. Para trocar/adicionar uma voz:
//   1. Pegue o voice_id na sua conta (https://elevenlabs.io/app/voice-lab) ou
//      via GET https://api.elevenlabs.io/v2/voices (header xi-api-key).
//   2. Adicione uma linha aqui com id + nome amigável + gênero.
// A voz padrão (VOZ_PADRAO) precisa estar nesta lista e deve bater com a voz
// padrão do worker (narrar_video.py). Hoje as duas usam a Laura.
//
// Fase 2 (BYO key): quando o usuário trouxer a chave dele, o seletor passa a
// buscar as vozes da conta DELE em tempo real, sem depender desta lista.

export type VozOpcao = {
  id: string;
  nome: string;
  genero: "f" | "m";
  principal?: boolean; // mostra a etiqueta "Principal" no seletor (vozes recomendadas)
};

export const VOZES: VozOpcao[] = [
  { id: "FGY2WhTYpPnrIDTdsKH5", nome: "Laura", genero: "f", principal: true },
  { id: "nPczCjzI2devNBz1zQrb", nome: "Brian", genero: "m", principal: true },
  { id: "EXAVITQu4vr4xnSDxMaL", nome: "Sarah", genero: "f" },
  { id: "XrExE9yKIg1WjnnlVkGX", nome: "Matilda", genero: "f" },
  { id: "XB0fDUnXU5powFXDhCwa", nome: "Charlotte", genero: "f" },
  { id: "JBFqnCBsd6RMkjVDRZzb", nome: "George", genero: "m" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", nome: "Liam", genero: "m" },
  { id: "onwK4e9ZLuTAKqWW03F9", nome: "Daniel", genero: "m" },
];

// Voz padrão: a mesma que o worker já usava por baixo (Laura).
export const VOZ_PADRAO = "FGY2WhTYpPnrIDTdsKH5";

/** Garante que o id recebido é uma voz conhecida; senão cai na padrão. */
export function vozValida(id: string | null | undefined): string {
  return VOZES.some((v) => v.id === id) ? (id as string) : VOZ_PADRAO;
}
