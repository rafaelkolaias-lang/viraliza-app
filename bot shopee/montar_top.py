# -*- coding: utf-8 -*-
"""
Motor TOP (musica-protagonista): intercala clipes + fotos do produto + musica
em destaque + legendas de venda. Sem narracao.
Fotos entram com fundo desfocado (nao corta a imagem).
"""
import os
import sys
import subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
_FF_BIN = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFMPEG = os.path.join(_FF_BIN, "ffmpeg.exe")
FFPROBE = os.path.join(_FF_BIN, "ffprobe.exe")
if not os.path.exists(FFMPEG):
    FFMPEG, FFPROBE = "ffmpeg", "ffprobe"

DIR_VIDEOS = os.path.join(BASE, "entrada", "videos")
DIR_IMAGENS = os.path.join(BASE, "entrada", "imagens")
DIR_MUSICAS = os.path.join(BASE, "entrada", "musicas")
DIR_SAIDA = os.path.join(BASE, "saida")
DIR_TEMP = os.path.join(BASE, "temp")

W, H, FPS = 1080, 1920, 24
CRF = 18
AUDIO_KBPS = "256k"
FADE = 1.0

FONTE = "Arial"
FONTE_TAMANHO = 76
MARGEM_VERTICAL = 640     # distancia do TOPO (legenda na parte superior, antes do meio)
CONTORNO = 5

# -------------------- PRODUTOS --------------------
PRODUTOS = {
    "lolive": {
        "match": "Woman_in_Brasil",
        "music_match": "Que Nada",
        "music_start": 8,
        "music_volume": 0.40,                 # bem mais baixa (era 0.90 -> 0.55 -> 0.40)
        "saida": "lolive_brasil_top.mp4",
        "imagens": [                          # (arquivo, duracao em s)
            ("WhatsApp Image 2026-06-11 at 12.32.45 (1).jpeg", 2.5),
            ("WhatsApp Image 2026-06-11 at 12.32.46 (3).jpeg", 3.0),
        ],
        "legendas": [
            "Conjunto Brasil L'Olive",
            "Realça a silhueta e modela o corpo",
            "Tecido macio, não fica transparente",
            "Disponível em 4 cores",
            "Estoque limitado, corre no link",
        ],
    },
    "legging": {
        "match": "Woman_showing_fitness",
        "clip_dur": 6.1,                       # corta o video em 6,1s, depois as fotos
        "music_match": "Desafiar",             # MC Sapao FitDance
        "music_start": 134,                    # a partir de 2:14
        "music_volume": 0.45,
        "ordem": "sequencial",
        "saida": "legging_aqn.mp4",
        # legenda fixa: aparece so durante o video, some na transicao das fotos
        "legenda_fixa": "não acredito que achei o top e a legging de academia que não marca",
        "emoji_png": "assets/frog.png",        # sapinho verde sobreposto (Arial nao tem)
        "imagens": [
            ("lagging ftins.jpg", 3.0),        # infografico de beneficios
            ("nao marca lagging2.jpg", 3.0),   # caimento / alta cobertura
        ],
        "legendas": [],
    },
    "calcinha": {
        "match": "calcinhas lindas",
        "music_match": "sensualizar",
        "music_start": 35,                    # a partir de 0:35
        "music_volume": 0.40,
        "ordem": "sequencial",                # video primeiro, depois as fotos
        "saida": "calcinha_kit.mp4",
        "preco": "APENAS R$ 11,98",           # preco bem aparente no topo
        "imagens": [
            ("calcinhas lindas.jpg", 3.0),
            ("calcinha no corpo.jpg", 3.0),
        ],
        "legendas": [
            "Renda sensual e delicada",
            "Forro de algodão",
            "Antifúngica e respirável",
            "Ajuste que se adapta ao corpo",
            "Qualidade premium",
            "Garanta agora o seu kit",
        ],
    },
}
PRODUTO = sys.argv[1] if len(sys.argv) > 1 else "lolive"


