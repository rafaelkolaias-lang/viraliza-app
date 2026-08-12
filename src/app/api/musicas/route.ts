import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/dal";

export const runtime = "nodejs";

/**
 * Lista a biblioteca de músicas da plataforma (Editor, etapa 4, chave "Usar
 * músicas da plataforma"): é dela que a pessoa escolhe uma trilha específica em
 * vez da sorteada.
 *
 * A pasta é a MESMA que a fábrica lê no render (`bot shopee/entrada/musicas`),
 * então o que aparece aqui é exatamente o que pode tocar no vídeo. Os arquivos
 * `job_*` ficam de fora: são uploads de usuários (a música de um não pode virar
 * opção pro outro). Se a pasta não existir nesta máquina (ela não vai no git),
 * a lista volta vazia e a tela cai no "sorteada pela IA" sem quebrar.
 */

const DIR_MUSICAS = path.join(process.cwd(), "bot shopee", "entrada", "musicas");

const EXTS_AUDIO = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);

/** Nome de exibição: sem extensão e sem o sufixo "(youtube)" dos downloads. */
function nomeLimpo(arquivo: string) {
  return (
    arquivo
      .slice(0, arquivo.length - path.extname(arquivo).length)
      .replace(/\(youtube\)/gi, "")
      .replace(/\s+/g, " ")
      .trim() || arquivo
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  let arquivos: string[] = [];
  try {
    arquivos = await fs.readdir(DIR_MUSICAS);
  } catch {
    arquivos = []; // sem a pasta nesta máquina: só a opção sorteada
  }

  const musicas = arquivos
    .filter(
      (f) =>
        EXTS_AUDIO.has(path.extname(f).toLowerCase()) &&
        !f.toLowerCase().startsWith("job_"),
    )
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    // `arquivo` é o que volta no envio do job (a fábrica acha a trilha por ele);
    // `nome` é só pra tela
    .map((arquivo) => ({ arquivo, nome: nomeLimpo(arquivo) }));

  return NextResponse.json({ musicas });
}
