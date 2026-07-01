# -*- coding: utf-8 -*-
"""
Motor de montagem de anuncio vertical (9:16) - VideosIA
Junta video(s) + musica de fundo (trecho + fade) + texto de venda na tela.
Gera varios anuncios de uma vez (jobs). Base para o futuro GUI.
"""
import os
import subprocess
import sys

# ---------------------------------------------------------------------------
# CONFIG GERAL
# ---------------------------------------------------------------------------
BASE = os.path.dirname(os.path.abspath(__file__))
_FF_BIN = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFMPEG = os.path.join(_FF_BIN, "ffmpeg.exe")
FFPROBE = os.path.join(_FF_BIN, "ffprobe.exe")
if not os.path.exists(FFMPEG):
    FFMPEG, FFPROBE = "ffmpeg", "ffprobe"  # cai no PATH

DIR_VIDEOS = os.path.join(BASE, "entrada", "videos")
DIR_MUSICAS = os.path.join(BASE, "entrada", "musicas")
DIR_SAIDA = os.path.join(BASE, "saida")
DIR_TEMP = os.path.join(BASE, "temp")

W, H, FPS = 1080, 1920, 24
MUSIC_VOLUME = 0.30        # volume da musica de fundo (0.0 a 1.0)
MUSIC_START = 90           # comeca a musica nesse segundo (pula a introducao)
FADE = 1.0                 # segundos de fade in/out da musica

# Estilo da legenda
FONTE = "Arial"
FONTE_TAMANHO = 72
COR_TEXTO = "&H00FFFFFF"     # branco (ASS: &HAABBGGRR)
COR_CONTORNO = "&H00000000"  # contorno preto
CONTORNO = 4
MARGEM_VERTICAL = 280        # distancia da base (px)

# Qualidade de exportacao (master para postar)
CRF = 18                     # menor = melhor qualidade (18 e otimo)
AUDIO_KBPS = "256k"


# ---------------------------------------------------------------------------
# FUNCOES
# ---------------------------------------------------------------------------
def duracao(path):
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def achar_musica():
    exts = (".mp3", ".m4a", ".opus", ".wav", ".aac")
    arqs = [f for f in sorted(os.listdir(DIR_MUSICAS)) if f.lower().endswith(exts)]
    return os.path.join(DIR_MUSICAS, arqs[0]) if arqs else None


def fmt_tempo(seg):
    h = int(seg // 3600)
    m = int((seg % 3600) // 60)
    s = seg % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def gerar_ass(legendas, caminho):
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Venda,{FONTE},{FONTE_TAMANHO},{COR_TEXTO},{COR_CONTORNO},&H64000000,1,0,0,0,100,100,0,0,1,{CONTORNO},2,2,60,60,{MARGEM_VERTICAL},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    linhas = [f"Dialogue: 0,{fmt_tempo(i)},{fmt_tempo(f)},Venda,,0,0,0,,{t}"
              for t, i, f in legendas]
    with open(caminho, "w", encoding="utf-8") as fp:
        fp.write(cab + "\n".join(linhas) + "\n")


def build_video(videos, legendas, nome_saida, musica):
    """Monta UM anuncio: lista de clipes + legendas -> arquivo final."""
    dur_total = sum(duracao(v) for v in videos)
    print(f"  -> {nome_saida} | {len(videos)} clipe(s) | {dur_total:.1f}s")

    ass_rel = os.path.join("temp", os.path.splitext(nome_saida)[0] + ".ass")
    gerar_ass(legendas, os.path.join(BASE, ass_rel))

    cmd = [FFMPEG, "-y"]
    for v in videos:
        cmd += ["-i", v]
    cmd += ["-i", musica]
    n = len(videos)
    idx_mus = n

    concat_in = "".join(
        f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[v{i}];"
        for i in range(n)
    )
    concat_refs = "".join(f"[v{i}]" for i in range(n))
    fim_fade = max(0.0, dur_total - FADE)
    filtro = (
        concat_in
        + f"{concat_refs}concat=n={n}:v=1:a=0[vc];"
        + f"[vc]subtitles={ass_rel.replace(os.sep, '/')}[vout];"
        + f"[{idx_mus}:a]atrim={MUSIC_START}:{MUSIC_START + dur_total},"
        + f"asetpts=N/SR/TB,volume={MUSIC_VOLUME},"
        + f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim_fade}:d={FADE}[aout]"
    )

    saida = os.path.join(DIR_SAIDA, nome_saida)
    cmd += [
        "-filter_complex", filtro,
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
        "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", AUDIO_KBPS,
        "-r", str(FPS), "-movflags", "+faststart",
        saida,
    ]
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True)
    if r.returncode != 0:
        print("     ERRO ffmpeg:\n", r.stderr[-1500:])
        return False
    return True


# ---------------------------------------------------------------------------
# LEGENDAS (edite a copy aqui)
# ---------------------------------------------------------------------------
COPY_COMBINADO = [
    ("Transforme seu cantinho", 0.3, 4.0),
    ("Decoração minimalista premium", 4.0, 8.0),
    ("Disponível em preto e bege", 8.0, 12.0),
    ("Confira no link", 12.0, 16.0),
]
COPY_SOLO = [
    ("Decoração que transforma o ambiente", 0.3, 4.0),
    ("Confira no link", 4.0, 8.0),
]


def main():
    os.makedirs(DIR_SAIDA, exist_ok=True)
    os.makedirs(DIR_TEMP, exist_ok=True)

    musica = achar_musica()
    if not musica:
        print("ERRO: nenhuma musica em entrada/musicas")
        sys.exit(1)

    # Identifica os clipes por cor (pelo nome do arquivo)
    todos = [os.path.join(DIR_VIDEOS, f) for f in sorted(os.listdir(DIR_VIDEOS))
             if f.lower().endswith((".mp4", ".mov", ".mkv", ".webm"))]
    preto = next((v for v in todos if "shelf" in v.lower()), todos[0] if todos else None)
    bege = next((v for v in todos if "shelf" not in v.lower()), None)
    if not preto or not bege:
        print("ERRO: nao encontrei os 2 clipes (preto/bege).")
        sys.exit(1)

    print(f"Musica: {os.path.basename(musica)} (a partir de {MUSIC_START}s)")
    print(f"PRETO: {os.path.basename(preto)}")
    print(f"BEGE : {os.path.basename(bege)}\n")

    jobs = [
        ([preto, bege], COPY_COMBINADO, "ambos_preto_bege.mp4"),
        ([bege, preto], COPY_COMBINADO, "ambos_bege_preto.mp4"),
        ([preto],       COPY_SOLO,      "solo_preto.mp4"),
        ([bege],        COPY_SOLO,      "solo_bege.mp4"),
    ]
    ok = 0
    for videos, copy, nome in jobs:
        if build_video(videos, copy, nome, musica):
            ok += 1
    print(f"\nConcluido: {ok}/{len(jobs)} videos em {DIR_SAIDA}")


if __name__ == "__main__":
    main()
