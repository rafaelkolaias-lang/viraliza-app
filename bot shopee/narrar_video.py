# -*- coding: utf-8 -*-
"""
Motor de NARRACAO: gera voz (ElevenLabs) + legenda sincronizada na fala
(timestamps) + video com voz por cima e musica abaixando sozinha (ducking).
"""
import os
import sys
import math
import base64
import subprocess
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings

import uso

load_dotenv()

BASE = os.path.dirname(os.path.abspath(__file__))
_FF_BIN = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFMPEG = os.path.join(_FF_BIN, "ffmpeg.exe")
FFPROBE = os.path.join(_FF_BIN, "ffprobe.exe")
if not os.path.exists(FFMPEG):
    FFMPEG, FFPROBE = "ffmpeg", "ffprobe"

DIR_VIDEOS = os.path.join(BASE, "entrada", "videos")
DIR_MUSICAS = os.path.join(BASE, "entrada", "musicas")
DIR_SAIDA = os.path.join(BASE, "saida")
DIR_TEMP = os.path.join(BASE, "temp")

W, H, FPS = 1080, 1920, 24
MUSIC_VOLUME = 0.22        # musica fica baixa (a voz manda)
MUSIC_START = 15           # comeca a musica nesse segundo (pega um trecho)
MUSICA_PREFERIDA = "vender"  # usa a musica cujo nome tem isso (a "para vender produtos")
FADE = 1.0
CRF = 18
AUDIO_KBPS = "256k"

# Voz: Laura (gratis) por enquanto. Apos upgrade, troque pela sua:
VOICE_ID = os.getenv("ELEVEN_VOICE_ID", "FGY2WhTYpPnrIDTdsKH5")  # Laura (free)
MODELO_VOZ = "eleven_multilingual_v2"

# Voz TRANQUILA/calma: stability alta = estavel/serena; style baixo = menos dramatica;
# speed < 1 = fala um pouco mais devagar.
VOICE_SETTINGS = VoiceSettings(
    stability=0.62,
    similarity_boost=0.85,
    style=0.15,
    use_speaker_boost=True,
    speed=0.95,
)

# estilo legenda
FONTE = "Arial"
FONTE_TAMANHO = 76
MARGEM_VERTICAL = 300
CONTORNO = 5

# -------------------- PRODUTOS --------------------
PRODUTOS = {
    "brazil": {
        "match": "Couple",
        "saida": "brazil_narrado.mp4",
        "texto": "Gente, olha que coisa linda... a camisa do Brasil pra vocês dois combinarem! "
                 "Edição especial da torcida. Corre no link, que tá voando!",
    },
    "shopee": {
        "match": "br-11110107",
        "saida": "shopee_narrado.mp4",
        "texto": "Olha que peça incrível... essa decoração transforma qualquer cantinho da sua casa. "
                 "Corre no link, e garante o seu!",
    },
    "meia": {
        # quando subir o video, inclua "meia" no nome do arquivo (ou me avise)
        "match": "meia",
        "saida": "meia_narrado.mp4",
        "texto": "Amiga, presta atenção nisso... essa meia-calça PARECE fininha, "
                 "mas por dentro é forradinha de lã. Quentinha no frio, "
                 "e ainda modela o corpo, segura a barriga e levanta o bumbum. "
                 "Corre no link, que tá saindo rápido!",
    },
    # Video 1 (o longo, "video bom meia calça"): narracao longa, SEM musica
    "meia1": {
        "match": "bom",
        "saida": "meia_narrado_1.mp4",
        "max_dur": 50,
        "texto": "Amiga, presta atenção que isso aqui vai mudar o seu inverno... "
                 "Essa meia-calça térmica PARECE uma meia fininha, transparente, "
                 "mas por dentro ela é toda forradinha de lã. Olha que coisa! "
                 "Ela segura o frio de verdade, e mantém as suas pernas quentinhas o dia inteiro. "
                 "E não é só isso, não... ela modela o seu corpo, "
                 "controla a barriguinha, levanta o bumbum, e deixa as pernas com aquela curva linda. "
                 "O tecido é super elástico, não deforma, não escorrega, e não fica marcando. "
                 "Tem com pezinho, dá pra usar com bota, com vestido, com saia, com o que você quiser. "
                 "E tem do P ao GG, pra todo tipo de corpo. "
                 "O envio é em vinte e quatro horas, e se não gostar, devolve o seu dinheiro. "
                 "Corre no link, amiga, que tá saindo voando!",
    },
}
PRODUTO = sys.argv[1] if len(sys.argv) > 1 else "brazil"


