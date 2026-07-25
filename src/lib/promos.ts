// Constantes das promoções mostradas no painel (modal do Instagram + banner de
// créditos baixos). Ficam aqui, num módulo client-safe (sem "server-only"), pra
// o servidor e o client usarem os mesmos valores. Pra trocar os links, é só aqui.

export const INSTAGRAM_URL = "https://www.instagram.com/viralizapp_ofc";
export const INSTAGRAM_HANDLE = "@viralizapp_ofc";
export const BONUS_IG_CREDITOS = 300;

// Checkout Cakto do pacote promocional. Atenção: o nome do produto na Cakto
// precisa conter "2.500 Créditos" pra o webhook creditar os 2500 sozinho quando
// o pagamento cair (o webhook lê a quantidade pelo nome do produto).
export const CAKTO_2500_URL = "https://pay.cakto.com.br/38gtsf3_1002174";
export const CREDITOS_PROMO = 2500;
export const PRECO_PROMO = "R$ 20";

// Abaixo deste saldo (em créditos) o banner de "comprar mais" aparece.
export const LIMITE_BANNER_BAIXO = 1000;

export type StatusBonusIg = "nenhum" | "pendente" | "aprovado" | "recusado";
