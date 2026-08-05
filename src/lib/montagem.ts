/**
 * Montagem do Editor automático: a ordem dos clipes, os cortes, o clipe principal,
 * os textos escritos à mão e os volumes que a pessoa escolheu na tela.
 *
 * Antes tudo isso morria no servidor (`auditoria.md` #22 e #23): o editor mandava
 * e ninguém lia. Agora vira `opcoes.roteiro` / `opcoes.textos` / `opcoes.volumes`
 * no Job, o worker grava um `roteiro.json` e a fábrica monta POR ELE.
 *
 * Módulo puro (sem "server-only") de propósito: o editor no navegador usa os
 * mesmos tipos e a mesma normalização, então a tela e o render nunca divergem.
 */

export type PapelClip = "principal" | "apoio";
export type TipoClip = "video" | "image";
export type PosicaoTexto = "cima" | "meio" | "baixo";

/** Um clipe na linha do tempo, já cortado. */
export type ItemRoteiro = {
  /** nome do arquivo salvo na pasta de entrada (já sanitizado pelo servidor) */
  nome: string;
  tipo: TipoClip;
  ordem: number;
  /** corte: começo e fim DENTRO do arquivo original, em segundos */
  in: number;
  out: number;
  /**
   * "principal" = base do vídeo (o som dele fica). Pode haver VÁRIOS: eles tocam
   * em sequência, na ordem da lista, formando a base com a fala emendada.
   * "apoio" = entra por cima da base, mudo, e sai.
   */
  papel: PapelClip;
  /**
   * Só para apoio: em que segundo da linha do principal ele entra.
   * `null` = a IA escolhe o momento olhando a fala do principal.
   */
  entra?: number | null;
  /**
   * O que aparece nesse clipe, escrito pela pessoa (ex.: "close no tecido").
   * Serve pra DUAS coisas: a IA encaixar o apoio no trecho da fala que combina,
   * e a copy dela falar do que está na tela naquele momento.
   */
  descricao?: string;
};

/** Texto escrito à mão pela pessoa, com posição e janela de tempo. */
export type TextoRoteiro = {
  texto: string;
  pos: PosicaoTexto;
  /** tempo na linha do tempo GERAL do vídeo */
  in: number;
  out: number;
};

/** Volumes de cada camada de áudio, em % (0 a 100). */
export type Volumes = {
  /** som do clipe principal / som original dos vídeos */
  original: number;
  /** música de fundo (a que a pessoa subiu ou a automática) */
  musica: number;
  /** narração da IA (formato "Voz narrada") */
  voz: number;
};

/**
 * 100% = o volume natural do arquivo, em qualquer uma das faixas.
 * A música entra em 20% por padrão: ela é trilha de fundo e nesse nível não
 * atropela a fala. Som do vídeo e narração entram inteiros.
 */
export const VOLUMES_PADRAO: Volumes = { original: 100, musica: 20, voz: 100 };

/**
 * O som do vídeo e a narração vão até 150%: 100% é o volume natural do arquivo e
 * acima disso a plataforma AMPLIFICA, pra salvar gravação que ficou baixa. Um
 * limitador entra no render quando alguém passa de 100%, senão o som estoura.
 * A música fica em 0-100% de propósito: ela é trilha de fundo, não protagonista.
 */
export const MAX_VOLUME_BOOST = 150;
export const MAX_VOLUME_MUSICA = 100;

/** Tetos de segurança (defesa contra payload gigante no campo de opções). */
export const MAX_CLIPES = 40;
export const MAX_TEXTOS = 30;
export const MAX_TEXTO_CHARS = 200;
/** Descrição da cena: uma frase basta, e segura o tamanho do JSON de opções. */
export const MAX_DESCRICAO_CHARS = 160;

// ---------------------------------------------------------------------------
// REGRAS DE TAMANHO do Editor automático (definidas pelo dono em 05/08/2026).
// Valem na tela, na API e no render, pra não dar pra furar por fora.
// ---------------------------------------------------------------------------
/** O Editor não faz vídeo maior que isso, e o clipe principal também não passa. */
export const MAX_VIDEO_SEG = 120;
/** Cada cena de apoio pode ter no máximo 1 minuto de arquivo. */
export const MAX_APOIO_SEG = 60;
/** Cabe 1 cena de apoio a cada 10 segundos do clipe principal. */
export const SEG_POR_APOIO = 10;
/** Teto por arquivo enviado (defesa contra encher o disco do servidor). */
export const MAX_ARQUIVO_MB = 300;

