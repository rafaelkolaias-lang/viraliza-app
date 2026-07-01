# -*- coding: utf-8 -*-
"""
FÁBRICA DE VÍDEOS - VideosIA
Varre produtos/<nome>/, gera copy com IA (Gemini), monta o vídeo (legenda ou voz),
e escreve a descrição+hashtags. Só refaz o que mudou. Roda vários em paralelo.

Uso:
  python fabrica.py            -> processa todos os produtos que mudaram
  python fabrica.py <nome>     -> processa só um produto
  python fabrica.py --tudo     -> força refazer todos
"""
import os
import re
import sys
import math
import random
import subprocess
import concurrent.futures as cf
from dotenv import load_dotenv

import gemini_copy
from narrar_video import gerar_voz_com_tempos, agrupar_em_frases
import uso

load_dotenv()


def _progresso(etapa):
    """Reporta a FASE atual do render pro site (se o worker passou o contexto via
    env). Cosmético: qualquer falha é ignorada, nunca atrapalha o render."""
    base = os.getenv("PROGRESSO_BASE", "")
    token = os.getenv("PROGRESSO_TOKEN", "")
    job_id = os.getenv("PROGRESSO_JOB_ID", "")
    if not (base and token and job_id):
        return
    try:
        import requests
        requests.post(
            f"{base}/api/worker/progresso/{job_id}",
            headers={"x-worker-token": token},
            json={"etapa": etapa}, timeout=10,
        )
    except Exception:
        pass


BASE = os.path.dirname(os.path.abspath(__file__))
_FF = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFMPEG = os.path.join(_FF, "ffmpeg.exe")
FFPROBE = os.path.join(_FF, "ffprobe.exe")
if not os.path.exists(FFMPEG):
    FFMPEG, FFPROBE = "ffmpeg", "ffprobe"

DIR_PRODUTOS = os.path.join(BASE, "produtos")
DIR_MUSICAS = os.path.join(BASE, "entrada", "musicas")  # biblioteca global
DIR_SAIDA = os.path.join(BASE, "saida")
DIR_TEMP = os.path.join(BASE, "temp")
ASSETS = os.path.join(BASE, "assets")

W, H, FPS = 1080, 1920, 24
CRF = 18
AUDIO_KBPS = "256k"
FADE = 1.0
FONTE = "Arial"
FT_LEGENDA = 76
MARGEM_TOPO = 640         # (legado) legenda na parte superior
MARGEM_CIMA = 230         # posição "cima": perto do topo (abaixo da área segura)
MARGEM_BAIXO = 300        # posição "baixo": perto do rodapé (acima da UI do app)
CONTORNO = 5


def _aln_margin(pos):
    """Converte a posição escolhida (cima/meio/baixo) em (alignment ASS, MarginV).
    Alignment: 8 = topo-centro | 5 = meio-centro | 2 = base-centro."""
    p = (pos or "baixo").strip().lower()
    if p in ("cima", "topo", "top", "alto"):
        return 8, MARGEM_CIMA
    if p in ("meio", "centro", "middle", "center", "central"):
        return 5, 0
    return 2, MARGEM_BAIXO  # baixo (padrão)
VOL_LEGENDA = 0.40        # musica quando NAO tem voz
VOL_VOZ = 0.22            # musica quando TEM voz (mais baixa)
MAX_PARALELO = 3          # quantos videos ao mesmo tempo (ffmpeg e pesado)

# Remocao de marca d'agua/logo (PADRAO): corta um pouco das bordas (onde ficam os
# logos/marcas) e o resto reescala pra preencher. Ajuste CROP_K se cortar demais/pouco.
REMOVER_MARCA = False     # corte de borda DESLIGADO (usamos remoção por IA agora)
CROP_K = 0.88             # mantem 88% central (tira ~6% de cada borda)


def _pre_crop():
    return f"crop=iw*{CROP_K}:ih*{CROP_K}," if REMOVER_MARCA else ""


# Selo de PROMOÇÃO: produto abaixo desse valor ganha um flash "imperdível" no começo
LIMITE_PROMO = 25.0
PROMO_SEGUNDOS = 3.5

# Algoritmo Shopee: taxa de conclusão é o sinal mais forte -> vídeo NUNCA passa do teto
ALVO_MAX = 30.0           # duração máxima do vídeo final (s)
LOOP_FIM = 0.6            # clipe final = 1º frame (replay emenda perfeito = retenção)


def parse_preco(s):
    if not s:
        return None
    keep = "".join(ch for ch in s if ch.isdigit() or ch in ",.")
    keep = keep.replace(".", "").replace(",", ".")
    try:
        return float(keep)
    except ValueError:
        return None