# --------------------- RODÍZIO DE CHAVES (ElevenLabs) ----------------------
# A cota grátis é ~10k caracteres/mês POR chave. Com várias chaves, quando uma
# estoura, a gente pula sozinho pra próxima — e grava qual está valendo, porque o
# worker abre um Python novo a cada job (senão começaria sempre pela chave morta).
def _carregar_keys():
    raw = os.getenv("ELEVENLABS_API_KEYS", "") or ""
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    # aceita também ELEVENLABS_API_KEY / _2 / _3 / _4 (sem duplicar)
    for nome in ("ELEVENLABS_API_KEY", "ELEVENLABS_API_KEY_2",
                 "ELEVENLABS_API_KEY_3", "ELEVENLABS_API_KEY_4"):
        v = (os.getenv(nome) or "").strip()
        if v and v not in keys:
            keys.append(v)
    return keys


_ELEVEN_KEYS = _carregar_keys()
_ELEVEN_IDX_FILE = os.path.join(BASE, "temp", ".eleven_key_idx")


def _eleven_ler_idx():
    """Qual chave começar (a última que funcionou)."""
    if not _ELEVEN_KEYS:
        return 0
    try:
        with open(_ELEVEN_IDX_FILE) as f:
            return int(f.read().strip()) % len(_ELEVEN_KEYS)
    except Exception:
        return 0


def _eleven_salvar_idx(i):
    try:
        os.makedirs(os.path.dirname(_ELEVEN_IDX_FILE), exist_ok=True)
        with open(_ELEVEN_IDX_FILE, "w") as f:
            f.write(str(i))
    except Exception:
        pass


def _tts_uma_chave(api_key, texto, mp3_path, voice_id=None, contabilizar=True):
    """Faz a chamada na ElevenLabs com UMA chave. Pode lançar exceção (cota/erro).
    contabilizar=False (BYO): não soma o custo, porque é a conta do próprio usuário."""
    client = ElevenLabs(api_key=api_key)
    resp = client.text_to_speech.convert_with_timestamps(
        voice_id=voice_id or VOICE_ID, model_id=MODELO_VOZ, text=texto,
        output_format="mp3_44100_128",
        voice_settings=VOICE_SETTINGS,
    )
    audio_b64 = getattr(resp, "audio_base_64", None) or getattr(resp, "audio_base64", None)
    if not audio_b64:
        raise RuntimeError("resposta sem áudio")
    with open(mp3_path, "wb") as f:
        f.write(base64.b64decode(audio_b64))
    if contabilizar:
        uso.add_eleven(len(texto))  # custo ElevenLabs = nº de caracteres da fala

    al = resp.alignment
    chars = al.characters
    ini = al.character_start_times_seconds
    fim = al.character_end_times_seconds

    # reconstroi palavras a partir dos caracteres
    palavras, atual, p_ini, p_fim = [], "", None, None
    for c, ti, tf in zip(chars, ini, fim):
        if c.strip() == "":
            if atual:
                palavras.append((atual, p_ini, p_fim)); atual = ""; p_ini = None
        else:
            if p_ini is None:
                p_ini = ti
            atual += c; p_fim = tf
    if atual:
        palavras.append((atual, p_ini, p_fim))
    dur = fim[-1] if fim else 0.0
    return dur, palavras


