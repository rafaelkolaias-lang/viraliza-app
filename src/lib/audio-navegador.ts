/**
 * Tira o ÁUDIO de um vídeo local dentro do navegador e devolve um WAV pequeno.
 *
 * Por que isso existe: pra IA dizer em que segundo cada cena de apoio entra, ela
 * precisa OUVIR a fala do vídeo principal. O transcritor (faster-whisper) mora na
 * máquina que renderiza, não no servidor do site, e subir o vídeo inteiro só pra
 * isso seria mandar centenas de megabytes pela rede da pessoa.
 *
 * Então a faixa de áudio é extraída aqui mesmo, no arquivo que já está na
 * máquina, e vai como WAV 16 kHz MONO: é o formato que os modelos de fala usam, e
 * dá ~2 MB por minuto (contra ~30 MB do vídeo). Mesmo princípio dos quadros que a
 * análise de cenas já tira com canvas.
 *
 * Módulo puro de navegador: nada aqui roda no servidor.
 */

/** Taxa de amostragem do WAV que sai daqui. 16 kHz é o padrão de fala: acima
 *  disso o arquivo cresce sem o modelo entender nada melhor. */
const TAXA = 16_000;

/** Um pedaço do vídeo principal, do jeito que ele entra na base. */
export type TrechoAudio = {
  file: File;
  /** corte dentro do arquivo, em segundos */
  inSec: number;
  outSec: number;
};

/** Junta os canais num só (mono) somando e dividindo: fala não precisa de estéreo. */
function paraMono(buffer: AudioBuffer, de: number, ate: number): Float32Array {
  const ini = Math.max(0, Math.floor(de * buffer.sampleRate));
  const fim = Math.min(buffer.length, Math.ceil(ate * buffer.sampleRate));
  const n = Math.max(0, fim - ini);
  const saida = new Float32Array(n);
  if (!n) return saida;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const dados = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) saida[i] += dados[ini + i];
  }
  if (buffer.numberOfChannels > 1) {
    for (let i = 0; i < n; i++) saida[i] /= buffer.numberOfChannels;
  }
  return saida;
}

/** Reamostra pra `TAXA` pegando o vizinho mais próximo: pra fala isso basta e é
 *  instantâneo (interpolar não muda nada no que o modelo entende). */
function reamostrar(amostras: Float32Array, taxaOrigem: number): Float32Array {
  if (taxaOrigem === TAXA) return amostras;
  const razao = taxaOrigem / TAXA;
  const n = Math.floor(amostras.length / razao);
  const saida = new Float32Array(n);
  for (let i = 0; i < n; i++) saida[i] = amostras[Math.floor(i * razao)] ?? 0;
  return saida;
}

/** Monta o arquivo WAV (cabeçalho de 44 bytes + PCM 16 bits) e devolve em base64. */
function wavBase64(amostras: Float32Array): string {
  const bytes = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(bytes);
  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };
  texto(0, "RIFF");
  v.setUint32(4, 36 + amostras.length * 2, true);
  texto(8, "WAVEfmt ");
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, TAXA, true);
  v.setUint32(28, TAXA * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por amostra
  v.setUint16(34, 16, true); // bits por amostra
  texto(36, "data");
  v.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) {
    const s = Math.max(-1, Math.min(1, amostras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  // base64 em blocos: `String.fromCharCode(...array)` estoura a pilha em áudio
  // de mais de uns segundos
  const b = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) {
    bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * Extrai a fala da base (um ou vários vídeos principais, já cortados) em um WAV
 * mono base64, com os trechos emendados na mesma ordem em que entram no vídeo.
 *
 * Devolve `null` quando não há áudio nenhum pra ouvir: vídeo mudo, arquivo que o
 * navegador não sabe decodificar, ou navegador sem `AudioContext`. Quem chama
 * segue sem áudio (a IA distribui pelas descrições) em vez de travar.
 */
export async function extrairAudioDaBase(
  trechos: TrechoAudio[],
): Promise<{ mime: string; base64: string } | null> {
  if (!trechos.length) return null;
  const Ctx =
    typeof window !== "undefined"
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined;
  if (!Ctx) return null;

  const ctx = new Ctx();
  try {
    const pedacos: Float32Array[] = [];
    for (const t of trechos) {
      try {
        const buffer = await ctx.decodeAudioData(await t.file.arrayBuffer());
        const mono = paraMono(buffer, t.inSec, Math.max(t.inSec, t.outSec));
        if (mono.length) pedacos.push(reamostrar(mono, buffer.sampleRate));
      } catch {
        // arquivo sem faixa de áudio, ou codec que este navegador não abre:
        // esse trecho fica de fora e os outros valem
      }
    }
    const total = pedacos.reduce((s, p) => s + p.length, 0);
    if (total < TAXA / 2) return null; // menos de meio segundo: não vale mandar

    const junto = new Float32Array(total);
    let pos = 0;
    for (const p of pedacos) {
      junto.set(p, pos);
      pos += p.length;
    }
    return { mime: "audio/wav", base64: wavBase64(junto) };
  } finally {
    ctx.close().catch(() => {});
  }
}
