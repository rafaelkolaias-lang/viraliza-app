# -*- coding: utf-8 -*-
"""
Motor "REC" - veste um video ja bonito com musica + legenda + selo REC piscando.
Para videos sem audio (b-roll/produto) no estilo gravacao ao vivo.
"""
import os
import subprocess
import sys

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
MUSIC_VOLUME = 0.30
MUSIC_START = 90
FADE = 1.0
CRF = 18
AUDIO_KBPS = "256k"

# ---- PRODUTOS: escolha qual rodar (1o argumento da linha de comando) ----
# Cada produto: "match" (parte do nome do arquivo do video) + saida + legendas.
# Pode e DEVE usar acentos normalmente (arquivo e UTF-8).
PRODUTOS = {
    "shopee": {
        "match": "br-11110107",
        "saida": "rec_shopee.mp4",
        "legendas": [
            ("Olha que peça incrível", 0.5, 5.0),
            ("Decoração minimalista pra sua casa", 5.0, 10.0),
            ("Estatueta + vaso com suculenta", 10.0, 15.0),
            ("Disponível em preto e bege", 15.0, 20.0),
            ("Confira no link e garanta o seu", 20.0, 99.0),
        ],
    },
    "brazil": {
        "match": "Couple",
        "saida": "brazil_casal.mp4",
        "legendas": [
            ("Vista o Brasil com estilo", 0.4, 3.0),
            ("Edição especial da torcida", 3.0, 5.5),
            ("Confira no link", 5.5, 99.0),
        ],
    },
}
PRODUTO = sys.argv[1] if len(sys.argv) > 1 else "brazil"

# estilo legenda
FONTE = "Arial"
FONTE_TAMANHO = 70
MARGEM_VERTICAL = 280
CONTORNO = 4


def duracao(path):
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True)
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def achar_musica():
    exts = (".mp3", ".m4a", ".opus", ".wav", ".aac")
    arqs = [f for f in sorted(os.listdir(DIR_MUSICAS)) if f.lower().endswith(exts)]
    return os.path.join(DIR_MUSICAS, arqs[0]) if arqs else None


def t(seg):
    h = int(seg // 3600); m = int((seg % 3600) // 60); s = seg % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def gerar_ass(legendas, dur, caminho):
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Venda,{FONTE},{FONTE_TAMANHO},&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,{CONTORNO},2,2,60,60,{MARGEM_VERTICAL},1
Style: Rec,{FONTE},54,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,0,7,60,60,70,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = [f"Dialogue: 0,{t(i)},{t(min(f, dur))},Venda,,0,0,0,,{txt}"
          for txt, i, f in legendas]

    # REC piscando: liga 0.5s, desliga 0.4s, ao longo de todo o video
    passo = 0.9
    x = 0.0
    while x < dur:
        ev.append(f"Dialogue: 1,{t(x)},{t(min(x + 0.5, dur))},Rec,,0,0,0,,{{\\c&H0000FF&}}● REC")
        x += passo

    with open(caminho, "w", encoding="utf-8") as fp:
        fp.write(cab + "\n".join(ev) + "\n")


def main():
    os.makedirs(DIR_SAIDA, exist_ok=True)
    os.makedirs(DIR_TEMP, exist_ok=True)

    if PRODUTO not in PRODUTOS:
        print(f"ERRO: produto '{PRODUTO}' nao existe. Opcoes: {list(PRODUTOS)}")
        sys.exit(1)
    cfg = PRODUTOS[PRODUTO]

    # acha o video pelo trecho do nome (match)
    candidatos = [f for f in os.listdir(DIR_VIDEOS) if cfg["match"].lower() in f.lower()]
    if not candidatos:
        print(f"ERRO: nenhum video com '{cfg['match']}' em {DIR_VIDEOS}"); sys.exit(1)
    video = os.path.join(DIR_VIDEOS, candidatos[0])

    musica = achar_musica()
    if not musica:
        print("ERRO: nenhuma musica em entrada/musicas"); sys.exit(1)

    dur = duracao(video)
    print(f"Produto: {PRODUTO} | Video: {candidatos[0]} ({dur:.1f}s)")

    ass_rel = os.path.join("temp", f"rec_{PRODUTO}.ass")
    gerar_ass(cfg["legendas"], dur, os.path.join(BASE, ass_rel))

    fim_fade = max(0.0, dur - FADE)
    filtro = (
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[vs];"
        f"[vs]subtitles={ass_rel.replace(os.sep, '/')}[vout];"
        f"[1:a]atrim={MUSIC_START}:{MUSIC_START + dur},asetpts=N/SR/TB,"
        f"volume={MUSIC_VOLUME},afade=t=in:st=0:d={FADE},"
        f"afade=t=out:st={fim_fade}:d={FADE}[aout]"
    )

    saida = os.path.join(DIR_SAIDA, cfg["saida"])
    cmd = [FFMPEG, "-y", "-i", video, "-i", musica,
           "-filter_complex", filtro,
           "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
           "-profile:v", "high", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", AUDIO_KBPS,
           "-r", str(FPS), "-movflags", "+faststart", saida]

    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
    if r.returncode == 0:
        print("OK! Salvo em:", saida)
    else:
        print("ERRO ffmpeg:\n", r.stderr[-1500:]); sys.exit(1)


if __name__ == "__main__":
    main()