# ---------------------------------------------------------------------------
def gerar_voz_com_tempos(texto, mp3_path, voice_id=None, api_key=None):
    """Gera a voz e devolve (duracao, palavras[(palavra, ini, fim)]).
    Reveza entre todas as chaves: se uma estourou a cota (ou deu qualquer erro),
    tenta a próxima — e lembra a que funcionou pro próximo job.
    voice_id = voz escolhida no Estúdio; None usa a voz padrão (VOICE_ID).
    api_key = chave do usuário (BYO): usa SÓ ela (conta dele) e NÃO contabiliza
    custo na plataforma; None usa o rodízio das chaves da plataforma."""
    if api_key:
        return _tts_uma_chave(api_key, texto, mp3_path, voice_id, contabilizar=False)

    if not _ELEVEN_KEYS:
        raise RuntimeError("Nenhuma chave ElevenLabs no .env (ELEVENLABS_API_KEYS).")

    inicio = _eleven_ler_idx()
    erros = []
    for n in range(len(_ELEVEN_KEYS)):
        i = (inicio + n) % len(_ELEVEN_KEYS)
        try:
            res = _tts_uma_chave(_ELEVEN_KEYS[i], texto, mp3_path, voice_id)
            if i != inicio:
                _eleven_salvar_idx(i)  # essa virou a chave atual
                print(f"   [ElevenLabs] usando a chave #{i + 1}/{len(_ELEVEN_KEYS)}", flush=True)
            return res
        except Exception as e:
            erros.append(f"chave #{i + 1}: {e}")
            print(f"   [ElevenLabs] chave #{i + 1} falhou ({e}); tentando a próxima...", flush=True)
            continue

    raise RuntimeError(
        "Todas as chaves ElevenLabs falharam (cota esgotada?):\n  " + "\n  ".join(erros)
    )


def agrupar_em_frases(palavras, max_palavras=4):
    """Agrupa palavras em frases curtas (legenda estilo TikTok)."""
    frases, buff = [], []
    fecha = (".", "!", "?", ",")
    for palavra, pi, pf in palavras:
        buff.append((palavra, pi, pf))
        termina = palavra and palavra[-1] in fecha
        if len(buff) >= max_palavras or termina:
            txt = " ".join(w for w, _, _ in buff).rstrip(",")
            frases.append((txt, buff[0][1], buff[-1][2]))
            buff = []
    if buff:
        txt = " ".join(w for w, _, _ in buff).rstrip(",")
        frases.append((txt, buff[0][1], buff[-1][2]))
    return frases


def t(seg):
    h = int(seg // 3600); m = int((seg % 3600) // 60); s = seg % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def gerar_ass(frases, caminho):
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fala,{FONTE},{FONTE_TAMANHO},&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,{CONTORNO},2,2,70,70,{MARGEM_VERTICAL},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = [f"Dialogue: 0,{t(i)},{t(f)},Fala,,0,0,0,,{txt}" for txt, i, f in frases]
    with open(caminho, "w", encoding="utf-8") as fp:
        fp.write(cab + "\n".join(ev) + "\n")


def achar_musica():
    exts = (".mp3", ".m4a", ".opus", ".wav", ".aac")
    arqs = [f for f in sorted(os.listdir(DIR_MUSICAS)) if f.lower().endswith(exts)]
    if not arqs:
        return None
    # prefere a musica "para vender produtos"
    pref = [f for f in arqs if MUSICA_PREFERIDA.lower() in f.lower()]
    escolhida = pref[0] if pref else arqs[0]
    return os.path.join(DIR_MUSICAS, escolhida)


def duracao(path):
    out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=noprint_wrappers=1:nokey=1", path],
                         capture_output=True, text=True)
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


MAX_DUR = 35.0   # corta videos longos demais (TikTok/Shopee curto converte mais)


