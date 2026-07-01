/** Helpers de URL do Google Drive (vídeos hospedados no Drive, público). */

/** Thumbnail (1º frame) - leve, ideal pro grid. `w` = largura em px. */
export function driveThumb(id: string, w = 400): string {
  return `https://lh3.googleusercontent.com/d/${id}=w${w}`;
}

/** Player embutível (iframe) - só carregar quando o usuário clicar. */
export function drivePreview(id: string): string {
  return `https://drive.google.com/file/d/${id}/preview`;
}

/** Link de download direto. */
export function driveDownload(id: string): string {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}
