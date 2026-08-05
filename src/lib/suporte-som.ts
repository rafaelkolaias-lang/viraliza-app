/**
 * Sonzinhos do chat de suporte (enviar e receber).
 *
 * São SINTETIZADOS no navegador (Web Audio), não são arquivo: nada pra baixar,
 * nada pra hospedar, nada que um redeploy possa perder. Dois bipes curtos e
 * baixos, no espírito do WhatsApp: subindo ao enviar, descendo ao receber.
 *
 * O navegador só deixa tocar som depois que a pessoa interage com a página. Aqui
 * isso nunca é problema, porque o primeiro som só sai quando ela clica em enviar.
 */

const CHAVE_SOM = "suporte_som";

type ComWebkit = Window & { webkitAudioContext?: typeof AudioContext };

let contexto: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!contexto) {
      const Classe = window.AudioContext ?? (window as ComWebkit).webkitAudioContext;
      if (!Classe) return null;
      contexto = new Classe();
    }
    // volta de uma aba que ficou em segundo plano
    if (contexto.state === "suspended") void contexto.resume();
    return contexto;
  } catch {
    return null;
  }
}

type Nota = { hz: number; em: number; dura: number };

/** Toca as notas com envelope curto (sem o "clique" de ligar/desligar seco). */
function tocar(notas: Nota[], volume: number) {
  const ctx = audio();
  if (!ctx) return;
  const agora = ctx.currentTime;
  for (const { hz, em, dura } of notas) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    const inicio = agora + em;
    ganho.gain.setValueAtTime(0, inicio);
    ganho.gain.linearRampToValueAtTime(volume, inicio + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dura);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + dura + 0.02);
  }
}

/**
 * Volume dos bipes. Estava discreto demais e o dono pediu o triplo (era 0,05 e
 * 0,07). Mesmo triplicado fica bem abaixo do teto de 1, que é onde o som
 * estouraria: aqui duas notas no máximo se encostam nas pontas.
 */
const VOL_ENVIAR = 0.15;
const VOL_RECEBER = 0.21;

/** Mandou: bipe curto subindo. */
export function somEnviar() {
  tocar(
    [
      { hz: 620, em: 0, dura: 0.07 },
      { hz: 880, em: 0.06, dura: 0.09 },
    ],
    VOL_ENVIAR,
  );
}

/** Chegou: bipe descendo, um pouco mais presente que o de enviar. */
export function somReceber() {
  tocar(
    [
      { hz: 880, em: 0, dura: 0.08 },
      { hz: 587, em: 0.08, dura: 0.13 },
    ],
    VOL_RECEBER,
  );
}

export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOM) !== "0";
  } catch {
    return true;
  }
}

export function guardarSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE_SOM, ligado ? "1" : "0");
  } catch {
    /* modo privado: vale só nesta visita */
  }
}
