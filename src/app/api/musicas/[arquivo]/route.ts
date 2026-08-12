import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/dal";

export const runtime = "nodejs";

/**
 * Toca UMA música da biblioteca da plataforma (prévia do seletor da etapa 4 do
 * Editor). Sem isso a pessoa escolhia a trilha pelo nome, no escuro; agora o
 * botãozinho de play do seletor busca o áudio aqui e a prévia respeita o mesmo
 * volume e velocidade da música própria (é o mesmo <audio> da tela).
 *
 * Só serve o que a listagem (`/api/musicas`) mostraria: arquivo de áudio da
 * pasta da biblioteca, nunca um `job_*` (upload de outro usuário) e nunca um
 * caminho fora da pasta (o `basename` corta qualquer tentativa).
 */

const DIR_MUSICAS = path.join(process.cwd(), "bot shopee", "entrada", "musicas");

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ arquivo: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const { arquivo } = await params;
  const nome = path.basename(decodeURIComponent(arquivo ?? ""));
  const tipo = MIME[path.extname(nome).toLowerCase()];
  if (!tipo || nome.toLowerCase().startsWith("job_")) {
    return NextResponse.json({ erro: "Música não encontrada." }, { status: 404 });
  }

  try {
    const buf = await fs.readFile(path.join(DIR_MUSICAS, nome));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": tipo,
        // a biblioteca muda raramente; 1h de cache poupa rebaixar o mesmo mp3
        // a cada play, e "private" impede um proxy de servir pra outra pessoa
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ erro: "Música não encontrada." }, { status: 404 });
  }
}