def duracao(path):
    out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                          "-of", "default=noprint_wrappers=1:nokey=1", path],
                         capture_output=True, text=True, errors="replace")
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def achar_musica(match):
    exts = (".mp3", ".m4a", ".opus", ".wav", ".aac")
    arqs = [f for f in sorted(os.listdir(DIR_MUSICAS)) if f.lower().endswith(exts)]
    pref = [f for f in arqs if match.lower() in f.lower()]
    escolhida = (pref or arqs or [None])[0]
    return os.path.join(DIR_MUSICAS, escolhida) if escolhida else None


def imagem_para_clip(img_path, dur, saida):
    """Transforma uma foto num clipe 9:16 com fundo desfocado (nao corta a foto)."""
    filtro = (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"boxblur=22:2,eq=brightness=-0.08[bgb];"
        f"[fg]scale={W}:{H}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1,fps={FPS},format=yuv420p[v]"
    )
    cmd = [FFMPEG, "-y", "-loop", "1", "-t", f"{dur}", "-i", img_path,
           "-filter_complex", filtro, "-map", "[v]", "-t", f"{dur}",
           "-c:v", "libx264", "-preset", "fast", "-crf", str(CRF),
           "-pix_fmt", "yuv420p", saida]
    r = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if r.returncode != 0:
        print("ERRO ao converter imagem:\n", r.stderr[-1000:])
        return False
    return True


