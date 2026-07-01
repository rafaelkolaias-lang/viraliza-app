import "server-only";

/** Confere o token do worker (header x-worker-token). */
export function workerAutorizado(req: Request): boolean {
  const esperado = process.env.WORKER_TOKEN;
  if (!esperado) return false; // sem token configurado, ninguém entra
  return req.headers.get("x-worker-token") === esperado;
}
