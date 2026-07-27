import "server-only";

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { subirAvatar } from "@/lib/serverrk-upload";

/**
 * PONTE DEV (só localhost roda o robô): dirige o Selenium do Grok
 * (VideosIAdev/robo_grok.py) a partir do app pra gerar o vídeo do avatar + produto.
 * O robô usa o Brave já logado do Lucas, gera e baixa o mp4; aqui a gente SOBE o mp4
 * pro serverrk (mesma casa da outra mídia), pra ter uma URL http que funciona no
 * localhost e em produção, e que deixa o vídeo editável/watermarkável. FUTURO: o
 * robô inteiro vai pro serverrk (ver serverrk-infra).
 *
 * Requisitos na máquina: `python navegador.py --sim` rodando (Brave com porta de
 * depuração, logado no Grok). Configurável por env: VIDEO_ROBOT_DIR (pasta do
 * VideosIAdev) e VIDEO_ROBOT_PYTHON (comando do python, default "python").
 */

const DIR = process.env.VIDEO_ROBOT_DIR || "D:/aplicacao-viraliza/VideosIAdev";
const PYTHON = process.env.VIDEO_ROBOT_PYTHON || "python";

export type ArquivoImagem = { bytes: Buffer; ext: string };

export type ResultadoVideo = {
  ok: boolean;
  videoUrl?: string; // URL http do serverrk (media.univershoop.com/avatares/<id>.mp4)
  erro?: string;
  log?: string;
};

/** Roda o robô do Grok e devolve a URL local do vídeo (ou um erro legível). */
export async function gerarVideoGrok(opts: {
  prompt: string;
  avatar: ArquivoImagem;
  produtos: ArquivoImagem[];
  cenarioRef?: ArquivoImagem; // foto de referência do cenário (casa), opcional
  duracaoSeg: number;
}): Promise<ResultadoVideo> {
  const id = randomUUID();
  const tmp = path.join(os.tmpdir(), "viraliza-video", id);
  await mkdir(tmp, { recursive: true });

  try {
    // 1. grava avatar + produtos em arquivos temporários (o robô recebe caminhos)
    const avatarPath = path.join(tmp, `avatar.${opts.avatar.ext}`);
    await writeFile(avatarPath, opts.avatar.bytes);

    const produtoPaths: string[] = [];
    for (let i = 0; i < opts.produtos.length; i++) {
      const p = path.join(tmp, `produto-${i + 1}.${opts.produtos[i].ext}`);
      await writeFile(p, opts.produtos[i].bytes);
      produtoPaths.push(p);
    }

    // o cenário entra por ÚLTIMO (o prompt avisa que a última foto é só o ambiente)
    let cenarioPath: string | null = null;
    if (opts.cenarioRef) {
      cenarioPath = path.join(tmp, `cenario.${opts.cenarioRef.ext}`);
      await writeFile(cenarioPath, opts.cenarioRef.bytes);
    }

    const dur = [6, 10, 15].includes(opts.duracaoSeg) ? opts.duracaoSeg : 6;
    const nomeSaida = `${id}.mp4`;

    // 2. roda o robô: python robo_grok.py --prompt ... --imagens avatar produtos [cenario] ...
    const args = [
      "robo_grok.py",
      "--prompt",
      opts.prompt,
      "--imagens",
      avatarPath,
      ...produtoPaths,
      ...(cenarioPath ? [cenarioPath] : []),
      "--duracao",
      String(dur),
      "--qualidade",
      "720p",
      "--saida",
      nomeSaida,
    ];

    const { code, log } = await rodar(PYTHON, args, DIR, 600_000);

    const mp4Origem = path.join(DIR, "saida", "grok", nomeSaida);
    if (code !== 0) {
      return { ok: false, erro: mensagemDoLog(log), log };
    }

    // 3. sobe o mp4 pro serverrk (mesma casa da outra mídia). A URL http funciona
    //    no localhost e em produção, e deixa o vídeo editável/watermarkável.
    const mp4 = await readFile(mp4Origem);
    const url = await subirAvatar(nomeSaida, mp4, "video/mp4");
    if (!url) {
      return { ok: false, erro: "Vídeo gerado, mas falhou ao salvar no servidor.", log };
    }

    return { ok: true, videoUrl: url, log };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao rodar o robô." };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

/** Roda um processo e junta stdout+stderr. Rejeita no timeout. */
function rodar(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number; log: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, windowsHide: true });
    let log = "";
    const captura = (d: Buffer) => {
      log += d.toString();
    };
    proc.stdout.on("data", captura);
    proc.stderr.on("data", captura);

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("O robô demorou demais (timeout). O Brave está aberto e logado?"));
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Não consegui iniciar o python: ${err.message}. Ajuste VIDEO_ROBOT_PYTHON.`));
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, log });
    });
  });
}

/** Tira do log a linha de erro mais útil pro usuário. */
function mensagemDoLog(log: string): string {
  const l = log.toLowerCase();
  if (l.includes("porta de depuração") || l.includes("navegador.py --sim")) {
    return "O Brave não está aberto na porta de depuração. Rode: python navegador.py --sim (e faça login no Grok).";
  }
  if (l.includes("recus")) return "O Grok recusou o pedido. Ajuste o prompt e tente de novo.";
  if (l.includes("não veio vídeo") || l.includes("desisti depois")) {
    return "O vídeo não ficou pronto a tempo. Tente de novo.";
  }
  const linhas = log.trim().split("\n");
  return linhas[linhas.length - 1]?.slice(0, 200) || "Falha ao gerar o vídeo.";
}