def detectar_kit(produto):
    """'Kit 5 Camisola...', 'Kit 6 Pares Meias...', '3 peças...' -> 5/6/3.
    Retorna a quantidade do kit ou None se não for kit."""
    p = (produto or "").lower()
    m = re.search(r"kit\s*(?:de\s*|c/\s*|com\s*)?(\d{1,2})", p)
    if not m:
        m = re.search(r"(\d{1,2})\s*(?:pares|pe[cç]as|unidades|unid\b|p[cç]s)", p)
    q = int(m.group(1)) if m else 0
    return q if q >= 2 else None


def fmt_brl(v):
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

EXTS_V = (".mp4", ".mov", ".mkv", ".webm")
EXTS_I = (".jpg", ".jpeg", ".png", ".webp")
EXTS_M = (".mp3", ".m4a", ".opus", ".wav", ".aac")


# ---------------------------------------------------------------- utilidades
def run(cmd):
    return subprocess.run(cmd, cwd=BASE, capture_output=True, text=True, errors="replace")


def duracao(path):
    out = run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", path])
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def parse_tempo(s):
    s = s.strip()
    if ":" in s:
        m, seg = s.split(":")[-2:]
        return int(m) * 60 + float(seg)
    try:
        return float(s)
    except ValueError:
        return 0.0


def achar_musica(match):
    arqs = [f for f in sorted(os.listdir(DIR_MUSICAS)) if f.lower().endswith(EXTS_M)]
    if not arqs:
        return None
    pref = [f for f in arqs if match and match.lower() in f.lower()]
    # usuário escolheu uma música -> usa ela; não escolheu -> ALEATÓRIA da pasta
    esc = pref[0] if pref else random.choice(arqs)
    return os.path.join(DIR_MUSICAS, esc)


def parse_musica_cfg(v):
    """'<nome> 2:14' -> (nome, 134.0) | '<nome>' -> (nome, None)"""
    v = (v or "").strip()
    if not v:
        return "", None
    partes = v.rsplit(" ", 1)
    if len(partes) == 2 and (":" in partes[1] or partes[1].replace(".", "", 1).isdigit()):
        return partes[0], parse_tempo(partes[1])
    return v, None


_cache_energia = {}

def detectar_trechos(musica, dur, n=3, skip_intro=8.0, win=0.5):
    """Acha os melhores trechos (refrão/drop) por ENERGIA. Retorna lista de inícios (s),
    do mais forte ao mais fraco, espaçados entre si. Sem precisar escolher segundos."""
    import numpy as np
    rms = _cache_energia.get(musica)
    if rms is None:
        r = subprocess.run([FFMPEG, "-v", "error", "-i", musica, "-ac", "1",
                            "-ar", "11025", "-f", "s16le", "-"],
                           cwd=BASE, capture_output=True)
        data = np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32)
        nf = data.size // int(11025 * win)
        if nf < 2:
            return [0.0]
        fr = data[:nf * int(11025 * win)].reshape(nf, int(11025 * win))
        rms = np.sqrt((fr ** 2).mean(axis=1) + 1.0)
        _cache_energia[musica] = rms
    need = max(1, int(dur / win))
    if rms.size <= need:
        return [0.0]
    csum = np.cumsum(np.insert(rms, 0, 0))
    scores = (csum[need:] - csum[:-need]).astype(np.float64)  # score[s] = energia de [s, s+need)
    smin = int(skip_intro / win)
    if smin < scores.size:
        scores[:smin] = -1
    picks = []
    sc = scores.copy()
    for _ in range(n):
        s = int(np.argmax(sc))
        if sc[s] < 0:
            break
        picks.append(round(s * win, 1))
        a = max(0, s - need); b = min(sc.size, s + need)
        sc[a:b] = -1
    return picks or [0.0]


def resolver_musica(cfg, dur_total, var_idx, n_var):
    """Retorna (caminho_musica, inicio_segundos). Usa o início do config só na
    variante 1; senão (e nas outras variantes) detecta trechos automaticamente."""
    match, expl = parse_musica_cfg(cfg.get("musica", ""))
    musica = achar_musica(match)
    if not musica:
        return None, 0.0
    if expl is not None and var_idx == 0:
        return musica, expl
    trechos = detectar_trechos(musica, dur_total, n=max(3, n_var))
    return musica, trechos[var_idx % len(trechos)]


def t(seg):
    h = int(seg // 3600); m = int((seg % 3600) // 60); s = seg % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def clip_loop_final(primeiro_video, nome, sufixo=""):
    """1º frame do 1º vídeo vira um clipe curto pro FINAL: o vídeo termina exatamente
    onde começa, o replay emenda sem corte e o algoritmo conta como retenção."""
    png = os.path.join(DIR_TEMP, f"fab_loop_{nome}{sufixo}.png")
    out = os.path.join(DIR_TEMP, f"fab_loop_{nome}{sufixo}.mp4")
    if run([FFMPEG, "-y", "-i", primeiro_video, "-frames:v", "1", png]).returncode != 0:
        return None
    # mesmo enquadramento dos vídeos no concat (pad preto, SEM blur) pra emendar igual
    filtro = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
              f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS},format=yuv420p")
    r = run([FFMPEG, "-y", "-loop", "1", "-t", f"{LOOP_FIM}", "-i", png,
             "-vf", filtro, "-c:v", "libx264", "-preset", "fast", "-crf", str(CRF),
             "-pix_fmt", "yuv420p", out])
    return out if r.returncode == 0 else None