def build_final(video, musica, voz_mp3, dur_voz, ass_rel, saida,
                usar_musica=True, max_dur=MAX_DUR):
    dur_video = duracao(video)
    # a duracao segue a narracao (+ respiro), respeitando o teto max_dur
    dur_final = min(dur_voz + 1.0, max_dur)
    if dur_final < dur_video and not usar_musica:
        pass  # ok, o video so vai ate a narracao acabar
    dur_final = min(max(dur_final, 2.0), max_dur)

    # se a duracao final for maior que o clipe, repete o clipe (loop)
    loops = 0
    if dur_video < dur_final - 0.05:
        loops = math.ceil(dur_final / dur_video) - 1

    fim_fade = max(0.0, dur_final - FADE)
    video_f = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[vp];"
        f"[vp]subtitles={ass_rel.replace(os.sep, '/')}[vout];"
    )
    if usar_musica:
        audio_f = (
            f"[1:a]atrim={MUSIC_START}:{MUSIC_START + dur_final},asetpts=N/SR/TB,"
            f"volume={MUSIC_VOLUME}[mus];"
            f"[2:a]asplit=2[vfala][vkey];"
            f"[mus][vkey]sidechaincompress=threshold=0.02:ratio=12:attack=5:release=300[musduck];"
            f"[musduck][vfala]amix=inputs=2:duration=first:normalize=0,"
            f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim_fade}:d={FADE}[aout]"
        )
    else:
        # so a voz, sem musica
        audio_f = (
            f"[1:a]afade=t=in:st=0:d=0.2,"
            f"afade=t=out:st={fim_fade}:d={FADE},apad[aout]"
        )

    cmd = [FFMPEG, "-y"]
    if loops > 0:
        cmd += ["-stream_loop", str(loops)]
    cmd += ["-i", video]
    if usar_musica:
        cmd += ["-i", musica, "-i", voz_mp3]
    else:
        cmd += ["-i", voz_mp3]
    cmd += ["-filter_complex", video_f + audio_f,
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
            "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", AUDIO_KBPS,
            "-r", str(FPS), "-t", f"{dur_final:.2f}",
            "-movflags", "+faststart", saida]
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
    if r.returncode == 0:
        print(f"     OK ({dur_final:.1f}s) -> {os.path.basename(saida)}")
        return True
    print("     ERRO ffmpeg:\n", r.stderr[-1500:])
    return False


def main():
    os.makedirs(DIR_SAIDA, exist_ok=True)
    os.makedirs(DIR_TEMP, exist_ok=True)
    cfg = PRODUTOS[PRODUTO]

    cand = sorted(f for f in os.listdir(DIR_VIDEOS) if cfg["match"].lower() in f.lower())
    if not cand:
        print(f"ERRO: nenhum video com '{cfg['match']}'"); sys.exit(1)
    musica = achar_musica()

    # Gera a voz UMA vez e reaproveita em todos os videos (economiza creditos)
    print(f"Produto: {PRODUTO} | voz: {VOICE_ID} | {len(cand)} video(s)")
    print("Gerando voz na ElevenLabs...")
    voz_mp3 = os.path.join(DIR_TEMP, f"voz_{PRODUTO}.mp3")
    dur_voz, palavras = gerar_voz_com_tempos(cfg["texto"], voz_mp3)
    frases = agrupar_em_frases(palavras)
    print(f"Voz: {dur_voz:.1f}s | {len(palavras)} palavras | {len(frases)} frases\n")

    ass_rel = os.path.join("temp", f"fala_{PRODUTO}.ass")
    gerar_ass(frases, os.path.join(BASE, ass_rel))

    base_nome, ext = os.path.splitext(cfg["saida"])
    ok = 0
    for i, fnome in enumerate(cand, 1):
        video = os.path.join(DIR_VIDEOS, fnome)
        saida_nome = cfg["saida"] if len(cand) == 1 else f"{base_nome}_{i}{ext}"
        saida = os.path.join(DIR_SAIDA, saida_nome)
        print(f"[{i}/{len(cand)}] {fnome}")
        if build_final(video, musica, voz_mp3, dur_voz, ass_rel, saida,
                       usar_musica=cfg.get("musica", True),
                       max_dur=cfg.get("max_dur", MAX_DUR)):
            ok += 1
    print(f"\nConcluido: {ok}/{len(cand)} videos em {DIR_SAIDA}")


if __name__ == "__main__":
    main()
