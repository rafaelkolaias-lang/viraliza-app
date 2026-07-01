# -*- coding: utf-8 -*-
"""
LEGENDAR VÍDEO — legenda estilo TikTok que vai APARECENDO conforme a fala
(palavra por palavra), queimada no vídeo.

Pipeline: extrai áudio -> faster-whisper com tempo POR PALAVRA -> monta um .ass
com revelação progressiva (cada palavra surge no tempo certo) -> ffmpeg queima.

Tudo configurável (pra ligar no editor depois): posição, tamanho, cor.

Uso:
  python legendar_video.py video.mp4
  python legendar_video.py video.mp4 --pos baixo --size 56 --lang pt --out saida.mp4
"""
import os
import sys
import argparse
import subprocess

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_FF = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFMPEG = os.path.join(_FF, "ffmpeg.exe")
FFPROBE = os.path.join(_FF, "ffprobe.exe")
if not os.path.exists(FFMPEG):
    FFMPEG, FFPROBE = "ffmpeg", "ffprobe"


def log(m):
    print(m, flush=True)


def dimensoes(path):
    try:
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path],
            capture_output=True, text=True)
        w, h = out.stdout.strip().split("x")
        return int(w), int(h)
    except Exception:
        return 1080, 1920


def palavras_do_video(video, lang, modelo="small"):
    """Transcreve com tempo POR PALAVRA. Retorna [{w, ini, fim}]."""
    from faster_whisper import WhisperModel
    wav = os.path.splitext(video)[0] + ".legwav.wav"
    subprocess.run([FFMPEG, "-y", "-i", video, "-ac", "1", "-ar", "16000", "-vn", wav],
                   capture_output=True)
    nth = os.cpu_count() or 8
    log(f"→ transcrevendo por palavra (faster-whisper {modelo} · {nth} threads)...")
    wm = WhisperModel(modelo, device="cpu", compute_type="int8", cpu_threads=nth)
    idioma = None if lang in ("auto", "", None) else lang
    segs, info = wm.transcribe(wav, word_timestamps=True, vad_filter=True, language=idioma)
    palavras = []
    for s in segs:
        for w in (s.words or []):
            t = (w.word or "").strip()
            if t:
                palavras.append({"w": t, "ini": float(w.start), "fim": float(w.end)})
    try:
        os.remove(wav)
    except OSError:
        pass
    log(f"  {len(palavras)} palavras")
    return palavras


def _cs(seg):  # tempo em centésimos -> H:MM:SS.cc (formato do ASS)
    if seg < 0:
        seg = 0
    h = int(seg // 3600); m = int((seg % 3600) // 60)
    s = int(seg % 60); cs = int(round((seg - int(seg)) * 100))
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _esc(t):
    return t.replace("{", "(").replace("}", ")")


CORES_ASS = {  # &HBBGGRR (ASS)
    "amarelo": "&H0000FFFF",
    "branco": "&H00FFFFFF",
    "verde": "&H008AE82F",
}


def montar_ass(palavras, w, h, pos, size, cor="amarelo"):
    """ASS estilo TikTok: a frase (até ~3 linhas) fica PARADA no mesmo lugar e a
    palavra falada vai ACENDENDO na cor (karaokê \\k). Sem pulo, sem piscar.
    Ancorado no TOPO do bloco (Alignment 8) pra a 1ª linha ficar sempre fixa."""
    # distância do TOPO até onde a legenda começa (cresce pra baixo, 1ª linha fixa)
    margin_v = {"cima": int(h * 0.12), "meio": int(h * 0.40),
                "baixo": int(h * 0.60)}.get(pos, int(h * 0.60))
    primaria = CORES_ASS.get(cor, CORES_ASS["amarelo"])
    # PrimaryColour = palavra JÁ falada (cor) · SecondaryColour = a falar (branco)
    style = (f"Style: Def,Arial,{size},{primaria},&H00FFFFFF,&H00000000,&H64000000,"
             f"-1,0,0,0,100,100,0,0,1,4,1,8,90,90,{margin_v},1")
    head = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {w}\nPlayResY: {h}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"{style}\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    # agrupa em frases de até ~3 linhas (até 9 palavras / ~50 chars)
    grupos, atual, nchars = [], [], 0
    for p in palavras:
        atual.append(p)
        nchars += len(p["w"]) + 1
        if len(atual) >= 9 or nchars >= 50:
            grupos.append(atual); atual, nchars = [], 0
    if atual:
        grupos.append(atual)

    eventos = []
    for gi, g in enumerate(grupos):
        ini = g[0]["ini"]
        # vai até o começo do próximo grupo (sem buraco preto entre frases = sem piscar)
        if gi + 1 < len(grupos):
            fim = grupos[gi + 1][0]["ini"]
        else:
            fim = g[-1]["fim"] + 0.4
        partes = []
        for i, wd in enumerate(g):
            nxt = g[i + 1]["ini"] if i + 1 < len(g) else wd["fim"]
            dur = max(1, int(round((nxt - wd["ini"]) * 100)))  # centésimos
            partes.append(f"{{\\k{dur}}}{_esc(wd['w'])} ")
        texto = "".join(partes).strip()
        eventos.append(f"Dialogue: 0,{_cs(ini)},{_cs(fim)},Def,,0,0,0,,{texto}")
    return head + "\n".join(eventos) + "\n"


def queimar(video, ass, out):
    # roda na pasta do .ass pra evitar dor de cabeça com ':' no caminho (Windows)
    pasta = os.path.dirname(os.path.abspath(ass)) or "."
    nome_ass = os.path.basename(ass)
    r = subprocess.run(
        [FFMPEG, "-y", "-i", os.path.abspath(video),
         "-vf", f"subtitles={nome_ass}",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
         "-crf", "20", "-c:a", "copy", os.path.abspath(out)],
        cwd=pasta, capture_output=True, text=True, errors="replace")
    return r.returncode == 0 and os.path.exists(out), (r.stderr or "")[-300:]


def legendar(video, out, pos="baixo", size=56, lang="pt", cor="amarelo"):
    w, h = dimensoes(video)
    palavras = palavras_do_video(video, lang)
    if not palavras:
        log("✗ sem fala detectada."); return False
    ass = os.path.splitext(out)[0] + ".ass"
    with open(ass, "w", encoding="utf-8") as f:
        f.write(montar_ass(palavras, w, h, pos, size, cor))
    log("→ queimando legenda...")
    ok, err = queimar(video, ass, out)
    try:
        os.remove(ass)
    except OSError:
        pass
    if ok:
        log(f">>> PRONTO: {out}")
    else:
        log(f"✗ falhou queimar: {err}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--out", default="")
    ap.add_argument("--pos", default="baixo", choices=["cima", "meio", "baixo"])
    ap.add_argument("--size", type=int, default=56)
    ap.add_argument("--lang", default="pt")
    ap.add_argument("--cor", default="amarelo", choices=["amarelo", "branco", "verde"])
    args = ap.parse_args()
    out = args.out or (os.path.splitext(args.video)[0] + "_legendado.mp4")
    legendar(args.video, out, args.pos, args.size, args.lang, args.cor)


if __name__ == "__main__":
    main()
