"use client";

/**
 * Normaliza uma imagem NO NAVEGADOR antes de enviar: decodifica (JPEG, PNG,
 * WebP, AVIF... o que o navegador ler) e re-exporta como JPEG de verdade via
 * canvas. Resolve o clássico "foto da Shopee/iPhone que é AVIF/HEIC com nome
 * .jpg" que o Grok e o gpt-image-1 recusam. De quebra limita o tamanho (lado
 * maior MAX_LADO) pra aliviar o upload. Falha = null (a UI avisa e não anexa).
 */

const MAX_LADO = 1600;

export function normalizarImagem(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width: w, height: h } = img;
        if (!w || !h) throw new Error("sem dimensão");
        const escala = Math.min(1, MAX_LADO / Math.max(w, h));
        w = Math.round(w * escala);
        h = Math.round(h * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("sem canvas");
        // fundo branco: JPEG não tem transparência (PNG transparente ficaria preto)
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      // o navegador não decodificou (ex: HEIC no Chrome): não dá pra usar
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** Mensagem padrão quando a imagem não pôde ser lida/convertida. */
export const ERRO_IMAGEM =
  "Não consegui ler essa imagem (formato não suportado, ex: HEIC). Tira um print dela ou salva como JPG/PNG e tenta de novo.";
