/**
 * Montagem do Editor automático PRO: a ordem dos clipes, os cortes, o clipe principal,
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
   * Só para apoio em VÍDEO: de que segundo DO ARQUIVO sai o pedaço que vai pra
   * tela. Um apoio de 30 segundos não entra inteiro (ele fica de 0,8 a 6s no ar),
   * então isto diz QUAL pedaço desses 30 aparece. `undefined` = do começo do
   * corte, como sempre foi. Em foto não faz sentido e é ignorado.
   */
  trecho?: number;
  /**
   * Só para apoio: quanto tempo a cena fica NA TELA, escolhido pela pessoa no
   * painel da etapa de aprovação (alças de tamanho da régua). `undefined` = vale
   * a regra automática (`duracaoApoio`). Quando existe, ele MANDA no render
   * (dono, 11/08/2026): quem redimensionou na mão não quer o limite automático
   * encolhendo de volta.
   */
  dura?: number;
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
/** Descrição da cena: o MESMO teto do Textarea da tela (06/08/2026, era 160).
 *  Subiu junto com o campo virar Textarea: com 160 o servidor cortava calado o
 *  que a pessoa escrevia a mais. */
export const MAX_DESCRICAO_CHARS = 640;

// ---------------------------------------------------------------------------
// REGRAS DE TAMANHO do Editor automático PRO (definidas pelo dono em 05/08/2026).
// Valem na tela, na API e no render, pra não dar pra furar por fora.
// ---------------------------------------------------------------------------
/** O Editor não faz vídeo maior que isso, e o clipe principal também não passa. */
export const MAX_VIDEO_SEG = 120;
/** Cada cena de apoio pode ter no máximo 1 minuto de arquivo. */
export const MAX_APOIO_SEG = 60;
/** Cabe 1 cena de apoio a cada 5 segundos do clipe principal (dono, 06/08/2026:
 *  era 10, dobrou). Atenção ao dobrar de novo: com o vídeo no teto de 2 min já
 *  são 24 cenas possíveis, e 24 cenas de 6s (144s) não cabem em 120s - as
 *  últimas começam a ser derrubadas pelo `planejarApoios`. */
export const SEG_POR_APOIO = 5;
/** Teto por arquivo enviado (defesa contra encher o disco do servidor). */
export const MAX_ARQUIVO_MB = 300;

/**
 * Quanto tempo uma cena de apoio fica NA TELA (não é o tamanho do arquivo dela,
 * que pode ter até `MAX_APOIO_SEG`: é o pedaço que aparece por cima da base).
 * Menos de 2s vira piscada; mais de 4s a pessoa some do próprio vídeo
 * (dono, tarefa 31: era 0,8 a 6). Mesmos números do `fabrica.py`.
 */
export const APOIO_MIN = 2;
export const APOIO_MAX = 4;

/**
 * NARRAÇÃO: quanto tempo a fala costuma durar, em segundos.
 *
 * Isto NÃO é um limite, é uma estimativa pra tela avisar antes de gerar. Ela
 * importa porque no modo narração quem manda no tamanho do vídeo é a voz: o
 * render termina exatamente quando a fala acaba (`_montar_sequencial`, `-t
 * total`), então mídia que sobra é simplesmente cortada fora.
 *
 * Os dois números saem do pedido que a fábrica faz à IA ("texto falado natural
 * de ~12 a 18 segundos", em `gemini_copy.py`, formato voz). **Mexeu no pedido
 * lá, mexa aqui**: é este par que a tela promete pra pessoa antes de gerar.
 */
export const NARRACAO_IA_SEG: readonly [number, number] = [12, 18];

/**
 * NARRAÇÃO: o mínimo que uma cena fica na tela quando elas estão sendo
 * espremidas pra caber na fala. Abaixo disso vira piscada e ninguém vê o que é.
 * Mesmo número do `NARRACAO_CENA_MIN` do `fabrica.py`: é ele que decide quantas
 * cenas cabem numa fala, e a tela precisa avisar as mesmas que o render deixar
 * de fora.
 */
export const NARRACAO_CENA_MIN = 1.2;

/**
 * Ritmo de locução em palavras por segundo, pra estimar quanto tempo o texto
 * que a PESSOA escreveu vai levar pra ser lido. É aproximação de narração em
 * português (perto de 150 palavras por minuto): o tempo real só existe depois
 * que a voz é gerada, e varia com a voz e com a pontuação.
 */
export const PALAVRAS_POR_SEG = 2.5;

/**
 * Estimativa de quanto a narração vai durar, em `[min, max]` de segundos.
 *
 * Sem texto (a IA é quem vai escrever) devolve a faixa que a fábrica pede a
 * ela. Com texto, conta as palavras e abre 20% pros dois lados, que é a folga
 * honesta pra uma locução que ainda não foi gerada.
 */
export function segundosDaNarracao(texto: string): [number, number] {
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  if (!palavras) return [NARRACAO_IA_SEG[0], NARRACAO_IA_SEG[1]];
  const seg = palavras / PALAVRAS_POR_SEG;
  return [seg * 0.8, seg * 1.2];
}

