/**
 * Constantes do "Apoie o projeto", num módulo client-safe (sem "server-only"):
 * a tela precisa dos mesmos valores que o servidor usa pra validar, e não dá
 * pra importar apoios.ts no client.
 */

export const VALOR_MINIMO = 200; // R$ 2,00
export const VALOR_MAXIMO = 500_000; // R$ 5.000,00
export const VALORES_SUGERIDOS = [500, 1000, 2500, 5000]; // 5, 10, 25 e 50 reais