def t(seg):
    h = int(seg // 3600); m = int((seg % 3600) // 60); s = seg % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def gerar_ass(textos, dur_total, caminho, preco=None, legenda_fixa=None, fixa_ate=None):
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Venda,{FONTE},{FONTE_TAMANHO},&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,{CONTORNO},2,8,70,70,{MARGEM_VERTICAL},1
Style: Preco,{FONTE},100,&H0000FFFF,&H000000FF,&H00000000,1,0,0,0,100,100,0,0,3,10,0,8,40,40,150,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    if legenda_fixa:
        # uma legenda fixa do inicio ate fixa_ate (some na transicao das fotos)
        ate = fixa_ate if fixa_ate else dur_total
        ev.append(f"Dialogue: 0,{t(0)},{t(ate)},Venda,,0,0,0,,{legenda_fixa}")
    else:
        # distribui as legendas igualmente ao longo do video
        seg = dur_total / max(1, len(textos))
        for i, txt in enumerate(textos):
            ini = i * seg + 0.2
            fim = (i + 1) * seg - 0.1
            ev.append(f"Dialogue: 0,{t(ini)},{t(fim)},Venda,,0,0,0,,{txt}")
    # preco bem aparente o video inteiro (caixa amarela/vermelha no topo)
    if preco:
        ev.append(f"Dialogue: 1,{t(0)},{t(dur_total)},Preco,,0,0,0,,{preco}")
    with open(caminho, "w", encoding="utf-8") as fp:
        fp.write(cab + "\n".join(ev) + "\n")


def main():
    os.makedirs(DIR_SAIDA, exist_ok=True)
    os.makedirs(DIR_TEMP, exist_ok=True)
    cfg = PRODUTOS[PRODUTO]

    reais = sorted(os.path.join(DIR_VIDEOS, f) for f in os.listdir(DIR_VIDEOS)
                   if cfg["match"].lower() in f.lower()
                   and f.lower().endswith((".mp4", ".mov", ".mkv", ".webm")))
    if not reais:
        print(f"ERRO: nenhum video com '{cfg['match']}'"); sys.exit(1)

    # converte as fotos em clipes
    img_clipes = []
    for j, (arq, dur) in enumerate(cfg.get("imagens", [])):
        src = os.path.join(DIR_IMAGENS, arq)
        if not os.path.exists(src):
            print(f"AVISO: imagem nao encontrada: {arq}"); continue
        out = os.path.join(DIR_TEMP, f"img_{PRODUTO}_{j}.mp4")
        if imagem_para_clip(src, dur, out):
            img_clipes.append(out)

    # clip_dur: corta o video real em N segundos (None = inteiro)
    clip_dur = cfg.get("clip_dur")
    reais_t = [(r, clip_dur) for r in reais]
    imgs_t = [(ic, None) for ic in img_clipes]
    # ordem: "sequencial" (clipes e depois fotos) ou "intercalado" (clipe, foto...)
    if cfg.get("ordem", "intercalado") == "sequencial":
        sequencia = reais_t + imgs_t
    else:
        sequencia = []
        a, b = list(reais_t), list(imgs_t)
        while a or b:
            if a:
                sequencia.append(a.pop(0))
            if b:
                sequencia.append(b.pop(0))

    musica = achar_musica(cfg["music_match"])
    if not musica:
        print("ERRO: musica nao encontrada"); sys.exit(1)

    def _dur(item):
        p, lim = item
        d = duracao(p)
        return min(d, lim) if lim else d
    dur_total = sum(_dur(it) for it in sequencia)
    print(f"Produto: {PRODUTO} | {len(reais)} clipe(s) + {len(img_clipes)} foto(s) | {dur_total:.1f}s")
    nome_mus = os.path.basename(musica).encode("ascii", "replace").decode()
    print(f"Musica: {nome_mus} (vol {cfg['music_volume']})")

    # duracao da parte de VIDEO (clipes reais) -> a legenda fixa some quando entram as fotos
    dur_video_parte = sum(_dur(it) for it in sequencia if it in reais_t)

    ass_rel = os.path.join("temp", f"top_{PRODUTO}.ass")
    gerar_ass(cfg.get("legendas", []), dur_total, os.path.join(BASE, ass_rel),
              preco=cfg.get("preco"),
              legenda_fixa=cfg.get("legenda_fixa"),
              fixa_ate=dur_video_parte)

    n = len(sequencia)
    ms, mv = cfg["music_start"], cfg["music_volume"]
    fim_fade = max(0.0, dur_total - FADE)

    emoji_path = cfg.get("emoji_png")
    emoji_full = os.path.join(BASE, emoji_path) if emoji_path else None
    emoji_ok = bool(emoji_full and os.path.exists(emoji_full))
    idx_emoji = n + 1  # entra depois da musica

    concat_in = "".join(
        f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[v{i}];"
        for i in range(n))
    refs = "".join(f"[v{i}]" for i in range(n))

    sub_lbl = "[vsub]" if emoji_ok else "[vout]"
    filtro_v = (concat_in
                + f"{refs}concat=n={n}:v=1:a=0[vc];"
                + f"[vc]subtitles={ass_rel.replace(os.sep, '/')}{sub_lbl};")
    if emoji_ok:
        # sapinho centralizado logo abaixo da legenda, some junto com ela
        filtro_v += (f"[{idx_emoji}:v]scale=130:-1[fr];"
                     f"[vsub][fr]overlay=(W-w)/2:935:"
                     f"enable='between(t,0,{dur_video_parte:.2f})'[vout];")
    filtro = (filtro_v
              + f"[{n}:a]atrim={ms}:{ms + dur_total},asetpts=N/SR/TB,volume={mv},"
              + f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim_fade}:d={FADE}[aout]")

    saida = os.path.join(DIR_SAIDA, cfg["saida"])
    cmd = [FFMPEG, "-y"]
    for p, lim in sequencia:
        if lim:
            cmd += ["-t", f"{lim}", "-i", p]
        else:
            cmd += ["-i", p]
    cmd += ["-i", musica]
    if emoji_ok:
        cmd += ["-i", emoji_full]
    cmd += ["-filter_complex", filtro,
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
            "-profile:v", "high", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", AUDIO_KBPS,
            "-r", str(FPS), "-movflags", "+faststart", saida]
    r = subprocess.run(cmd, cwd=BASE, capture_output=True, text=True, errors="replace")
    if r.returncode == 0:
        print("OK! Salvo em:", saida)
    else:
        print("ERRO ffmpeg:\n", r.stderr[-1800:]); sys.exit(1)


if __name__ == "__main__":
    main()
