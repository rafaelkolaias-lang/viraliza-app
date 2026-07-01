// Gera a miniatura (frame real) de cada VÍDEO da Shopee e grava o thumbDriveId.
//
// Por quê: o Google NÃO serve poster de vídeo (lh3 → 404), então no acervo todos
// os cards caíam no logo da Shopee. Aqui a gente baixa cada vídeo do Drive, tira
// 1 frame com ffmpeg, sobe esse JPG pro Drive e guarda o ID no MySQL. A web passa
// a mostrar o frame real (imagem → instantâneo).
//
// Rodar no PC (com o túnel do MySQL ativo), DEPOIS do deploy que cria a coluna:
//   cd appV2 && node prisma/gerar-thumbs-shopee.mjs
// Pode interromper e rodar de novo - ele pula os que já têm thumb.

import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const exec = promisify(execFile);
const prisma = new PrismaClient();

const RCLONE = fs.existsSync("C:/Users/lucas/rclone/rclone.exe")
  ? "C:/Users/lucas/rclone/rclone.exe"
  : "rclone";
const FF =
  "C:/Users/lucas/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg.exe";
const FFMPEG = fs.existsSync(FF) ? FF : "ffmpeg";

const DRIVE_THUMBS = "gdrive:Acervo Viraliza/Shopee Videos Thumbs";
const CONCORRENCIA = 4;
const TMP = path.join(os.tmpdir(), "shopthumb");

async function idDoThumb(nome) {
  try {
    const { stdout } = await exec(RCLONE, ["lsjson", DRIVE_THUMBS], {
      maxBuffer: 64 * 1024 * 1024,
    });
    const item = JSON.parse(stdout || "[]").find((x) => x.Name === nome);
    return item?.ID ?? null;
  } catch {
    return null;
  }
}

async function processar(v, i, total) {
  const dir = path.join(TMP, v.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  try {
    // 1. baixa o vídeo pelo ID
    await exec(RCLONE, ["backend", "copyid", "gdrive:", v.driveId, dir + "/"], {
      maxBuffer: 8 * 1024 * 1024,
    });
    const baixado = fs
      .readdirSync(dir)
      .map((f) => path.join(dir, f))
      .find((f) => fs.statSync(f).isFile());
    if (!baixado) throw new Error("não baixou");

    // 2. tira 1 frame (1s) e escala pra 400 de largura
    const thumb = path.join(dir, `${v.id}.jpg`);
    await exec(FFMPEG, [
      "-y", "-ss", "1", "-i", baixado,
      "-frames:v", "1", "-vf", "scale=400:-2", thumb,
    ]);
    if (!fs.existsSync(thumb)) throw new Error("ffmpeg não gerou frame");

    // 3. sobe o JPG pro Drive e pega o ID
    const nome = `${v.id}.jpg`;
    await exec(RCLONE, ["copyto", thumb, `${DRIVE_THUMBS}/${nome}`]);
    const thumbId = await idDoThumb(nome);
    if (!thumbId) throw new Error("não achei o ID do thumb no Drive");

    // 4. grava no banco
    await prisma.videoShopee.update({
      where: { id: v.id },
      data: { thumbDriveId: thumbId },
    });
    console.log(`✓ [${i}/${total}] ${v.titulo?.slice(0, 40) ?? v.id}`);
  } catch (e) {
    console.log(`✗ [${i}/${total}] ${v.id}: ${String(e.message).slice(0, 80)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const pendentes = await prisma.videoShopee.findMany({
    where: { thumbDriveId: null },
    orderBy: { adicionadoEm: "desc" },
  });
  const total = pendentes.length;
  console.log(`${total} vídeo(s) sem miniatura. Gerando (${CONCORRENCIA} por vez)...`);

  let i = 0;
  // pool simples de concorrência
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= total) return;
      await processar(pendentes[idx], idx + 1, total);
    }
  }
  await Promise.all(Array.from({ length: CONCORRENCIA }, worker));

  console.log("Pronto! Miniaturas geradas.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
