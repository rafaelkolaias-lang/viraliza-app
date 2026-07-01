/** Status de um pedido de vídeo na fila de render. */
export type VideoStatus =
  | "na_fila"
  | "renderizando"
  | "processando"
  | "pronto"
  | "erro";

export type VideoFormato = "legenda" | "voz";

/** Uma variante pronta: o vídeo + miniatura + legenda + hashtags pra postar. */
export interface VideoMidia {
  /** caminho local (/videos/<id>/x.mp4) - pode ser vazio quando o vídeo está só no Drive */
  arquivo: string;
  /** id do arquivo no Google Drive - quando presente, tocamos/baixamos do Drive */
  driveId?: string;
  /** id do JPG da miniatura (frame real) no Drive - capa instantânea e confiável */
  thumbDriveId?: string;
  thumb?: string;
  legenda?: string;
  hashtags?: string;
}

export interface VideoJob {
  id: string;
  produto: string;
  /** "produto" (fábrica), "cortes" (clipador), "template" (em lote)... */
  tipo: string;
  formato: VideoFormato;
  status: VideoStatus;
  variantes: number;
  /** ISO date string */
  criadoEm: string;
  /** preenchido quando status === "pronto" */
  duracaoSeg?: number;
  /** caminhos web dos vídeos prontos (ex: /videos/<id>/x.mp4) */
  saidas?: string[];
  /** vídeos prontos com legenda/hashtags/miniatura (formato novo) */
  midias?: VideoMidia[];
  /** mensagem quando status === "erro" */
  erro?: string;
  /** fase atual do render (ex: "Renderizando 1/2"); só enquanto está em produção */
  etapa?: string;
  /** créditos debitados por este vídeo (custo real). undefined = não cobrado (admin/demo) */
  creditosGastos?: number;
}

/** Vídeo viral baixado do Telegram (feed da página "Vídeos virais"). */
export interface ViralVideo {
  id: string;
  titulo: string;
  categoria?: string;
  /** link do produto extraído da legenda */
  link?: string;
  /** caminho do arquivo servido pela web (ex: /virais/xxx.mp4) - quando já baixado */
  arquivo?: string;
  /** miniatura (1º frame) pra prévia rápida (ex: /virais/xxx.jpg) */
  thumb?: string;
  /** id do arquivo no Google Drive (quando hospedado lá) */
  driveId?: string;
  /** id do JPG da miniatura (frame real) no Drive - capa instantânea */
  thumbDriveId?: string;
  duracaoSeg: number;
  adicionadoEm: string;
  canal?: string;
}

/** Produto viral (imagem) baixado do Telegram - feed "Produtos virais". */
export interface ViralProduto {
  id: string;
  titulo: string;
  /** link do produto extraído da legenda */
  link?: string;
  /** caminho da imagem servida pela web (ex: /produtos/xxx.jpg) */
  arquivo?: string;
  /** id da imagem no Google Drive (quando hospedada lá) */
  driveId?: string;
  adicionadoEm: string;
  canal?: string;
}

export type MaterialTipo = "pacote" | "video" | "musica" | "imagem" | "outro";

/** Material pra baixar na Área do membro (pacote de vídeos/músicas/imagens, etc.). */
export interface Material {
  id: string;
  titulo: string;
  descricao?: string;
  /** link externo (Drive/Mega...) OU caminho local servido pela web (/downloads/x.zip) */
  url: string;
  tipo?: MaterialTipo;
  /** tamanho em texto livre, ex: "1.2 GB" */
  tamanho?: string;
  adicionadoEm: string;
}
