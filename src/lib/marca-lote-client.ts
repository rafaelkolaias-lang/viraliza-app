// Ponte client-side dos botões "Colocar marca" (nos cards) -> tela "Aplicar marca
// em lote". A seleção fica no sessionStorage e a tela adota ao abrir. Só entra vídeo
// que mora no serverrk (URL http de /virais ou /gerados) - Drive não dá pra carimbar.

export type FonteMarca = { url: string; nome: string; thumb?: string };

export const CHAVE_FONTES_MARCA = "lote_marca_fontes";
export const ROTA_MARCA_LOTE = "/painel/lote";

/** True se a URL é um vídeo do serverrk que dá pra carimbar (http, não Drive). */
export function podeColocarMarca(url?: string): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

/** Guarda as fontes escolhidas pra a tela de marca em lote adotar. */
export function guardarFontesMarca(fontes: FonteMarca[]) {
  try {
    sessionStorage.setItem(CHAVE_FONTES_MARCA, JSON.stringify(fontes.slice(0, 12)));
  } catch {
    /* storage cheio/indisponível - ignora */
  }
}
