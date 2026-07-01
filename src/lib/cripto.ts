import "server-only";

import crypto from "node:crypto";

// Cifra segredos do usuário (ex.: chave ElevenLabs do BYO) no banco do app.
// A chave AES é DERIVADA do SESSION_SECRET com um salt próprio (domínio separado),
// então não precisa de mais uma variável de ambiente em produção. Se quiser uma
// chave dedicada, defina APP_CRYPTO_SECRET que ela tem prioridade.
const SECRET = process.env.APP_CRYPTO_SECRET || process.env.SESSION_SECRET || "";
const KEY = SECRET
  ? crypto.scryptSync(SECRET, "viraliza:byo-key:v1", 32)
  : null;

function exigirChave() {
  if (!KEY) {
    throw new Error(
      "Sem SESSION_SECRET (ou APP_CRYPTO_SECRET) pra cifrar segredos.",
    );
  }
  return KEY;
}

/** Cifra um texto e devolve base64 de [iv(12) | tag(16) | dados]. */
export function cifrar(texto: string): string {
  const key = exigirChave();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, dados]).toString("base64");
}

/** Decifra o que `cifrar` gerou. Lança se o conteúdo foi adulterado. */
export function decifrar(blob: string): string {
  const key = exigirChave();
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const dados = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]).toString(
    "utf8",
  );
}