def imagem_para_clip(img, dur, saida):
    filtro = (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"boxblur=22:2,eq=brightness=-0.08[bgb];"
        f"[fg]scale={W}:{H}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1,fps={FPS},format=yuv420p[v]"
    )
    r = run([FFMPEG, "-y", "-loop", "1", "-t", f"{dur}", "-i", img,
             "-filter_complex", filtro, "-map", "[v]", "-t", f"{dur}",
             "-c:v", "libx264", "-preset", "fast", "-crf", str(CRF),
             "-pix_fmt", "yuv420p", saida])
    return r.returncode == 0


def _cab_ass(estilos):
    return (f"[Script Info]\nScriptType: v4.00+\nPlayResX: {W}\nPlayResY: {H}\n"
            f"WrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, "
            "PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, "
            "StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding\n" + estilos +
            "\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, "
            "MarginV, Effect, Text\n")


# Estilos+eventos do preço (usados nos DOIS formatos: legenda e voz)
_ESTILOS_PRECO = (f"Style: Preco,{FONTE},100,&H0000FFFF,&H000000FF,&H00000000,"
                  f"1,0,0,0,100,100,0,0,3,10,0,8,40,40,150,1\n"
                  f"Style: Promo,{FONTE},92,&H0000FFFF,&H000000FF,&H00000000,"
                  f"1,0,0,0,100,100,0,0,3,14,0,8,40,40,210,1")

# Estilo do GANCHO (guia ganchos_shopee_videos.md): título em caixa preta com letras
# amarelas nos primeiros segundos — contraste máximo pra parar o scroll.
# Segue a MESMA posição (cima/meio/baixo) escolhida pra legenda.
def _estilo_gancho(aln, mv):
    return (f"Style: Gancho,{FONTE},80,&H0000FFFF,&H00000000,&H00000000,"
            f"1,0,0,0,100,100,0,0,3,16,0,{aln},60,60,{mv},1")


def _eventos_preco(preco, dur_total, produto=None):
    """Selo de preço SÓ nos primeiros segundos (junto com o gancho) — depois some
    pra não dar cara de anúncio o vídeo inteiro.
    KIT: preço quebrado POR UNIDADE em destaque ('SÓ R$ 13,98 CADA!') — o valor
    unitário para o dedo; o total fica menor embaixo."""
    if not preco:
        return []
    val = parse_preco(preco)
    if "r$" not in preco.lower():
        preco = f"R$ {preco}"
    qtd = detectar_kit(produto)
    if qtd and val:
        unit = val / qtd
        linha2 = f"{{\\fs52}}KIT {qtd} POR {preco}"
        if unit < LIMITE_PROMO:
            return [f"Dialogue: 2,{t(0.3)},{t(PROMO_SEGUNDOS)},Promo,,0,0,0,,"
                    f"SÓ {fmt_brl(unit)} CADA!\\N{linha2}"]
        return [f"Dialogue: 1,{t(0.3)},{t(PROMO_SEGUNDOS)},Preco,,0,0,0,,"
                f"{fmt_brl(unit)} CADA\\N{linha2}"]
    if val is not None and val < LIMITE_PROMO:
        return [f"Dialogue: 2,{t(0.3)},{t(PROMO_SEGUNDOS)},Promo,,0,0,0,,"
                f"PROMOÇÃO\\NSÓ {preco}"]
    return [f"Dialogue: 1,{t(0.3)},{t(PROMO_SEGUNDOS)},Preco,,0,0,0,,{preco}"]


def ass_legenda(captions, dur_total, caminho, preco=None, produto=None, pos="baixo"):
    aln, mv = _aln_margin(pos)
    estilos = (f"Style: Venda,{FONTE},{FT_LEGENDA},&H00FFFFFF,&H00000000,&H64000000,"
               f"1,0,0,0,100,100,0,0,1,{CONTORNO},2,{aln},70,70,{mv},1\n"
               + _estilo_gancho(aln, mv) + "\n" + _ESTILOS_PRECO)
    seg = dur_total / max(1, len(captions))
    ev = []
    for i, txt in enumerate(captions):
        estilo = "Gancho" if i == 0 else "Venda"  # 1ª legenda = gancho em destaque
        ev.append(f"Dialogue: 0,{t(i*seg+0.2)},{t((i+1)*seg-0.1)},{estilo},,0,0,0,,{txt}")
    ev += _eventos_preco(preco, dur_total, produto)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(_cab_ass(estilos) + "\n".join(ev) + "\n")


