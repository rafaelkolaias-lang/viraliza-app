import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { driveThumb } from "@/lib/drive"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Imagem de um produto: do Drive (quando hospedado lá) ou do arquivo local.
 * `w` = largura do thumbnail do Drive.
 */
export function imagemProduto(
  p: { driveId?: string; arquivo?: string },
  w = 500,
): string | undefined {
  if (p.driveId) return driveThumb(p.driveId, w)
  return midiaUrl(p.arquivo)
}

/**
 * URL pra servir mídia gravada em runtime (vídeos/imagens/downloads).
 * O Next só serve estáticos do build, então passamos pela rota /api/midia.
 * Links externos (http...) passam sem mudança.
 */
export function midiaUrl(p?: string): string | undefined {
  if (!p) return p
  if (/^https?:\/\//i.test(p)) return p
  return `/api/midia${p.startsWith("/") ? p : "/" + p}`
}

/**
 * Link que FORÇA o download e funciona no celular (iOS/Android).
 * O `download` de um <a> é ignorado quando o link é de outro domínio, então:
 *  - link externo (http, ex.: media.univershoop.com) -> passa pelo proxy /api/baixar
 *  - arquivo local (/api/midia/...) -> usa ?dl=1 (Content-Disposition: attachment)
 * `src` já deve vir de midiaUrl()/driveDownload(). `nome` = nome do arquivo salvo.
 */
export function linkBaixar(src?: string, nome = "video"): string | undefined {
  if (!src) return undefined
  const q = `nome=${encodeURIComponent(nome)}`
  if (/^https?:\/\//i.test(src)) {
    return `/api/baixar?u=${encodeURIComponent(src)}&${q}`
  }
  return `${src}${src.includes("?") ? "&" : "?"}dl=1&${q}`
}

/**
 * Capa (thumbnail) de um corte. Como ainda não geramos um frame por vídeo,
 * usamos uma capa fixa por plataforma (imagens estáticas em /public/capas).
 * Detecta a origem pelo link; padrão = Shopee (todo o acervo atual é Shopee).
 * Se um dia houver um thumb real do vídeo, ele tem prioridade.
 */
export function capaCorte(v: { link?: string; thumb?: string }): string {
  if (v.thumb) return midiaUrl(v.thumb)!
  const l = (v.link || "").toLowerCase()
  if (l.includes("youtu")) return "/capas/youtube.png"
  if (l.includes("instagram")) return "/capas/instagram.png"
  if (l.includes("tiktok")) return "/capas/tiktok.png"
  return "/capas/shopee.png"
}

/** Hash estável (FNV-1a) de uma string -> inteiro sem sinal. */
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * "Vendidos" - prova social. Número ALEATÓRIO mas ESTÁVEL por item (derivado do id),
 * entre 2 mil e 600 mil. Arredondado pra ficar realista. Ex: "+3,2 mil vendidos".
 */
export function vendidosLabel(id: string): string {
  let n = 2000 + (hashSeed(id) % 598000) // [2000, 599999]
  if (n < 10000) n = Math.round(n / 100) * 100
  else if (n < 100000) n = Math.round(n / 1000) * 1000
  else n = Math.round(n / 10000) * 10000
  const mil = (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })
  return `+${mil} mil vendidos`
}