/**
 * FOTO de apoio: ela não tem movimento próprio, então cansa se passar de 3s;
 * o piso de 1s existe pra ela não virar um flash (dono, tarefa 31: o mínimo
 * era 2). O teto vale só pra foto; vídeo de apoio continua indo até `APOIO_MAX`.
 */
export const IMAGEM_MIN_SEG = 1;
export const IMAGEM_MAX_SEG = 3;

/**
 * Piso do tamanho MANUAL (painel da etapa de aprovação). Quem redimensiona na
 * mão pode furar os limites automáticos acima, mas abaixo de meio segundo a
 * cena vira um flash que a transição de 0,3s de cada lado engole inteiro.
 * Mesmo número do `DURA_MANUAL_MIN` do `fabrica.py`.
 */
export const DURA_MANUAL_MIN = 0.5;

/**
 * Transição suave na entrada e na saída de cada cena de apoio. Curta de
 * propósito: acima de ~0,4s o corte deixa de parecer edição e começa a parecer
 * atraso. Sai dos dois lados do corte, então gasta esse tempo da cena.
 */
export const TRANSICAO_SEG = 0.3;

/**
 * Som das cenas de apoio. Elas entravam MUDAS; agora entram baixinho e abaixam
 * mais ainda enquanto a pessoa está falando na base (ducking automático), pra o
 * barulho do apoio nunca disputar com a fala.
 */
export const VOL_APOIO = 40;
export const VOL_APOIO_FALANDO = 10;

/**
 * Quantos quadros de cada cena a IA olha pra escrever a descrição e escolher o
 * melhor pedaço. Eram 3 (começo, meio e fim); com 5 ela enxerga o movimento
 * dentro do clipe e consegue apontar QUAL trecho vale a pena mostrar.
 * Mexeu aqui, mexa no `QUADROS_CENA` do `bot shopee/fabrica.py`.
 */
export const QUADROS_ANALISE = 5;
export const MARCAS_ANALISE = [0.1, 0.3, 0.5, 0.7, 0.9] as const;

/**
 * Melhorias de montagem que a plataforma aplica sozinha. Vêm todas ligadas: são
 * o que separa "clipes emendados" de vídeo editado. Ficam desligáveis porque
 * quem já gravou com a edição pronta não quer a plataforma mexendo por cima.
 */
export type EdicaoAvancada = {
  /** zoom lento nas fotos (Ken Burns), pra elas não ficarem paradas na tela */
  kenBurns: boolean;
  /** transição suave na entrada e na saída de cada cena de apoio */
  transicoes: boolean;
  /** som do apoio entra baixo e abaixa mais quando a pessoa fala */
  somApoio: boolean;
  /** a IA escolhe o melhor PEDAÇO do vídeo de apoio, em vez do começo do corte */
  trechoInteligente: boolean;
};

/**
 * O `somApoio` é o único que vem DESLIGADO (06/08/2026): ele é o que mexe no que
 * se OUVE, e na maioria dos vídeos o barulho de fundo da cena de apoio (vento,
 * televisão, a voz de outra pessoa) só atrapalha a fala do clipe principal. Os
 * outros três mexem só na imagem e melhoram qualquer vídeo, então vêm ligados.
 */
export const EDICAO_PADRAO: EdicaoAvancada = {
  kenBurns: true,
  transicoes: true,
  somApoio: false,
  trechoInteligente: true,
};