def ass_voz(frases, caminho, preco=None, dur_total=None, produto=None, pos="baixo"):
    aln, mv = _aln_margin(pos)
    estilos = (f"Style: Fala,{FONTE},76,&H00FFFFFF,&H00000000,&H64000000,"
               f"1,0,0,0,100,100,0,0,1,5,2,{aln},70,70,{mv},1\n"
               + _estilo_gancho(aln, mv) + "\n" + _ESTILOS_PRECO)
    # 1ª frase (o gancho) ganha o destaque caixa-preta/amarelo do guia
    ev = [f"Dialogue: 0,{t(i)},{t(f)},{'Gancho' if k == 0 else 'Fala'},,0,0,0,,{txt}"
          for k, (txt, i, f) in enumerate(frases)]
    ev += _eventos_preco(preco, dur_total or (frases[-1][2] if frases else 10), produto)
    with open(caminho, "w", encoding="utf-8") as fp:
        fp.write(_cab_ass(estilos) + "\n".join(ev) + "\n")


# ---------------------------------------------------------------- config
def ler_config(prod_dir):
    cfg = {}
    p = os.path.join(prod_dir, "config.txt")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for linha in f:
                linha = linha.strip()
                if not linha or linha.startswith("#") or ":" not in linha:
                    continue
                k, v = linha.split(":", 1)
                cfg[k.strip().lower()] = v.strip()
    return cfg


def ler_descricao(prod_dir):
    p = os.path.join(prod_dir, "descricao.txt")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return f.read()
    return ""


def listar(prod_dir, sub, exts):
    d = os.path.join(prod_dir, sub)
    if not os.path.isdir(d):
        return []
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(exts))


def precisa_refazer(prod_dir, nome, forcar):
    saida = os.path.join(DIR_SAIDA, nome + ".mp4")
    if forcar or not os.path.exists(saida):
        return True
    t_out = os.path.getmtime(saida)
    for raiz, _, files in os.walk(prod_dir):
        for f in files:
            if os.path.getmtime(os.path.join(raiz, f)) > t_out:
                return True
    return False


# ---------------------------------------------------------------- builders
def build_legenda(prod_dir, nome, cfg, copy, sufixo="", var_idx=0, n_var=1, imagens=None,
                  plano=None):
    videos = listar(prod_dir, "videos", EXTS_V)
    if imagens is None:
        imagens = listar(prod_dir, "imagens", EXTS_I)
    clip_dur = float(cfg["clip_dur"]) if cfg.get("clip_dur") else None
    preco = cfg.get("preco") or None

    # fotos -> clipes (duração decidida pelo cérebro editor, se houver plano)
    dur_img = float((plano or {}).get("dur_imagem", 3.0))
    dur_img = min(4.0, max(1.5, dur_img))
    img_clipes = []
    for j, img in enumerate(imagens):
        out = os.path.join(DIR_TEMP, f"fab_{nome}_{j}.mp4")
        if imagem_para_clip(img, dur_img, out):
            img_clipes.append(out)

    reais_t = [(v, clip_dur) for v in videos]
    imgs_t = [(ic, None) for ic in img_clipes]

    def _d(it):
        d = duracao(it[0]); return min(d, it[1]) if it[1] else d

    # TRAVA 15-30s (taxa de conclusão é o sinal mais forte do algoritmo):
    # derruba fotos do fim e, se os vídeos brutos ainda estourarem, limita cada um
    while len(imgs_t) > 1 and sum(_d(x) for x in reais_t + imgs_t) > ALVO_MAX:
        imgs_t.pop()
    sobra = ALVO_MAX - sum(_d(x) for x in imgs_t)
    if reais_t and sum(_d(x) for x in reais_t) > sobra:
        lim_v = max(3.0, sobra / len(reais_t))
        reais_t = [(v, min(_d((v, l)), lim_v)) for v, l in reais_t]

    ordem = cfg.get("ordem") or (plano or {}).get("ordem") or "sequencial"
    if ordem == "intercalado":
        seq = []
        a, b = list(reais_t), list(imgs_t)
        while a or b:
            if a: seq.append(a.pop(0))
            if b: seq.append(b.pop(0))
    else:
        seq = reais_t + imgs_t

    # final que LOOPA: termina no 1º frame -> replay emenda perfeito
    lc = clip_loop_final(seq[0][0], nome, sufixo) if seq else None
    if lc:
        seq.append((lc, None))
    dur_total = sum(_d(it) for it in seq)

    musica, mus_start = resolver_musica(cfg, dur_total, var_idx, n_var)
    if not musica:
        return False, "sem musica em entrada/musicas"

    ass = os.path.join("temp", f"fab_{nome}{sufixo}.ass")
    ass_legenda(copy.get("captions", []), dur_total, os.path.join(BASE, ass), preco,
                produto=cfg.get("produto", nome), pos=cfg.get("legenda_pos", "baixo"))

    n = len(seq)
    fim = max(0.0, dur_total - FADE)
    concat = "".join(f"[{i}:v]{_pre_crop()}scale={W}:{H}:force_original_aspect_ratio=decrease,"
                     f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[v{i}];"
                     for i in range(n))
    refs = "".join(f"[v{i}]" for i in range(n))
    filtro = (concat + f"{refs}concat=n={n}:v=1:a=0[vc];"
              f"[vc]subtitles={ass.replace(os.sep,'/')}[vout];"
              f"[{n}:a]atrim={mus_start}:{mus_start+dur_total},asetpts=N/SR/TB,"
              f"volume={VOL_LEGENDA},afade=t=in:st=0:d={FADE},"
              f"afade=t=out:st={fim}:d={FADE}[aout]")

    saida = os.path.join(DIR_SAIDA, nome + sufixo + ".mp4")
    cmd = [FFMPEG, "-y"]
    for p, lim in seq:
        if lim: cmd += ["-t", f"{lim}", "-i", p]
        else: cmd += ["-i", p]
    # -stream_loop -1 na música garante que ela cobre o vídeo inteiro (nunca acaba antes)
    cmd += ["-stream_loop", "-1", "-i", musica,
            "-filter_complex", filtro, "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF), "-profile:v", "high",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", AUDIO_KBPS,
            "-r", str(FPS), "-movflags", "+faststart", saida]
    r = run(cmd)
    return r.returncode == 0, (r.stderr[-600:] if r.returncode else "")