/** "78 MB" - pra mensagem de erro dizer o tamanho de verdade. */
export function tamanhoEmMB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Quantas cenas de apoio cabem num principal dessa duração. */
export function maxApoios(durBase: number): number {
  return Math.max(0, Math.floor((durBase || 0) / SEG_POR_APOIO));
}

/**
 * Velocidades da música de fundo. O render usa time-stretch que PRESERVA O TOM
 * (rubberband, com atempo de reserva), então acelerar não vira voz de desenho
 * nem deixa a música grave demais: só muda o andamento.
 */
export const VELOCIDADES_MUSICA = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export const VELOCIDADE_PADRAO = 1;

/**
 * Corte de silêncio: quanto tempo sem fala o render pode tirar da base.
 * 0 = desligado. O corte vale pra imagem e pro som juntos (corte seco), e sai
 * uma folga nas pontas pra não engolir a respiração nem o início das palavras.
 */
export const SILENCIOS = [0, 0.5, 1, 1.5, 2] as const;

/** Só aceita um dos tempos da lista; qualquer outra coisa desliga o corte. */
export function normalizarSilencio(bruto: unknown): number {
  const n = typeof bruto === "string" ? Number(bruto) : (bruto as number);
  return SILENCIOS.find((v) => Math.abs(v - n) < 0.001) ?? 0;
}

/** Só aceita uma das velocidades da lista; qualquer outra coisa vira 1x. */
export function normalizarVelocidade(bruto: unknown): number {
  const n = typeof bruto === "string" ? Number(bruto) : (bruto as number);
  const achou = VELOCIDADES_MUSICA.find((v) => Math.abs(v - n) < 0.001);
  return achou ?? VELOCIDADE_PADRAO;
}

function num(v: unknown, padrao = 0): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : padrao;
}

