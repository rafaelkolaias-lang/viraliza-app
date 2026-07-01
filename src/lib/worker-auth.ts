import "server-only";

import crypto from "node:crypto";

/** Confere o token do worker (header x-worker-token) em tempo constante. */
export function workerAutorizado(req: Request): boolean {
  const esperado = process.env.WORKER_TOKEN;
  if (!esperado) return false; // sem token configurado, ninguém entra
  const recebido = req.headers.get("x-worker-token") || "";
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // timingSafeEqual exige mesmo tamanho; compara só quando batem (não vaza o tamanho útil)
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