def _build_voz_so_imagens(nome, cfg, frases, voz_mp3, narr_dur, imagens,
                          sufixo, var_idx, n_var, plano):
    """Narração SEM vídeo: vira um slideshow das imagens que cobre a fala, com a voz
    por cima e a música abaixando (ducking) — igual ao caminho com vídeo."""
    dur_img = float((plano or {}).get("dur_imagem", 3.0))
    dur_img = min(4.0, max(1.8, dur_img))

    base = []
    for j, img in enumerate(imagens):
        out = os.path.join(DIR_TEMP, f"fab_{nome}{sufixo}_img{j}.mp4")
        if imagem_para_clip(img, dur_img, out):
            base.append(out)
    if not base:
        return False, "não consegui montar clipe das imagens"

    # repete as imagens (em sequência) até cobrir a narração
    seq, t, guard = [], 0.0, 0
    while t < narr_dur - 0.05 and guard < 400:
        c = base[len(seq) % len(base)]
        seq.append(c); t += duracao(c); guard += 1
    if not seq:                       # narração curtíssima -> ao menos 1 imagem
        seq = [base[0]]; t = duracao(base[0])
    total = max(t, narr_dur)

    ass = os.path.join("temp", f"fab_{nome}{sufixo}.ass")
    ass_voz(frases, os.path.join(BASE, ass), preco=cfg.get("preco") or None,
            dur_total=total, produto=cfg.get("produto", nome),
            pos=cfg.get("legenda_pos", "baixo"))

    musica, mus_start = resolver_musica(cfg, total, var_idx, n_var)
    if not musica:
        return False, "sem musica em entrada/musicas"

    n_v = len(seq)
    parts = "".join(
        f"[{i}:v]{_pre_crop()}scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[v{i}];"
        for i in range(n_v))
    refs = "".join(f"[v{i}]" for i in range(n_v))
    idx_mus, idx_voz = n_v, n_v + 1
    fim = max(0.0, total - FADE)
    filtro = (parts + f"{refs}concat=n={n_v}:v=1:a=0[vc];"
              f"[vc]subtitles={ass.replace(os.sep,'/')}[vout];"
              f"[{idx_mus}:a]atrim={mus_start}:{mus_start+total},asetpts=N/SR/TB,"
              f"volume={VOL_VOZ}[mus];"
              f"[{idx_voz}:a]apad=whole_dur={total:.2f}[vp];[vp]asplit=2[vf][vk];"
              f"[mus][vk]sidechaincompress=threshold=0.02:ratio=12:attack=5:release=300[md];"
              f"[md][vf]amix=inputs=2:duration=first:normalize=0,"
              f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim}:d={FADE}[aout]")

    saida = os.path.join(DIR_SAIDA, nome + sufixo + ".mp4")
    cmd = [FFMPEG, "-y"]
    for ic in seq:
        cmd += ["-i", ic]
    cmd += ["-stream_loop", "-1", "-i", musica, "-i", voz_mp3,
            "-filter_complex", filtro, "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF), "-profile:v", "high",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", AUDIO_KBPS,
            "-r", str(FPS), "-t", f"{total:.2f}", "-movflags", "+faststart", saida]
    r = run(cmd)
    return r.returncode == 0, (r.stderr[-600:] if r.returncode else "")