/** Lê as opções de edição avançada de um payload cru (tudo ligado por padrão). */
export function normalizarEdicao(bruto: unknown): EdicaoAvancada {
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const liga = (v: unknown, padrao: boolean) =>
    v === undefined || v === null ? padrao : v !== false && v !== "0" && v !== 0;
  return {
    kenBurns: liga(o.kenBurns, EDICAO_PADRAO.kenBurns),
    transicoes: liga(o.transicoes, EDICAO_PADRAO.transicoes),
    somApoio: liga(o.somApoio, EDICAO_PADRAO.somApoio),
    trechoInteligente: liga(o.trechoInteligente, EDICAO_PADRAO.trechoInteligente),
  };
}

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
    const out = Number(Math.min(fim, ini + MAX_VIDEO_SEG).toFixed(2));
    // tamanho manual escolhido no painel: só vale em apoio, com o mesmo teto de
    // material da conta da tela (a `duracaoApoio` refina depois; isto é a rede)
    const temDura = papel === "apoio" && num(o.dura, 0) > 0;
    const dura = temDura
      ? Number(
          limitar(
            num(o.dura),
            DURA_MANUAL_MIN,
            tipo === "image" ? MAX_VIDEO_SEG : Math.max(DURA_MANUAL_MIN, out - ini),
          ).toFixed(2),
        )
      : undefined;
    // de que ponto do corte sai o pedaço que vai pra tela: só vale em vídeo de
    // apoio, e nunca pode cair fora do corte que a pessoa fez
    const temTrecho =
      papel === "apoio" && tipo === "video" && Number.isFinite(num(o.trecho, NaN));
    const durTela = duracaoApoio({ tipo, in: ini, out, dura: dura ?? null });
    itens.push({
      nome,
      tipo,
      ordem: Math.max(0, Math.round(num(o.ordem, itens.length))),
      in: Number(ini.toFixed(2)),
      out,
      papel,
      ...(papel === "apoio" ? { entra: temEntra ? Number(Math.max(0, num(o.entra)).toFixed(2)) : null } : {}),
      ...(dura !== undefined ? { dura } : {}),
      ...(temTrecho
        ? { trecho: Number(limitar(num(o.trecho), ini, Math.max(ini, out - durTela)).toFixed(2)) }
        : {}),
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
      if (usados >= cabem) continue; // passou de 1 cena a cada SEG_POR_APOIO: fica de fora
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

/**
 * Quanto tempo essa cena de apoio fica NA TELA.
 *
 * Foto e vídeo têm regras diferentes de propósito: a foto é parada, então ela
 * precisa de pelo menos 2 segundos pra a pessoa ver o que é (e mais de 3 cansa);
 * o vídeo já tem movimento e vale o corte que a pessoa fez, dentro dos limites.
 *
 * TAMANHO MANUAL (dono, 11/08/2026): quando a pessoa redimensionou a cena no
 * painel da etapa de aprovação (`dura`), o número dela MANDA e os limites
 * automáticos acima não valem. O vídeo só não fica na tela mais tempo do que
 * tem de material cortado; a foto é parada e pode segurar o quanto for.
 *
 * A mesma conta roda na tela (pra prévia não mentir) e no render.
 */
export function duracaoApoio(clip: {
  tipo: TipoClip;
  in: number;
  out: number;
  dura?: number | null;
}): number {
  const cortado = Math.max(0, clip.out - clip.in);
  if (typeof clip.dura === "number" && Number.isFinite(clip.dura) && clip.dura > 0) {
    if (clip.tipo === "image") {
      return limitar(clip.dura, DURA_MANUAL_MIN, MAX_VIDEO_SEG);
    }
    return limitar(clip.dura, DURA_MANUAL_MIN, Math.max(DURA_MANUAL_MIN, cortado));
  }
  if (clip.tipo === "image") {
    return limitar(cortado || IMAGEM_MAX_SEG, IMAGEM_MIN_SEG, IMAGEM_MAX_SEG);
  }
  return limitar(cortado, APOIO_MIN, APOIO_MAX);
}

/** A pessoa escolheu o tamanho desta cena na mão? (é o que troca o piso) */
export function duraManual(clip: { dura?: number | null }): boolean {
  return typeof clip.dura === "number" && Number.isFinite(clip.dura) && clip.dura > 0;
}

/** Uma cena de apoio já colocada na linha do tempo da base. */
export type MarcaApoio = {
  /** índice do apoio na lista que entrou */
  i: number;
  /** em que segundo da base ela aparece */
  entra: number;
  /** quanto tempo fica na tela */
  dur: number;
  /** true = quem escolheu o momento foi a distribuição automática, não a pessoa */
  auto: boolean;
};

/**
 * Onde cada cena de apoio entra na linha da base.
 *
 * Quem a pessoa arrastou manda; o resto ganha a MESMA distribuição em intervalos
 * iguais que o render usa quando a IA não responde, pra a prévia da tela não
 * prometer uma coisa e o vídeo entregar outra. Depois empurra pra frente o que
 * ficou sobreposto e derruba o que não couber, igual à fábrica faz.
 *
 * Só entram os primeiros apoios que cabem na regra de 1 cena a cada
 * `SEG_POR_APOIO` segundos.
 */
export function planejarApoios(
  apoios: { tipo: TipoClip; in: number; out: number; entra?: number | null; dura?: number | null }[],
  durBase: number,
): MarcaApoio[] {
  const cabem = apoios.slice(0, maxApoios(durBase));
  const marcas = cabem.map((c, i) => ({
    i,
    dur: duracaoApoio(c),
    entra: c.entra ?? (durBase * (i + 1)) / (cabem.length + 1),
    auto: c.entra === null || c.entra === undefined,
  }));
  marcas.sort((a, b) => a.entra - b.entra);
  const saida: MarcaApoio[] = [];
  let cursor = 0;
  for (const m of marcas) {
    const entra = Math.max(cursor, Math.min(m.entra, durBase));
    const dur = Math.min(m.dur, durBase - entra);
    // o piso é por tipo: foto vale a partir de 1s, vídeo a partir de 2s. Medir
    // foto pela régua do vídeo derrubava aqui uma cena que a API tinha aceitado,
    // e a prévia da tela deixava de bater com o que o render entrega.
    // Tamanho MANUAL vale a partir de meio segundo: quem encolheu a cena na mão
    // não pode vê-la morrer na régua do automático.
    const minDur = duraManual(cabem[m.i])
      ? DURA_MANUAL_MIN
      : cabem[m.i].tipo === "image"
        ? IMAGEM_MIN_SEG
        : APOIO_MIN;
    if (dur < minDur) continue;
    saida.push({ i: m.i, entra, dur, auto: m.auto });
    cursor = entra + dur;
  }
  return saida;
}
