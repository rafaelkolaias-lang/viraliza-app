/**
 * Onde ficam os EXEMPLOS do Lab (vídeos e posters dos estilos de câmera e dos
 * movimentos): no serverrk, servidos pelo nginx de mídia, igual ao resto das
 * nossas mídias.
 *
 * Ficam fora do repositório de propósito: são 5MB de vídeo que mudam sozinhos
 * (trocar ou acrescentar um exemplo é só jogar o arquivo em
 * /mnt/ssd/viraliza/media/lab/... no serverrk, sem deploy nenhum).
 *
 * O nome do arquivo é sempre a CHAVE do estilo ou do movimento: `<chave>.mp4`
 * com o poster `<chave>.jpg` do lado.
 */
const BASE = (
  process.env.NEXT_PUBLIC_LAB_MEDIA || "https://media.univershoop.com/lab"
).replace(/\/+$/, "");

export const midiaEstilo = (chave: string) => ({
  video: `${BASE}/estilos/${chave}.mp4`,
  poster: `${BASE}/estilos/${chave}.jpg`,
});

export const midiaMovimento = (chave: string) => ({
  video: `${BASE}/movimentos/${chave}.mp4`,
  poster: `${BASE}/movimentos/${chave}.jpg`,
});

/** Foto do passo "Cenário" (a cena vazia, sem gente, que vira o fundo). */
export const midiaCenario = (chave: string) => `${BASE}/cenarios/${chave}.jpg`;

/** Amostra de pele do passo "Tom de pele" (foto real de pele, não cor chapada). */
export const midiaPele = (chave: string) => `${BASE}/peles/${chave}.jpg`;

/** Manequim do passo "Tipo físico", um por gênero. */
export const midiaCorpo = (genero: string, chave: string) =>
  `${BASE}/corpos/${genero === "male" ? "male" : "female"}-${chave}.jpg`;

/** Amostra da cor do cabelo (foto de cabelo, não cor chapada). */
export const midiaCabeloCor = (chave: string) => `${BASE}/cabelos/${chave}.jpg`;

/** Foto do corte de cabelo (`female-bob`, `male-fade`, `unisex-dreads`). */
export const midiaCabeloEstilo = (genero: string, chave: string) =>
  `${BASE}/cabelo-estilos/${genero}-${chave}.jpg`;

/** Gêneros que já têm os manequins do tipo físico subidos. */
export const CORPOS_COM_IMAGEM = ["male", "female"];