def build_voz(prod_dir, nome, cfg, copy, sufixo="", var_idx=0, n_var=1, imagens=None,
              plano=None):
    videos = listar(prod_dir, "videos", EXTS_V)
    if imagens is None:
        imagens = listar(prod_dir, "imagens", EXTS_I)
    if not videos and not imagens:
        return False, "sem vídeo nem imagem do produto"
    roteiro = copy.get("roteiro", "")

    voz_mp3 = os.path.join(DIR_TEMP, f"fab_voz_{nome}{sufixo}.mp3")
    # voz escolhida no Estúdio (config.txt); vazio = voz padrão do narrar_video
    voz_id = (cfg.get("voz_id") or "").strip() or None
    # BYO: chave do usuário (vem por env do worker); None = usa a plataforma e cobra
    user_key = (os.getenv("ELEVEN_USER_KEY") or "").strip() or None
    dur_voz, palavras = gerar_voz_com_tempos(
        roteiro, voz_mp3, voice_id=voz_id, api_key=user_key)
    frases = agrupar_em_frases(palavras)
    narr_dur = dur_voz + 0.8          # duração da narração

    # SÓ IMAGENS (sem vídeo): monta um slideshow que cobre a narração e põe a voz por
    # cima (mesma mixagem da narração normal). Antes isso dava "sem videos".
    if not videos:
        ok, msg = _build_voz_so_imagens(
            nome, cfg, frases, voz_mp3, narr_dur, imagens, sufixo, var_idx, n_var, plano)
        return ok, msg

    video = videos[0]
    dur_v = duracao(video)

    # fotos -> clipes
    dur_img = float((plano or {}).get("dur_imagem", 3.0))
    dur_img = min(4.0, max(1.5, dur_img))
    img_clipes = []
    for j, img in enumerate(imagens):
        out = os.path.join(DIR_TEMP, f"fab_{nome}_{j}.mp4")
        if imagem_para_clip(img, dur_img, out):
            img_clipes.append(out)
    dur_imgs = sum(duracao(ic) for ic in img_clipes)

    # TRAVA 15-30s: narração + fotos nunca passam do teto (derruba fotos do fim)
    while img_clipes and max(dur_v, narr_dur - dur_imgs) + dur_imgs > ALVO_MAX:
        img_clipes.pop()
        dur_imgs = sum(duracao(ic) for ic in img_clipes)

    # o vídeo toca UMA vez e as fotos já entram DURANTE a narração (nada de loop
    # chato). Só estica/loopa o vídeo se mesmo com as fotos não cobrir a narração.
    vid_dur = max(dur_v, narr_dur - dur_imgs)
    loops = math.ceil(vid_dur / dur_v) - 1 if dur_v < vid_dur else 0
    total = max(vid_dur + dur_imgs, narr_dur)

    # final que LOOPA: termina no 1º frame -> replay emenda perfeito
    lc = clip_loop_final(video, nome, sufixo)
    if lc:
        img_clipes.append(lc)
        total += duracao(lc)

    ass = os.path.join("temp", f"fab_{nome}{sufixo}.ass")
    ass_voz(frases, os.path.join(BASE, ass), preco=cfg.get("preco") or None,
            dur_total=total, produto=cfg.get("produto", nome),
            pos=cfg.get("legenda_pos", "baixo"))

    musica, mus_start = resolver_musica(cfg, total, var_idx, n_var)
    if not musica:
        return False, "sem musica em entrada/musicas"

    n_v = 1 + len(img_clipes)
    parts = "".join(
        f"[{i}:v]{_pre_crop()}scale={W}:{H}:force_original_aspect_ratio=decrease,"
        f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[v{i}];"
        for i in range(n_v))
    refs = "".join(f"[v{i}]" for i in range(n_v))
    idx_mus, idx_voz = n_v, n_v + 1
    fim = max(0.0, total - FADE)
    # apad na voz: sem isso o sidechaincompress termina junto com a voz e a música
    # morre na hora que entram as fotos — a voz vira silêncio até o fim do vídeo
    filtro = (parts + f"{refs}concat=n={n_v}:v=1:a=0[vc];"
              f"[vc]subtitles={ass.replace(os.sep,'/')}[vout];"
              f"[{idx_mus}:a]atrim={mus_start}:{mus_start+total},asetpts=N/SR/TB,"
              f"volume={VOL_VOZ}[mus];"
              f"[{idx_voz}:a]apad=whole_dur={total:.2f}[vp];[vp]asplit=2[vf][vk];"
              f"[mus][vk]sidechaincompress=threshold=0.02:ratio=12:attack=5:release=300[md];"
              f"[md][vf]amix=inputs=2:duration=first:normalize=0,"
              f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim}:d={FADE}[aout]")

    saida = os.path.join(DIR_SAIDA, nome + sufixo + ".mp4")
    cmd = [FFMPEG, "-y"]
    if loops > 0: cmd += ["-stream_loop", str(loops)]
    cmd += ["-t", f"{vid_dur:.2f}", "-i", video]   # video toca 1x (loop só se faltar)
    for ic in img_clipes:
        cmd += ["-i", ic]
    cmd += ["-stream_loop", "-1", "-i", musica, "-i", voz_mp3,
            "-filter_complex", filtro, "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF), "-profile:v", "high",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", AUDIO_KBPS,
            "-r", str(FPS), "-t", f"{total:.2f}", "-movflags", "+faststart", saida]
    r = run(cmd)
    return r.returncode == 0, (r.stderr[-600:] if r.returncode else "")