function limitar(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Valida o roteiro que veio da tela.
 *
 * `nomes` é a lista de arquivos que REALMENTE foram salvos (já sanitizados) e
 * `sanitizar` é a mesma função que gerou esses nomes. Sem isso o roteiro
 * apontaria pro nome cru do arquivo do usuário e o render não acharia nada.
 * Item que não casa com um arquivo salvo é descartado. No upload em pedaços os
 * arquivos ainda não existem quando o job nasce: aí `nomes` vem `null` e a
 * checagem de existência é pulada (o nome já é sanitizado do mesmo jeito).
 */
export function normalizarRoteiro(
  bruto: unknown,
  nomes: Set<string> | null,
  sanitizar: (nome: string) => string,
): ItemRoteiro[] {
  if (!Array.isArray(bruto)) return [];
  const itens: ItemRoteiro[] = [];
  for (const cru of bruto.slice(0, MAX_CLIPES)) {
    if (!cru || typeof cru !== "object") continue;
    const o = cru as Record<string, unknown>;
    const nome = sanitizar(String(o.nome ?? ""));
    if (!nome || (nomes && !nomes.has(nome))) continue;
    const tipo: TipoClip = o.tipo === "image" ? "image" : "video";
    const ini = Math.max(0, num(o.in));
    const fim = Math.max(ini + 0.3, num(o.out, ini + 3));
    // imagem não tem som, então nunca pode ser a base do vídeo
    const papel: PapelClip = o.papel === "principal" && tipo === "video" ? "principal" : "apoio";
    const temEntra = o.entra !== null && o.entra !== undefined && Number.isFinite(num(o.entra, NaN));
    const descricao = String(o.descricao ?? "").trim().slice(0, MAX_DESCRICAO_CHARS);
    itens.push({
      nome,
      tipo,
      ordem: Math.max(0, Math.round(num(o.ordem, itens.length))),
      in: Number(ini.toFixed(2)),
      out: Number(Math.min(fim, ini + MAX_VIDEO_SEG).toFixed(2)),
      papel,
      ...(papel === "apoio" ? { entra: temEntra ? Number(Math.max(0, num(o.entra)).toFixed(2)) : null } : {}),
      ...(descricao ? { descricao } : {}),
    });
  }
  itens.sort((a, b) => a.ordem - b.ordem);
  return aplicarLimites(itens).map((it, i) => ({ ...it, ordem: i }));
}

/**
 * Aplica as regras de tamanho do Editor. A tela já avisa antes de gerar; isto
 * aqui é a rede de segurança do servidor, pra um pedido montado na mão não
 * conseguir pedir um vídeo de 10 minutos com 50 cenas.
 */
function aplicarLimites(itens: ItemRoteiro[]): ItemRoteiro[] {
  const bases = itens.filter((c) => c.papel === "principal");

  if (bases.length) {
    // os principais tocam em sequência e formam a base: a SOMA deles é a duração
    // do vídeo, e ela não passa de 2 minutos (corta no que estourar)
    const mantidos: ItemRoteiro[] = [];
    let durBase = 0;
    for (const b of bases) {
      const sobra = MAX_VIDEO_SEG - durBase;
      if (sobra < 0.5) break;
      const dur = Math.max(0, b.out - b.in);
      if (dur > sobra) b.out = Number((b.in + sobra).toFixed(2));
      durBase += Math.min(dur, sobra);
      mantidos.push(b);
    }
    const cabem = maxApoios(durBase);
    const saida: ItemRoteiro[] = [...mantidos];
    let usados = 0;
    for (const it of itens) {
      if (it.papel === "principal") continue; // já entraram acima, na ordem
      if (usados >= cabem) continue; // passou de 1 cena a cada 10s: fica de fora
      // cena de apoio: no máximo 1 minuto de arquivo
      it.out = Number(Math.min(it.out, it.in + MAX_APOIO_SEG).toFixed(2));
      usados += 1;
      saida.push(it);
    }
    return saida;
  }

  // sem principal, o vídeo é a soma dos clipes: corta onde passar de 2 minutos
  const saida: ItemRoteiro[] = [];
  let total = 0;
  for (const it of itens) {
    const dur = Math.max(0, it.out - it.in);
    const sobra = MAX_VIDEO_SEG - total;
    if (sobra < 0.5) break;
    if (dur > sobra) {
      it.out = Number((it.in + sobra).toFixed(2));
      saida.push(it);
      break;
    }
    total += dur;
    saida.push(it);
  }
  return saida;
}

/** Valida os textos escritos à mão (conteúdo, posição e janela de tempo). */
export function normalizarTextos(bruto: unknown): TextoRoteiro[] {
  if (!Array.isArray(bruto)) return [];
  const out: TextoRoteiro[] = [];
  for (const cru of bruto.slice(0, MAX_TEXTOS)) {
    if (!cru || typeof cru !== "object") continue;
    const o = cru as Record<string, unknown>;
    const texto = String(o.texto ?? "").trim().slice(0, MAX_TEXTO_CHARS);
    if (!texto) continue;
    const pos: PosicaoTexto =
      o.pos === "cima" || o.pos === "meio" ? (o.pos as PosicaoTexto) : "baixo";
    const ini = limitar(num(o.in), 0, MAX_VIDEO_SEG);
    const fim = limitar(num(o.out, ini + 3), ini + 0.2, MAX_VIDEO_SEG);
    out.push({ texto, pos, in: Number(ini.toFixed(2)), out: Number(fim.toFixed(2)) });
  }
  return out;
}

/** Valida os volumes. Som do vídeo e narração aceitam boost; música não. */
export function normalizarVolumes(bruto: unknown): Volumes {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  return {
    original: Math.round(
      limitar(num(o.original, VOLUMES_PADRAO.original), 0, MAX_VOLUME_BOOST),
    ),
    musica: Math.round(
      limitar(num(o.musica, VOLUMES_PADRAO.musica), 0, MAX_VOLUME_MUSICA),
    ),
    voz: Math.round(limitar(num(o.voz, VOLUMES_PADRAO.voz), 0, MAX_VOLUME_BOOST)),
  };
}

/** Os clipes marcados como principais, na ordem em que formam a base do vídeo. */
export function clipesPrincipais(roteiro: ItemRoteiro[]): ItemRoteiro[] {
  return roteiro.filter((c) => c.papel === "principal");
}

/**
 * Duração final do vídeo pela montagem.
 * Com principais, o vídeo dura a SOMA deles (os apoios entram POR CIMA e não
 * somam tempo); sem principal é a soma de todos os clipes, como sempre foi.
 */
export function duracaoMontagem(roteiro: ItemRoteiro[]): number {
  const bases = clipesPrincipais(roteiro);
  const lista = bases.length ? bases : roteiro;
  return lista.reduce((s, c) => s + Math.max(0, c.out - c.in), 0);
}
