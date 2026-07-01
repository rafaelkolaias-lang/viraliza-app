/**
 * Base pública da mídia Shopee migrada pro serverrk (SSD + Cloudflare).
 * Vídeos: /virais/<id>.mp4 · thumbs: /thumbs/<id>.jpg · produtos: /produtos/<id>.jpg
 */
export const MEDIA_BASE =
  process.env.NEXT_PUBLIC_MEDIA_BASE || "https://media.univershoop.com";