def escrever_txt(nome, copy, produto):
    desc = (copy.get("descricao", "") or "").replace("**", "").replace("*", "")
    linhas = [f"=== POSTAGEM: {produto} ===", f"Arquivo: {nome}.mp4", "",
              "--- DESCRIÇÃO ---", desc, "",
              "--- HASHTAGS ---", " ".join(copy.get("hashtags", []))]
    with open(os.path.join(DIR_SAIDA, nome + ".txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")


def limpar_imagens(prod_dir, imagens):
    """IA remove marca d'água/logo de cada imagem (com cache em imagens_limpas/).
    Retorna a lista de caminhos limpos (ou original se falhar)."""
    import gemini_copy
    out_dir = os.path.join(prod_dir, "imagens_limpas")
    os.makedirs(out_dir, exist_ok=True)
    limpas = []
    for img in imagens:
        dest = os.path.join(out_dir, os.path.splitext(os.path.basename(img))[0] + ".png")
        if os.path.exists(dest):
            limpas.append(dest); continue
        with open(img, "rb") as f:
            b = f.read()
        mime = "image/png" if img.lower().endswith(".png") else "image/jpeg"
        out = gemini_copy.remover_marca_dagua(b, mime)
        if out:
            with open(dest, "wb") as f:
                f.write(out)
            limpas.append(dest)
        else:
            limpas.append(img)  # falhou -> usa original
    return limpas


def gerar_imagem_variante(prod_dir, img, produto, var_idx):
    """Anti-duplicado: gera uma foto NOVA do mesmo produto (outra modelo/cenário) pra
    variante var_idx, com cache. Retorna caminho ou None se falhar."""
    import gemini_copy
    cache = os.path.join(prod_dir, "imagens_limpas", f"_var{var_idx+1}.png")
    if os.path.exists(cache):
        return cache
    with open(img, "rb") as f:
        b = f.read()
    mime = "image/png" if img.lower().endswith(".png") else "image/jpeg"
    out = gemini_copy.variar_imagem(b, produto, var_idx, mime)
    if out:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        with open(cache, "wb") as f:
            f.write(out)
        return cache
    return None


def _preparar_input_veo(prod_dir, hero, produto):
    """Garante que o input do Veo tenha uma MODELO HUMANA. Se a imagem for só o produto
    (sem pessoa), cria uma modelo vestindo a peça. Com cache. Retorna caminho da imagem."""
    import gemini_copy
    cache = os.path.join(prod_dir, "imagens_limpas", "_veo_input.png")
    if os.path.exists(cache):
        return cache
    with open(hero, "rb") as f:
        b = f.read()
    mime = "image/png" if hero.lower().endswith(".png") else "image/jpeg"
    if gemini_copy.tem_pessoa(b, mime):
        return hero  # já tem modelo humana -> anima direto
    onmodel = gemini_copy.vestir_modelo(b, produto, mime)
    if onmodel:
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        with open(cache, "wb") as f:
            f.write(onmodel)
        return cache
    return hero  # se falhar, usa o original


def gerar_cena_veo(prod_dir, nome, cfg, descricao, produto, hero=None):
    """Se 'gerar_cena: sim', anima a 1a imagem com o Veo (1x, com cache).
    Garante modelo humana. O clipe vai pra videos/ e entra no pipeline. Retorna status."""
    import gemini_copy
    import veo_gen
    if hero is None:
        imagens = listar(prod_dir, "imagens", EXTS_I)
        if not imagens:
            return "gerar_cena ligado mas sem imagens"
        hero = imagens[0]
    cache = os.path.join(prod_dir, "videos", "veo_cena.mp4")
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    if os.path.exists(cache):
        return "cena Veo (cache, sem custo)"
    hero = _preparar_input_veo(prod_dir, hero, produto)  # garante modelo humana
    with open(hero, "rb") as f:
        img_bytes = f.read()
    mime = "image/png" if hero.lower().endswith(".png") else "image/jpeg"
    p = gemini_copy.prompt_cena_veo(produto, descricao, img_bytes, mime)
    ok, info = veo_gen.gerar_clipe(hero, p.get("prompt", ""), cache,
                                   negative=p.get("negative", ""))
    if not ok:
        raise RuntimeError(f"Veo falhou: {info}")
    return "cena Veo gerada (NOVA - custou)"


# ---------------------------------------------------------------- orquestra
def processar(prod_dir, forcar):
    nome = os.path.basename(prod_dir.rstrip(os.sep))
    try:
        if not precisa_refazer(prod_dir, nome, forcar):
            return (nome, "pulado (sem mudanças)")
        cfg = ler_config(prod_dir)
        produto = cfg.get("produto", nome)
        formato = cfg.get("formato", "legenda").lower()
        descricao = ler_descricao(prod_dir)

        # 1) IA tira marca d'água das imagens (PADRÃO, com cache)
        imgs_all = listar(prod_dir, "imagens", EXTS_I)
        if imgs_all and cfg.get("limpar_marca", "sim").lower() not in ("nao", "não", "no", "false", "0"):
            _progresso("Preparando as imagens")
            imgs_all = limpar_imagens(prod_dir, imgs_all)

        # 2) gera a cena com Veo a partir da imagem JÁ LIMPA (se pedido)
        if cfg.get("gerar_cena", "").lower() in ("sim", "yes", "true", "1"):
            hero = imgs_all[0] if imgs_all else None
            gerar_cena_veo(prod_dir, nome, cfg, descricao, produto, hero)

        tom = cfg.get("tom", "equilibrado").lower()
        try:
            n_var = max(1, min(5, int(float(cfg.get("variantes", "1") or 1))))
        except ValueError:
            n_var = 1

        # 3) CÉREBRO EDITOR: IA olha tudo e monta o plano de edição (quais imagens,
        #    ordem, duração de cada cena) + descreve as cenas pra copy casar com elas
        _progresso("Analisando o conteúdo")
        n_videos = len(listar(prod_dir, "videos", EXTS_V))
        plano = gemini_copy.plano_edicao(produto, descricao, imgs_all,
                                         n_videos=n_videos, max_fotos=6)
        idx = plano.get("indices") or list(range(len(imgs_all)))
        imagens = [imgs_all[i] for i in idx if 0 <= i < len(imgs_all)]
        contexto = plano.get("cenas", "")

        for i in range(n_var):
            _progresso(
                f"Renderizando {i + 1}/{n_var}" if n_var > 1 else "Renderizando o vídeo")
            # copy nova a cada variante -> legendas/roteiro diferentes
            copy = gemini_copy.gerar_copy(produto, descricao, formato=formato, tom=tom,
                                          contexto_visual=contexto,
                                          preco=cfg.get("preco", ""))
            sufixo = "" if n_var == 1 else f"-v{i+1}"
            # anti-duplicado: ordem das fotos rotaciona por variante E a partir da v2
            # a IA gera uma foto NOVA do produto (outra modelo/cenário, com cache)
            rot = i % len(imagens) if imagens else 0
            imgs_v = imagens[rot:] + imagens[:rot]
            if i > 0 and imgs_v:
                nova = gerar_imagem_variante(prod_dir, imgs_v[0], produto, i)
                if nova:
                    imgs_v[0] = nova
            if formato == "voz":
                ok, err = build_voz(prod_dir, nome, cfg, copy, sufixo, i, n_var,
                                    imgs_v, plano)
            else:
                ok, err = build_legenda(prod_dir, nome, cfg, copy, sufixo, i, n_var,
                                        imgs_v, plano)
            if not ok:
                return (nome, f"ERRO vídeo v{i+1}: {err}")
            escrever_txt(nome + sufixo, copy, produto)
        return (nome, f"OK ({n_var} variante(s))")
    except Exception as e:
        return (nome, f"ERRO: {str(e)[:200]}")


def main():
    os.makedirs(DIR_PRODUTOS, exist_ok=True)
    os.makedirs(DIR_SAIDA, exist_ok=True)
    os.makedirs(DIR_TEMP, exist_ok=True)

    args = [a for a in sys.argv[1:]]
    forcar = "--tudo" in args
    alvo = next((a for a in args if not a.startswith("--")), None)

    todos = [os.path.join(DIR_PRODUTOS, d) for d in sorted(os.listdir(DIR_PRODUTOS))
             if os.path.isdir(os.path.join(DIR_PRODUTOS, d))] if os.path.isdir(DIR_PRODUTOS) else []
    if alvo:
        todos = [p for p in todos if os.path.basename(p) == alvo]
    if not todos:
        print("Nenhum produto em produtos/"); return

    print(f"Produtos: {len(todos)} | paralelo: {MAX_PARALELO}\n")
    with cf.ThreadPoolExecutor(max_workers=MAX_PARALELO) as ex:
        futs = {ex.submit(processar, p, forcar): p for p in todos}
        for fut in cf.as_completed(futs):
            nome, status = fut.result()
            print(f"  [{nome}] {status}")

    # grava o consumo de APIs (tokens Gemini + caracteres ElevenLabs) pro worker
    # mandar pra web debitar pelo custo real.
    if alvo:
        uso.dump(os.path.join(DIR_PRODUTOS, alvo, "consumo.json"))
    print("\nFábrica concluída.")


if __name__ == "__main__":
    main()
