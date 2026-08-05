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
import json
import math
import random
import subprocess
import concurrent.futures as cf
from dotenv import load_dotenv

import gemini_copy
import uso  # acumulador de consumo de APIs (grava consumo.json pro worker)
import venc
from narrar_video import gerar_voz_com_tempos, agrupar_em_frases

load_dotenv()

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
VOL_MANTER_MUS = 0.10     # musica BEM baixa quando o usuario mantem o audio original
VOL_ORIG = 1.0            # audio original do video (quando "manter")
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


_cache_tem_audio = {}


def _tem_audio(path):
    """True se o arquivo tem faixa de áudio (pra saber se dá pra manter o som
    original). Guardado em cache: com corte de silêncio o mesmo arquivo é
    consultado uma vez por pedaço, e cada consulta é um ffprobe."""
    if path not in _cache_tem_audio:
        out = run([FFPROBE, "-v", "error", "-select_streams", "a", "-show_entries",
                   "stream=index", "-of", "csv=p=0", path])
        _cache_tem_audio[path] = bool((out.stdout or "").strip())
    return _cache_tem_audio[path]


def _quer_manter_audio(cfg):
    """Config 'audio_original: manter' -> mantém o som do vídeo de entrada. Qualquer
    outra coisa (ou ausência) = comportamento antigo (só música/narração)."""
    return (cfg.get("audio_original") or "").strip().lower() == "manter"


def _vol(cfg, chave, padrao):
    """Volume escolhido na tela do editor (0-100) convertido pra 0.0-1.0.

    Antes esses valores eram constantes fixas aqui e o controle de volume da tela
    não fazia nada (`auditoria.md` #23). Sem a config (job antigo ou fábrica
    avulsa) continua valendo o padrão de sempre, que vem por parâmetro."""
    bruto = cfg.get(chave)
    if bruto is None or str(bruto).strip() == "":
        return padrao
    try:
        n = float(str(bruto).strip())
    except ValueError:
        return padrao
    return max(0.0, min(1.0, n / 100.0))


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
    """Acha a trilha do vídeo.

    Com `match` (a música que a pessoa subiu, salva como `job_<id>`) procura pelo
    nome e aceita também CONTÊINER DE VÍDEO: a plataforma usa só o som dele, que
    é o caso comum de quem tem o áudio dentro de um mp4.

    Sem `match`, sorteia uma da biblioteca da casa. Aí entram só os áudios, e
    nunca um arquivo `job_*`: aquilo é upload de um usuário e não pode virar
    trilha automática do vídeo de outro."""
    try:
        arqs = sorted(os.listdir(DIR_MUSICAS))
    except OSError:
        return None
    if match:
        alvo = match.lower()
        pref = [f for f in arqs
                if alvo in f.lower() and f.lower().endswith(EXTS_M + EXTS_V)]
        if pref:
            return os.path.join(DIR_MUSICAS, pref[0])
    biblioteca = [f for f in arqs
                  if f.lower().endswith(EXTS_M) and not f.lower().startswith("job_")]
    if not biblioteca:
        return None
    return os.path.join(DIR_MUSICAS, random.choice(biblioteca))


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
    base = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}")
    for modo in venc.modos(FFMPEG):
        vf = base + (",format=nv12,hwupload" if modo == "gpu" else ",format=yuv420p")
        r = run([FFMPEG, "-y", *venc.dev_args(modo), "-loop", "1", "-t", f"{LOOP_FIM}",
                 "-i", png, "-vf", vf, *venc.codec_v(modo, crf=CRF, preset="fast"), out])
        if r.returncode == 0:
            return out
        if modo == "gpu":
            venc.desligar_gpu()
    return None


def concat_videos(videos, nome, sufixo=""):
    """Junta TODOS os vídeos enviados num clipe só, na ordem, pra a narração poder
    correr por cima do conjunto inteiro.

    Antes o formato "Voz narrada" usava só `videos[0]` e descartava o resto sem
    avisar ninguém (`auditoria.md` #24). Vídeo sem faixa de áudio entra com
    silêncio do tamanho dele, senão o concat com áudio recusa a mistura.
    Retorna o caminho do clipe único (ou o 1º vídeo, se o ffmpeg falhar)."""
    if not videos:
        return None
    if len(videos) == 1:
        return videos[0]
    saida = os.path.join(DIR_TEMP, f"fab_base_{nome}{sufixo}.mp4")
    k = len(videos)
    durs = [duracao(v) for v in videos]
    tem = [_tem_audio(v) for v in videos]
    partes = ""
    for i in range(k):
        partes += (f"[{i}:v]{_pre_crop()}scale={W}:{H}:force_original_aspect_ratio=decrease,"
                   f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}[v{i}];")
        if tem[i]:
            partes += f"[{i}:a]aresample=44100,asetpts=N/SR/TB[a{i}];"
        else:
            partes += (f"anullsrc=r=44100:cl=stereo,atrim=0:{max(0.1, durs[i]):.2f},"
                       f"asetpts=N/SR/TB[a{i}];")
    refs = "".join(f"[v{i}][a{i}]" for i in range(k))
    ins = []
    for v in videos:
        ins += ["-i", v]
    for modo in venc.modos(FFMPEG):
        filtro = (partes + f"{refs}concat=n={k}:v=1:a=1[vcc][aout];[vcc]setsar=1"
                  + venc.fim_v(modo))
        r = run([FFMPEG, "-y", *venc.dev_args(modo), *ins, "-filter_complex", filtro,
                 "-map", "[vout]", "-map", "[aout]",
                 *venc.codec_v(modo, crf=CRF, preset="fast"),
                 "-c:a", "aac", "-b:a", AUDIO_KBPS, "-r", str(FPS), saida])
        if r.returncode == 0:
            return saida
        if modo == "gpu":
            venc.desligar_gpu()
    return videos[0]  # juntar falhou: melhor um vídeo só do que o render inteiro morrer


def imagem_para_clip(img, dur, saida):
    base = (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        f"boxblur=22:2,eq=brightness=-0.08[bgb];"
        f"[fg]scale={W}:{H}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1,fps={FPS}"
    )
    for modo in venc.modos(FFMPEG):
        filtro = base + venc.fim_v(modo, "v")
        r = run([FFMPEG, "-y", *venc.dev_args(modo), "-loop", "1", "-t", f"{dur}", "-i", img,
                 "-filter_complex", filtro, "-map", "[v]", "-t", f"{dur}",
                 *venc.codec_v(modo, crf=CRF, preset="fast"), saida])
        if r.returncode == 0:
            return True
        if modo == "gpu":
            venc.desligar_gpu()
    return False


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

    # "manter": preserva o som original de cada clipe (silêncio nas fotos) e deixa a
    # música BEM baixa por baixo; "remover"/ausente: só música (comportamento antigo).
    durs = [_d(it) for it in seq]
    manter = _quer_manter_audio(cfg)
    tem_aud = [_tem_audio(p) for p, _ in seq] if manter else []
    # volumes da tela (o padrão de cada caso continua o de sempre quando não vêm)
    v_orig = _vol(cfg, "vol_original", VOL_ORIG)

    def _audio():
        if not manter or not any(tem_aud):
            return (f"[{n}:a]atrim={mus_start}:{mus_start+dur_total},asetpts=N/SR/TB,"
                    f"volume={_vol(cfg, 'vol_musica', VOL_LEGENDA)},afade=t=in:st=0:d={FADE},"
                    f"afade=t=out:st={fim}:d={FADE}[aout]")
        partes = ""
        for i in range(n):
            if tem_aud[i]:
                partes += (f"[{i}:a]aresample=44100,apad=whole_dur={durs[i]:.2f},"
                           f"atrim=0:{durs[i]:.2f},asetpts=N/SR/TB[a{i}];")
            else:  # foto/loop: sem áudio -> silêncio do tamanho do clipe
                partes += (f"anullsrc=r=44100:cl=stereo,atrim=0:{durs[i]:.2f},"
                           f"asetpts=N/SR/TB[a{i}];")
        arefs = "".join(f"[a{i}]" for i in range(n))
        return (partes + f"{arefs}concat=n={n}:v=0:a=1,volume={v_orig}[orig];"
                f"[{n}:a]atrim={mus_start}:{mus_start+dur_total},asetpts=N/SR/TB,"
                f"volume={_vol(cfg, 'vol_musica', VOL_MANTER_MUS)}[mus];"
                f"[orig][mus]amix=inputs=2:duration=first:normalize=0,"
                f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim}:d={FADE}[aout]")

    def _filtro(modo):
        return (concat + f"{refs}concat=n={n}:v=1:a=0[vc];"
                f"[vc]subtitles={ass.replace(os.sep,'/')}" + venc.fim_v(modo) + ";"
                + _audio())

    saida = os.path.join(DIR_SAIDA, nome + sufixo + ".mp4")
    ins = []
    for p, lim in seq:
        if lim: ins += ["-t", f"{lim}", "-i", p]
        else: ins += ["-i", p]
    # -stream_loop -1 na música garante que ela cobre o vídeo inteiro (nunca acaba antes)
    ins += ["-stream_loop", "-1", "-i", musica]

    r = None
    for modo in venc.modos(FFMPEG):
        cmd = [FFMPEG, "-y", *venc.dev_args(modo), *ins,
               "-filter_complex", _filtro(modo), "-map", "[vout]", "-map", "[aout]",
               *venc.codec_v(modo, crf=CRF), "-c:a", "aac", "-b:a", AUDIO_KBPS,
               "-r", str(FPS), "-movflags", "+faststart", saida]
        r = run(cmd)
        if r.returncode == 0:
            return True, ""
        if modo == "gpu":
            venc.desligar_gpu()
    return False, (r.stderr[-600:] if r else "")


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

    def _filtro(modo):
        return (parts + f"{refs}concat=n={n_v}:v=1:a=0[vc];"
                f"[vc]subtitles={ass.replace(os.sep,'/')}" + venc.fim_v(modo) + ";"
                f"[{idx_mus}:a]atrim={mus_start}:{mus_start+total},asetpts=N/SR/TB,"
                f"volume={_vol(cfg, 'vol_musica', VOL_VOZ)}[mus];"
                f"[{idx_voz}:a]apad=whole_dur={total:.2f}[vp];[vp]asplit=2[vf0][vk];"
                f"[vf0]volume={_vol(cfg, 'vol_voz', 1.0)}[vf];"
                f"[mus][vk]sidechaincompress=threshold=0.02:ratio=12:attack=5:release=300[md];"
                f"[md][vf]amix=inputs=2:duration=first:normalize=0,"
                f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim}:d={FADE}[aout]")

    saida = os.path.join(DIR_SAIDA, nome + sufixo + ".mp4")
    ins = []
    for ic in seq:
        ins += ["-i", ic]
    ins += ["-stream_loop", "-1", "-i", musica, "-i", voz_mp3]

    r = None
    for modo in venc.modos(FFMPEG):
        cmd = [FFMPEG, "-y", *venc.dev_args(modo), *ins,
               "-filter_complex", _filtro(modo), "-map", "[vout]", "-map", "[aout]",
               *venc.codec_v(modo, crf=CRF), "-c:a", "aac", "-b:a", AUDIO_KBPS,
               "-r", str(FPS), "-t", f"{total:.2f}", "-movflags", "+faststart", saida]
        r = run(cmd)
        if r.returncode == 0:
            return True, ""
        if modo == "gpu":
            venc.desligar_gpu()
    return False, (r.stderr[-600:] if r else "")


def build_voz(prod_dir, nome, cfg, copy, sufixo="", var_idx=0, n_var=1, imagens=None,
              plano=None):
    videos = listar(prod_dir, "videos", EXTS_V)
    if imagens is None:
        imagens = listar(prod_dir, "imagens", EXTS_I)
    if not videos and not imagens:
        return False, "sem vídeo nem imagem do produto"
    roteiro = copy.get("roteiro", "")

    voz_mp3 = os.path.join(DIR_TEMP, f"fab_voz_{nome}{sufixo}.mp3")
    dur_voz, palavras = gerar_voz_com_tempos(roteiro, voz_mp3)
    frases = agrupar_em_frases(palavras)
    narr_dur = dur_voz + 0.8          # duração da narração

    # SÓ IMAGENS (sem vídeo): monta um slideshow que cobre a narração e põe a voz por
    # cima (mesma mixagem da narração normal). Antes isso dava "sem videos".
    if not videos:
        ok, msg = _build_voz_so_imagens(
            nome, cfg, frases, voz_mp3, narr_dur, imagens, sufixo, var_idx, n_var, plano)
        return ok, msg

    # TODOS os vídeos entram (na ordem), não só o primeiro (`auditoria.md` #24)
    video = concat_videos(videos, nome, sufixo)
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
    # "manter": o som original do vídeo (input 0) entra por baixo da narração, um pouco
    # mais baixo pra não brigar com a voz nova. Só se o vídeo realmente tiver áudio.
    manter = _quer_manter_audio(cfg) and _tem_audio(video)
    # apad na voz: sem isso o sidechaincompress termina junto com a voz e a música
    # morre na hora que entram as fotos — a voz vira silêncio até o fim do vídeo
    # o volume da narração entra SÓ no ramo que se ouve; o ramo que dispara o
    # abafamento da música continua no volume cheio, senão baixar a voz também
    # enfraquece o ducking e a música volta a atropelar a fala.
    def _filtro(modo):
        base = (parts + f"{refs}concat=n={n_v}:v=1:a=0[vc];"
                f"[vc]subtitles={ass.replace(os.sep,'/')}" + venc.fim_v(modo) + ";"
                f"[{idx_mus}:a]atrim={mus_start}:{mus_start+total},asetpts=N/SR/TB,"
                f"volume={_vol(cfg, 'vol_musica', VOL_VOZ)}[mus];"
                f"[{idx_voz}:a]apad=whole_dur={total:.2f}[vp];[vp]asplit=2[vf0][vk];"
                f"[vf0]volume={_vol(cfg, 'vol_voz', 1.0)}[vf];"
                f"[mus][vk]sidechaincompress=threshold=0.02:ratio=12:attack=5:release=300[md];")
        if manter:
            return (base +
                    f"[0:a]aresample=44100,apad=whole_dur={total:.2f},atrim=0:{total:.2f},"
                    f"asetpts=N/SR/TB,volume={_vol(cfg, 'vol_original', VOL_ORIG)}[orig];"
                    f"[md][vf][orig]amix=inputs=3:duration=first:normalize=0,"
                    f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim}:d={FADE}[aout]")
        return (base +
                f"[md][vf]amix=inputs=2:duration=first:normalize=0,"
                f"afade=t=in:st=0:d={FADE},afade=t=out:st={fim}:d={FADE}[aout]")

    saida = os.path.join(DIR_SAIDA, nome + sufixo + ".mp4")
    ins = []
    if loops > 0: ins += ["-stream_loop", str(loops)]
    ins += ["-t", f"{vid_dur:.2f}", "-i", video]   # video toca 1x (loop só se faltar)
    for ic in img_clipes:
        ins += ["-i", ic]
    ins += ["-stream_loop", "-1", "-i", musica, "-i", voz_mp3]

    r = None
    for modo in venc.modos(FFMPEG):
        cmd = [FFMPEG, "-y", *venc.dev_args(modo), *ins,
               "-filter_complex", _filtro(modo), "-map", "[vout]", "-map", "[aout]",
               *venc.codec_v(modo, crf=CRF), "-c:a", "aac", "-b:a", AUDIO_KBPS,
               "-r", str(FPS), "-t", f"{total:.2f}", "-movflags", "+faststart", saida]
        r = run(cmd)
        if r.returncode == 0:
            return True, ""
        if modo == "gpu":
            venc.desligar_gpu()
    return False, (r.stderr[-600:] if r else "")


# ------------------------------------------------- montagem feita pela pessoa
# Tudo daqui pra baixo só roda quando existe um `roteiro.json` na pasta do job,
# ou seja, quando o pedido veio do Editor automático. Sem ele a fábrica segue
# exatamente como sempre foi (fábrica avulsa, jobs antigos, cortes, lote).

# Regras de tamanho do Editor (as MESMAS de src/lib/montagem.ts; mudou lá, mude aqui)
MAX_MONTAGEM = 120.0      # o Editor não faz vídeo maior que 2 minutos
SEG_POR_APOIO = 10.0      # cabe 1 cena de apoio a cada 10s do clipe principal
APOIO_MIN, APOIO_MAX = 0.8, 6.0   # quanto tempo um clipe de apoio fica na tela
_AN = {"cima": 8, "meio": 5, "baixo": 2}   # alinhamento ASS por posição


def ler_roteiro(prod_dir):
    """Lê o roteiro.json: a montagem que a pessoa fez na tela (ordem, cortes,
    clipe principal, textos e volumes). None = pedido não veio do editor."""
    p = os.path.join(prod_dir, "roteiro.json")
    if not os.path.exists(p):
        return None
    try:
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
    except Exception:
        return None
    return d if isinstance(d, dict) and d.get("clipes") else None


def contexto_cenas(roteiro):
    """Junta as descrições que a pessoa escreveu pra cada clipe, na ordem em que
    aparecem, pra a copy da IA falar do que está na tela naquele momento.

    Faz o papel que o "cérebro editor" (`plano_edicao`) fazia: ele não roda na
    montagem do editor, porque quem escolheu ordem e cenas foi a pessoa.

    O clipe principal não entra: ele não tem descrição de propósito (a narração é
    a fala dele, e é a transcrição que conta essa parte da história)."""
    linhas = []
    for c in (roteiro.get("clipes") or []):
        if c.get("papel") == "principal":
            continue
        d = str(c.get("descricao") or "").strip()
        if not d:
            continue
        linhas.append(f"{len(linhas) + 1}) {d}")
    return "; ".join(linhas)[:1500]


def _caminho_clipe(prod_dir, c):
    """Onde o arquivo desse item do roteiro foi salvo (ou None se sumiu)."""
    sub = "imagens" if c.get("tipo") == "image" else "videos"
    p = os.path.join(prod_dir, sub, str(c.get("nome") or ""))
    return p if os.path.isfile(p) else None


def _norm_v(i):
    """Normaliza um vídeo/imagem pro palco 9:16 (mesmo enquadramento do resto)."""
    return (f"[{i}:v]{_pre_crop()}scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}")


def _esc_ass(txt):
    """Texto do usuário dentro do ASS: chaves viram parênteses (senão viram tag)
    e a quebra de linha vira \\N."""
    return (str(txt).replace("\\", "/").replace("{", "(").replace("}", ")")
            .replace("\r", "").replace("\n", "\\N"))


def _estilo_manual(chave):
    aln = _AN.get(chave, 2)
    mv = 0 if aln == 5 else (MARGEM_CIMA if aln == 8 else MARGEM_BAIXO)
    return (f"Style: Manual{chave},{FONTE},{FT_LEGENDA},&H00FFFFFF,&H00000000,"
            f"&H64000000,1,0,0,0,100,100,0,0,1,{CONTORNO},2,{aln},70,70,{mv},1")


def ass_montagem(caminho, textos, captions=None, frases=None, dur_total=0,
                 preco=None, produto=None, pos="baixo"):
    """Legenda da montagem. Junta, em camadas separadas:
      - os textos que a PESSOA escreveu (cada um no seu tempo e na sua posição);
      - as legendas da IA (formato Legenda) OU as frases cronometradas (narração
        da IA e transcrição da fala do clipe principal)."""
    aln, mv = _aln_margin(pos)
    estilos = [
        f"Style: Venda,{FONTE},{FT_LEGENDA},&H00FFFFFF,&H00000000,&H64000000,"
        f"1,0,0,0,100,100,0,0,1,{CONTORNO},2,{aln},70,70,{mv},1",
        _estilo_gancho(aln, mv),
        _ESTILOS_PRECO,
    ] + [_estilo_manual(k) for k in _AN]

    ev = []
    if frases:
        for k, (txt, ini, fim) in enumerate(frases):
            estilo = "Gancho" if k == 0 else "Venda"
            ev.append(f"Dialogue: 0,{t(ini)},{t(fim)},{estilo},,0,0,0,,{_esc_ass(txt)}")
    elif captions:
        seg = max(0.5, dur_total) / max(1, len(captions))
        for i, txt in enumerate(captions):
            estilo = "Gancho" if i == 0 else "Venda"
            ev.append(f"Dialogue: 0,{t(i*seg+0.2)},{t((i+1)*seg-0.1)},{estilo},,0,0,0,,"
                      f"{_esc_ass(txt)}")

    for tx in (textos or []):
        chave = str(tx.get("pos") or "baixo").lower()
        if chave not in _AN:
            chave = "baixo"
        try:
            ini = max(0.0, float(tx.get("in", 0)))
            fim = max(ini + 0.2, float(tx.get("out", ini + 3)))
        except (TypeError, ValueError):
            continue
        conteudo = str(tx.get("texto") or "").strip()
        if not conteudo:
            continue
        # camada 1: fica por cima da legenda da IA quando as duas existirem
        ev.append(f"Dialogue: 1,{t(ini)},{t(fim)},Manual{chave},,0,0,0,,{_esc_ass(conteudo)}")

    ev += _eventos_preco(preco, dur_total or 10, produto)
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(_cab_ass("\n".join(estilos)) + "\n".join(ev) + "\n")


def transcrever_fala(video, lang="pt", modelo="small"):
    """Transcreve a fala do clipe principal com faster-whisper LOCAL (sem custo de
    API). Serve pra IA saber DO QUE a pessoa está falando em cada segundo e
    encaixar os apoios no momento certo. Retorna [{ini, fim, texto}] ou []."""
    try:
        from faster_whisper import WhisperModel
    except Exception:
        return []
    # nome derivado do arquivo: com vários principais (e vários produtos rodando
    # em paralelo) um nome fixo faria uma transcrição atropelar a outra
    base_nome = re.sub(r"[^\w.-]+", "_", os.path.basename(video))[:60]
    wav = os.path.join(DIR_TEMP, f"fala_{base_nome}.wav")
    os.makedirs(DIR_TEMP, exist_ok=True)
    if run([FFMPEG, "-y", "-i", video, "-ac", "1", "-ar", "16000", "-vn", wav]).returncode != 0:
        return []
    try:
        wm = WhisperModel(modelo, device="cpu", compute_type="int8",
                          cpu_threads=os.cpu_count() or 4)
        segs, _info = wm.transcribe(
            wav, vad_filter=True,
            language=None if lang in ("auto", "", None) else lang)
        return [{"ini": float(s.start), "fim": float(s.end), "texto": (s.text or "").strip()}
                for s in segs if (s.text or "").strip()]
    except Exception:
        return []
    finally:
        try:
            os.remove(wav)
        except OSError:
            pass


def planejar_apoios(apoios, dur_base, fala):
    """Decide em que segundo cada clipe de apoio entra por cima do principal.

    Quem já tem `entra` (a pessoa arrastou na linha do tempo) manda. Pros demais
    a IA lê a transcrição da fala e escolhe o trecho que combina com aquele
    clipe; sem IA ou sem fala, distribui em intervalos iguais. No fim resolve as
    sobreposições empurrando pra frente e derruba o que não couber.

    Retorna [(indice_do_apoio, entra, duracao)] já em ordem de tempo."""
    if not apoios:
        return []
    # cabe 1 cena de apoio a cada 10s do principal; o resto fica de fora (a tela
    # já avisa antes de gerar, isto aqui é a mesma regra do lado do render)
    cabem = int(dur_base // SEG_POR_APOIO)
    if len(apoios) > cabem:
        apoios = apoios[:cabem]
    if not apoios:
        return []
    duracoes = []
    for a in apoios:
        try:
            d = float(a.get("out", 0)) - float(a.get("in", 0))
        except (TypeError, ValueError):
            d = 3.0
        duracoes.append(max(APOIO_MIN, min(APOIO_MAX, d if d > 0 else 3.0)))

    livres = [i for i, a in enumerate(apoios) if a.get("entra") is None]
    escolhas = {}
    if livres and fala:
        try:
            import gemini_copy
            escolhas = gemini_copy.plano_broll(fala, [
                {"i": i, "tipo": apoios[i].get("tipo", "video"),
                 "nome": apoios[i].get("nome", ""), "dur": round(duracoes[i], 1),
                 # o que a pessoa escreveu que tem nesse clipe: é a pista mais
                 # forte pra IA casar o apoio com o trecho certo da fala
                 "descricao": str(apoios[i].get("descricao") or "").strip()}
                for i in livres
            ], dur_base)
        except Exception:
            escolhas = {}

    # distribuição em intervalos iguais: fallback e ponto de partida dos livres
    marcas = []
    for k, i in enumerate(livres):
        padrao = dur_base * (k + 1) / (len(livres) + 1)
        marcas.append([i, float(escolhas.get(i, padrao))])
    for i, a in enumerate(apoios):
        if a.get("entra") is not None:
            try:
                marcas.append([i, float(a["entra"])])
            except (TypeError, ValueError):
                marcas.append([i, 0.0])

    marcas.sort(key=lambda m: m[1])
    saida, cursor = [], 0.0
    for i, entra in marcas:
        d = duracoes[i]
        entra = max(cursor, min(entra, dur_base))
        # apoio não pode invadir o fim do vídeo nem colar no anterior
        if entra + d > dur_base:
            d = dur_base - entra
        if d < APOIO_MIN:
            continue          # não sobrou espaço: esse apoio fica de fora
        saida.append((i, round(entra, 2), round(d, 2)))
        cursor = entra + d
    return saida


def _filtro_stems(i_orig, i_mus, i_voz, v_orig, v_mus, v_voz, total):
    """Mistura as FAIXAS SEPARADAS (som do vídeo, música e narração) numa trilha só.

    Cada faixa entra no volume que a pessoa escolheu, e a música abaixa sozinha
    enquanto a narração fala (ducking). É a mesma conta usada no render e no
    botão "Reajustar áudio", por isso o resultado bate nos dois."""
    partes, camadas = "", []
    if i_orig is not None:
        partes += (f"[{i_orig}:a]aresample=44100,apad=whole_dur={total:.2f},"
                   f"atrim=0:{total:.2f},asetpts=N/SR/TB,volume={v_orig}[sorig];")
        camadas.append("[sorig]")
    if i_voz is not None:
        if i_mus is not None:
            # [svk] é a cópia em volume cheio que dispara o ducking da música:
            # se abaixasse junto, baixar a voz fraquejaria o abafamento.
            partes += (f"[{i_voz}:a]aresample=44100,apad=whole_dur={total:.2f},"
                       f"atrim=0:{total:.2f},asetpts=N/SR/TB[svp];"
                       f"[svp]asplit=2[svf0][svk];[svf0]volume={v_voz}[svoz];")
        else:
            partes += (f"[{i_voz}:a]aresample=44100,apad=whole_dur={total:.2f},"
                       f"atrim=0:{total:.2f},asetpts=N/SR/TB,volume={v_voz}[svoz];")
        camadas.append("[svoz]")
    if i_mus is not None:
        partes += (f"[{i_mus}:a]aresample=44100,apad=whole_dur={total:.2f},"
                   f"atrim=0:{total:.2f},asetpts=N/SR/TB,volume={v_mus}[smus0];")
        if i_voz is not None:
            partes += ("[smus0][svk]sidechaincompress=threshold=0.02:ratio=12:"
                       "attack=5:release=300[smus];")
        else:
            partes += "[smus0]anull[smus];"
        camadas.append("[smus]")

    if not camadas:   # vídeo mudo, sem música e sem narração
        partes += (f"anullsrc=r=44100:cl=stereo,atrim=0:{total:.2f},"
                   f"asetpts=N/SR/TB[amix];")
    elif len(camadas) == 1:
        partes += f"{camadas[0]}anull[amix];"
    else:
        partes += ("".join(camadas) +
                   f"amix=inputs={len(camadas)}:duration=first:normalize=0[amix];")
    fim = max(0.0, total - FADE)
    # alguém passou de 100% (a tela deixa ir até 150%): entra um limitador pra
    # amplificar sem estourar. Abaixo disso o som segue intocado, como sempre foi.
    limite = "alimiter=limit=0.95," if max(v_orig, v_mus, v_voz) > 1.0 else ""
    return partes + (f"[amix]{limite}afade=t=in:st=0:d={FADE},"
                     f"afade=t=out:st={fim}:d={FADE}[aout]")


def _stem_som(nome, sufixo, pedacos, total):
    """Faixa com o SOM DOS VÍDEOS, emendando os pedaços na ordem.

    Serve pros dois modos: a fala da pessoa nos clipes principais (que podem ser
    vários, tocando em sequência) e o som original dos clipes em sequência. Onde
    não há áudio entra silêncio do tamanho do pedaço, senão o concat recusa a
    mistura. None = não há nada pra ouvir (vídeo mudo)."""
    if not pedacos or not any(p["som"] for p in pedacos):
        return None
    alvo = os.path.join(DIR_TEMP, f"fab_stem_orig_{nome}{sufixo}.m4a")
    ins, partes = [], ""
    for i, p in enumerate(pedacos):
        d = max(0.1, float(p["dur"]))
        if p["som"]:
            ins += ["-ss", f"{float(p['ss']):.2f}", "-t", f"{d:.2f}", "-i", p["path"]]
            partes += (f"[{i}:a]aresample=44100,apad=whole_dur={d:.2f},"
                       f"atrim=0:{d:.2f},asetpts=N/SR/TB[a{i}];")
        else:
            ins += ["-f", "lavfi", "-t", f"{d:.2f}", "-i", "anullsrc=r=44100:cl=stereo"]
            partes += f"[{i}:a]atrim=0:{d:.2f},asetpts=N/SR/TB[a{i}];"
    n = len(pedacos)
    refs = "".join(f"[a{i}]" for i in range(n))
    filtro = (partes + f"{refs}concat=n={n}:v=0:a=1,apad=whole_dur={total:.2f},"
              f"atrim=0:{total:.2f},asetpts=N/SR/TB[aout]")
    r = run([FFMPEG, "-y", *ins, "-filter_complex", filtro, "-map", "[aout]",
             "-c:a", "aac", "-b:a", AUDIO_KBPS, alvo])
    return alvo if r.returncode == 0 else None


def _veloc_musica(cfg):
    """Velocidade da música escolhida na tela. Só aceita os passos da lista (os
    mesmos de `src/lib/montagem.ts`); qualquer outra coisa vira 1x."""
    try:
        v = float(str(cfg.get("vel_musica", "") or 1).strip())
    except ValueError:
        return 1.0
    for p in (0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0):
        if abs(p - v) < 0.001:
            return p
    return 1.0


def _cadeia_tempo(veloc):
    """Quebra a velocidade em passos que o `atempo` aceita (0.5 a 2.0 por vez).
    0.25x vira duas passadas de 0.5. 1x devolve lista vazia (nada a fazer)."""
    v = float(veloc or 1.0)
    if abs(v - 1.0) < 0.01:
        return []
    passos = []
    while v < 0.5 - 1e-6:
        passos.append(0.5)
        v /= 0.5
    while v > 2.0 + 1e-6:
        passos.append(2.0)
        v /= 2.0
    passos.append(round(v, 4))
    return passos


def _stem_musica(nome, sufixo, musica, mus_start, total, veloc=1.0):
    """Faixa da música já no tamanho do vídeo (dando a volta se ela for curta) e
    já na velocidade escolhida.

    A velocidade é feita por TIME-STRETCH, que muda o andamento SEM mexer no tom:
    acelerar não deixa a música com voz de desenho nem grave demais. Preferimos o
    `rubberband` (qualidade de estúdio) e caímos no `atempo` quando o ffmpeg da
    máquina não tem a biblioteca. Como o esticão muda a duração, é preciso pegar
    `total * velocidade` de música pra sobrar exatamente `total` no fim."""
    # a "música" pode ser um mp4 (usamos só o som); sem faixa de áudio, não há
    # trilha nenhuma pra extrair e o vídeo segue sem música
    if not musica or not _tem_audio(musica):
        return None
    alvo = os.path.join(DIR_TEMP, f"fab_stem_mus_{nome}{sufixo}.m4a")
    passos = _cadeia_tempo(veloc)
    fonte = total * (float(veloc) if passos else 1.0)
    base = f"atrim={mus_start}:{mus_start+fonte},asetpts=N/SR/TB"
    cauda = f",apad=whole_dur={total:.2f},atrim=0:{total:.2f}"

    tentativas = []
    if passos:
        tentativas.append(base + f",rubberband=tempo={float(veloc)}" + cauda)
        tentativas.append(base + "".join(f",atempo={p}" for p in passos) + cauda)
    else:
        tentativas.append(base + cauda)

    for filtro in tentativas:
        r = run([FFMPEG, "-y", "-stream_loop", "-1", "-i", musica, "-vn",
                 "-af", filtro, "-c:a", "aac", "-b:a", AUDIO_KBPS, alvo])
        if r.returncode == 0:
            return alvo
    return None


def _gravar_stems(prod_dir, stems, total, volumes):
    """Deixa registrado onde ficaram as faixas separadas. O worker lê esse arquivo,
    guarda as faixas junto do vídeo e é isso que permite refazer só o áudio
    depois, em segundos, sem renderizar o vídeo de novo nem gastar crédito."""
    try:
        with open(os.path.join(prod_dir, "stems.json"), "w", encoding="utf-8") as f:
            json.dump({"orig": stems.get("orig"), "musica": stems.get("musica"),
                       "voz": stems.get("voz"), "total": round(total, 2),
                       "volumes": volumes}, f, ensure_ascii=False)
    except Exception:
        pass


def build_montagem(prod_dir, nome, cfg, roteiro, copy=None, sufixo="", var_idx=0, n_var=1):
    """Monta o vídeo EXATAMENTE como a pessoa montou na tela do Editor.

    Dois modos, decididos pelo clipe marcado como principal:

    - COM principal: ele é a base e o som dele nunca para (é a pessoa falando).
      Os outros clipes entram MUDOS, em tela cheia, nos momentos escolhidos, e a
      tela volta pro principal. A duração do vídeo é a do principal: os apoios
      substituem trechos, não somam tempo.
    - SEM principal: os clipes tocam em sequência, na ordem e com os cortes da
      tela. É a montagem que a fábrica jogava fora (`auditoria.md` #22).
    """
    clipes = []
    for c in (roteiro.get("clipes") or []):
        caminho = _caminho_clipe(prod_dir, c)
        if caminho:
            clipes.append({**c, "path": caminho})
    if not clipes:
        return False, "nenhum arquivo da montagem foi encontrado na pasta do job"

    vols = roteiro.get("volumes") or {}

    # som do vídeo e narração podem passar de 100% (a tela vai até 150%): aí a
    # gente amplifica de verdade e o limitador em `_filtro_stems` segura o estouro.
    # A música fica no teto de 100%, ela é fundo.
    def _pct(chave, padrao, teto=1.0):
        try:
            return max(0.0, min(teto, float(vols.get(chave)) / 100.0))
        except (TypeError, ValueError):
            return padrao

    formato = (cfg.get("formato") or "legenda").strip().lower()
    sem_copy = str(cfg.get("sem_copy", "")).strip().lower() in ("1", "sim", "true")
    comum = dict(
        textos=roteiro.get("textos") or [],
        preco=cfg.get("preco") or None,
        produto=cfg.get("produto", nome),
        pos_leg=cfg.get("legenda_pos", "baixo"),
        formato=formato,
        captions=(copy or {}).get("captions") if (formato == "legenda" and not sem_copy) else None,
        sem_musica=str(cfg.get("sem_musica", "")).strip().lower() in ("1", "sim", "true"),
        v_orig=_pct("original", VOL_ORIG, 1.5),
        v_voz=_pct("voz", 1.0, 1.5),
    )

    # pode haver VÁRIOS principais: eles tocam em sequência e formam a base
    bases = [c for c in clipes if c.get("papel") == "principal"]
    if bases:
        return _montar_com_principal(prod_dir, nome, cfg, clipes, bases, sufixo,
                                     var_idx, n_var,
                                     v_mus=_pct("musica", VOL_MANTER_MUS), **comum)
    return _montar_sequencial(prod_dir, nome, cfg, clipes, copy or {}, sufixo,
                              var_idx, n_var,
                              v_mus=_pct("musica", VOL_VOZ if formato == "voz" else VOL_LEGENDA),
                              **comum)


# Corte de silêncio: folga que fica de cada lado do trecho mudo, pra não engolir
# a respiração nem o comecinho da palavra seguinte. E o nível abaixo do qual o
# ffmpeg considera "silêncio" (-30dB aguenta o chiado normal de gravação caseira).
MARGEM_SILENCIO = 0.15
RUIDO_SILENCIO = "-30dB"
# dois silêncios separados por menos que isso são o MESMO silêncio (a fresta
# entre eles não é fala), e pedaço que fica menor que isso é piscada: sai fora.
JUNTA_SILENCIO = 0.4
MIN_PEDACO = 0.4


def _silencio_min(cfg):
    """Quanto tempo sem fala a pessoa mandou cortar. 0 = não cortar nada."""
    try:
        v = float(str(cfg.get("cortar_silencio", "") or 0).strip())
    except ValueError:
        return 0.0
    return v if 0.3 <= v <= 5.0 else 0.0


def detectar_silencios(video, minimo):
    """Acha os trechos SEM FALA do vídeo com o `silencedetect` do ffmpeg (local,
    sem custo de API). Devolve [(inicio, fim)] em segundos, só os mais longos
    que `minimo`. Trecho mudo que vai até o fim do arquivo é fechado na duração."""
    r = run([FFMPEG, "-hide_banner", "-i", video, "-af",
             f"silencedetect=noise={RUIDO_SILENCIO}:d={minimo}", "-f", "null", "-"])
    texto = (r.stderr or "") + "\n" + (r.stdout or "")
    inicios = [float(x) for x in re.findall(r"silence_start:\s*(-?[\d.]+)", texto)]
    fins = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)", texto)]
    dur = duracao(video) or 0.0
    trechos = []
    for i, ini in enumerate(inicios):
        fim = fins[i] if i < len(fins) else dur
        if fim > ini:
            trechos.append((max(0.0, ini), fim))
    return trechos


def _trechos_com_fala(video, ini, fim, minimo):
    """Divide [ini, fim] tirando os silêncios longos. Devolve [(a, b)] do que FICA.

    Se sobrar quase nada (ex.: vídeo quase todo mudo), devolve o trecho inteiro:
    é melhor entregar o vídeo original do que um corte irreconhecível."""
    if minimo <= 0:
        return [(ini, fim)]
    # junta silêncios quase colados: senão sobra um caco de fala entre eles que
    # no vídeo vira uma piscada de 2 quadros
    unidos = []
    for s, e in sorted(detectar_silencios(video, minimo)):
        if unidos and s - unidos[-1][1] < JUNTA_SILENCIO:
            unidos[-1] = (unidos[-1][0], max(unidos[-1][1], e))
        else:
            unidos.append((s, e))

    ficam, cursor = [], ini
    for s, e in unidos:
        s = max(ini, s) + MARGEM_SILENCIO
        e = min(fim, e) - MARGEM_SILENCIO
        if e - s < 0.2:
            continue          # depois da folga não sobrou silêncio pra cortar
        if s > cursor:
            ficam.append((cursor, s))
        cursor = max(cursor, e)
    if cursor < fim:
        ficam.append((cursor, fim))

    ficam = [(a, b) for a, b in ficam if b - a >= MIN_PEDACO]
    total = sum(b - a for a, b in ficam)
    # quase tudo virou silêncio (gravação baixa, detecção errada): melhor
    # entregar o vídeo inteiro do que um corte irreconhecível
    if not ficam or total < 1.0:
        return [(ini, fim)]
    return ficam


def _linha_da_base(bases, silencio_min=0.0):
    """Monta a linha do tempo da BASE: os clipes principais tocam em sequência,
    na ordem da lista, e cada um ocupa uma faixa dela.

    Com `silencio_min` > 0, cada principal ainda vira VÁRIOS pedaços: os trechos
    sem fala mais longos que isso saem fora (corte seco, imagem e som juntos).

    Devolve ([{path, in, dur, t0}], duracao_total). `t0` é em que segundo do
    vídeo aquele pedaço começa."""
    segs, acum = [], 0.0
    for b in bases:
        if acum >= MAX_MONTAGEM - 0.05:
            break
        b_in = max(0.0, float(b.get("in", 0) or 0))
        try:
            b_out = float(b.get("out", b_in + 5))
        except (TypeError, ValueError):
            b_out = b_in + 5.0
        b_out = max(b_in + 0.3, b_out)
        for a, z in _trechos_com_fala(b["path"], b_in, b_out, silencio_min):
            if acum >= MAX_MONTAGEM - 0.05:
                break
            dur = max(0.2, min(z - a, MAX_MONTAGEM - acum))
            segs.append({"path": b["path"], "in": a, "dur": dur, "t0": acum})
            acum += dur
    return segs, acum


def _fatias_da_base(segs, a, b):
    """Pedaços da base entre os segundos `a` e `b` do vídeo. Como a base pode ser
    a emenda de vários principais, um trecho pode cair em mais de um arquivo."""
    out = []
    for s in segs:
        ini = max(a, s["t0"])
        fim = min(b, s["t0"] + s["dur"])
        if fim - ini > 0.05:
            out.append((s["path"], s["in"] + (ini - s["t0"]), fim - ini))
    return out


def _fala_da_base(segs):
    """Transcreve a fala de CADA principal e traz os tempos pra linha do vídeo.

    Sem isso, com dois principais, a legenda do segundo apareceria com o tempo
    contado do começo do arquivo dele, e não do ponto em que ele entra.

    O resultado é guardado por arquivo: com corte de silêncio um mesmo vídeo vira
    vários pedaços, e transcrever de novo a cada pedaço custaria minutos à toa."""
    fala, cache = [], {}
    for s in segs:
        if s["path"] not in cache:
            cache[s["path"]] = transcrever_fala(s["path"]) or []
        for f in cache[s["path"]]:
            ini = f["ini"] - s["in"] + s["t0"]
            fim = f["fim"] - s["in"] + s["t0"]
            if fim <= s["t0"] or ini >= s["t0"] + s["dur"]:
                continue          # trecho fora do pedaço que entrou no vídeo
            fala.append({"ini": max(s["t0"], ini),
                         "fim": min(s["t0"] + s["dur"], fim),
                         "texto": f["texto"]})
    return fala


def _montar_com_principal(prod_dir, nome, cfg, clipes, bases, sufixo, var_idx, n_var,
                          *, textos, preco, produto, pos_leg, formato, captions,
                          sem_musica, v_orig, v_mus, v_voz):
    """Clipes principais como base (em sequência) + apoios em tela cheia por cima."""
    segs_base, dur_base = _linha_da_base(bases, _silencio_min(cfg))
    if not segs_base:
        return False, "clipe principal sem duração utilizável"
    apoios = [c for c in clipes if c.get("papel") != "principal"]

    # a fala dos principais serve pra IA escolher os momentos E, no formato
    # "Transcrever fala", vira a legenda cronometrada do vídeo
    precisa_fala = formato == "transcrever" or any(a.get("entra") is None for a in apoios)
    fala = _fala_da_base(segs_base) if precisa_fala else []
    marcas = planejar_apoios(apoios, dur_base, fala)

    # ---- sequência final: pedaços da base alternando com os apoios
    trechos, cursor = [], 0.0
    for i, entra, d in marcas:
        if entra > cursor + 0.05:
            trechos.append(("base", cursor, entra))
        trechos.append(("apoio", i, d))
        cursor = entra + d
    if cursor < dur_base - 0.05:
        trechos.append(("base", cursor, dur_base))
    if not trechos:
        trechos = [("base", 0.0, dur_base)]

    # CADA pedaço é uma entrada própria do ffmpeg. Abrir o mesmo arquivo várias
    # vezes com -ss é barato; fatiar um decode só (split + trim) faria o ffmpeg
    # segurar o vídeo inteiro em memória enquanto o concat ainda está no primeiro
    # pedaço - em vídeo longo isso vira vários GB de RAM e derruba o render.
    ins, partes, ordem = [], "", []
    for tr in trechos:
        if tr[0] == "base":
            for caminho, ss, dur in _fatias_da_base(segs_base, tr[1], tr[2]):
                k = len(ordem)
                ins += ["-ss", f"{ss:.2f}", "-t", f"{dur:.2f}", "-i", caminho]
                partes += _norm_v(k) + f"[t{k}];"
                ordem.append(f"[t{k}]")
        else:
            a = apoios[tr[1]]
            k = len(ordem)
            if a.get("tipo") == "image":
                ins += ["-loop", "1", "-t", f"{tr[2]:.2f}", "-i", a["path"]]
            else:
                ins += ["-ss", f"{float(a.get('in', 0)):.2f}", "-t", f"{tr[2]:.2f}",
                        "-i", a["path"]]
            partes += _norm_v(k) + f"[t{k}];"
            ordem.append(f"[t{k}]")
    n_video = len(ordem)

    # ---- faixas de áudio separadas (mixadas aqui e guardadas pro reajuste).
    # A fala vem dos arquivos originais inteiros, não desses pedaços: por isso
    # ela continua correndo por baixo enquanto os apoios cobrem a imagem.
    manter = _quer_manter_audio(cfg)
    veloc = _veloc_musica(cfg)
    musica, mus_start = (None, 0.0)
    if not sem_musica:
        # com música acelerada/lenta é preciso mais (ou menos) trecho da faixa:
        # a busca pelo melhor pedaço tem que olhar esse tamanho, não o do vídeo
        musica, mus_start = resolver_musica(cfg, dur_base * veloc, var_idx, n_var)
    stems = {
        "orig": _stem_som(nome, sufixo,
                          [{"path": s["path"], "ss": s["in"], "dur": s["dur"],
                            "som": manter and _tem_audio(s["path"])} for s in segs_base],
                          dur_base),
        "musica": _stem_musica(nome, sufixo, musica, mus_start, dur_base, veloc),
        "voz": None,
    }
    ins, i_orig, i_mus, i_voz = _entradas_stems(ins, stems, n_video)

    # ---- legenda: transcrição da fala (quando pedido) + textos da pessoa
    frases = None
    if formato == "transcrever" and fala:
        frases = [(f["texto"], max(0.0, f["ini"]), min(dur_base, f["fim"]))
                  for f in fala if f["fim"] > 0.05]
    ass = os.path.join("temp", f"fab_{nome}{sufixo}.ass")
    ass_montagem(os.path.join(BASE, ass), textos, captions=captions, frases=frases,
                 dur_total=dur_base, preco=preco, produto=produto, pos=pos_leg)

    m = len(ordem)

    def _filtro(modo):
        return (partes + "".join(ordem) + f"concat=n={m}:v=1:a=0[vc];"
                f"[vc]subtitles={ass.replace(os.sep, '/')}" + venc.fim_v(modo) + ";"
                + _filtro_stems(i_orig, i_mus, i_voz, v_orig, v_mus, v_voz, dur_base))

    ok, err = _render(ins, _filtro, nome + sufixo, dur_base)
    if ok:
        _gravar_stems(prod_dir, stems, dur_base,
                      {"original": round(v_orig * 100), "musica": round(v_mus * 100),
                       "voz": round(v_voz * 100)})
    return ok, err


def _montar_sequencial(prod_dir, nome, cfg, clipes, copy, sufixo, var_idx, n_var,
                       *, textos, preco, produto, pos_leg, formato, captions,
                       sem_musica, v_orig, v_mus, v_voz):
    """Clipes em sequência, na ordem e com os cortes que a pessoa fez na tela."""
    durs, ins = [], []
    for c in clipes:
        try:
            d = float(c.get("out", 0)) - float(c.get("in", 0))
        except (TypeError, ValueError):
            d = 3.0
        d = max(0.3, min(MAX_MONTAGEM, d))
        durs.append(d)
        if c.get("tipo") == "image":
            ins += ["-loop", "1", "-t", f"{d:.2f}", "-i", c["path"]]
        else:
            ins += ["-ss", f"{float(c.get('in', 0)):.2f}", "-t", f"{d:.2f}", "-i", c["path"]]
    n = len(clipes)
    dur_montagem = min(MAX_MONTAGEM, sum(durs))

    # narração da IA (formato "Voz narrada"): o vídeo estica até cobrir a fala
    voz_mp3, frases = None, None
    narr_dur = 0.0
    if formato == "voz" and (copy.get("roteiro") or "").strip():
        alvo = os.path.join(DIR_TEMP, f"fab_voz_{nome}{sufixo}.mp3")
        dur_voz, palavras = gerar_voz_com_tempos(copy["roteiro"], alvo)
        if os.path.exists(alvo):
            voz_mp3 = alvo
            frases = agrupar_em_frases(palavras)
            narr_dur = dur_voz + 0.8
    total = min(MAX_MONTAGEM, max(dur_montagem, narr_dur))
    sobra = max(0.0, total - dur_montagem)   # congela o último quadro se a fala passar

    veloc = _veloc_musica(cfg)
    musica, mus_start = (None, 0.0)
    if not sem_musica:
        musica, mus_start = resolver_musica(cfg, total * veloc, var_idx, n_var)
    manter = _quer_manter_audio(cfg)
    stems = {
        "orig": _stem_som(
            nome, sufixo,
            [{"path": c["path"], "ss": float(c.get("in", 0) or 0), "dur": durs[i],
              "som": manter and c.get("tipo") != "image" and _tem_audio(c["path"])}
             for i, c in enumerate(clipes)],
            total),
        "musica": _stem_musica(nome, sufixo, musica, mus_start, total, veloc),
        "voz": voz_mp3,
    }
    ins, i_orig, i_mus, i_voz = _entradas_stems(ins, stems, n)

    partes = "".join(_norm_v(i) + f"[v{i}];" for i in range(n))
    refs = "".join(f"[v{i}]" for i in range(n))
    cauda = f",tpad=stop_mode=clone:stop_duration={sobra:.2f}" if sobra > 0.05 else ""

    ass = os.path.join("temp", f"fab_{nome}{sufixo}.ass")
    ass_montagem(os.path.join(BASE, ass), textos, captions=captions, frases=frases,
                 dur_total=total, preco=preco, produto=produto, pos=pos_leg)

    def _filtro(modo):
        return (partes + refs + f"concat=n={n}:v=1:a=0[vc0];[vc0]setsar=1{cauda}[vc];"
                f"[vc]subtitles={ass.replace(os.sep, '/')}" + venc.fim_v(modo) + ";"
                + _filtro_stems(i_orig, i_mus, i_voz, v_orig, v_mus, v_voz, total))

    ok, err = _render(ins, _filtro, nome + sufixo, total)
    if ok:
        _gravar_stems(prod_dir, stems, total,
                      {"original": round(v_orig * 100), "musica": round(v_mus * 100),
                       "voz": round(v_voz * 100)})
    return ok, err


def _entradas_stems(ins, stems, n_video):
    """Põe as faixas de áudio no fim da lista de entradas e devolve o índice de
    cada uma (None quando aquela faixa não existe nesse vídeo)."""
    i_orig = i_mus = i_voz = None
    prox = n_video
    for chave in ("orig", "musica", "voz"):
        if not stems.get(chave):
            continue
        ins = ins + ["-i", stems[chave]]
        if chave == "orig":
            i_orig = prox
        elif chave == "musica":
            i_mus = prox
        else:
            i_voz = prox
        prox += 1
    return ins, i_orig, i_mus, i_voz


def _render(ins, monta_filtro, nome_saida, total):
    """Roda o ffmpeg tentando GPU e caindo pra CPU, igual ao resto da fábrica."""
    saida = os.path.join(DIR_SAIDA, nome_saida + ".mp4")
    r = None
    for modo in venc.modos(FFMPEG):
        r = run([FFMPEG, "-y", *venc.dev_args(modo), *ins,
                 "-filter_complex", monta_filtro(modo), "-map", "[vout]", "-map", "[aout]",
                 *venc.codec_v(modo, crf=CRF), "-c:a", "aac", "-b:a", AUDIO_KBPS,
                 "-r", str(FPS), "-t", f"{total:.2f}",
                 "-movflags", "+faststart", saida])
        if r.returncode == 0:
            return True, ""
        if modo == "gpu":
            venc.desligar_gpu()
    return False, (r.stderr[-600:] if r else "")


def remixar(video, orig, musica, voz, v_orig, v_mus, v_voz, total, saida):
    """REAJUSTAR ÁUDIO: refaz só o som de um vídeo que já ficou pronto, usando as
    faixas separadas guardadas no render. A imagem é copiada como está
    (`-c:v copy`), então isso leva segundos e não renderiza nada de novo."""
    ins, prox = ["-i", video], 1
    i_orig = i_mus = i_voz = None
    for caminho, papel in ((orig, "orig"), (musica, "mus"), (voz, "voz")):
        if not caminho or not os.path.exists(caminho):
            continue
        ins += ["-i", caminho]
        if papel == "orig":
            i_orig = prox
        elif papel == "mus":
            i_mus = prox
        else:
            i_voz = prox
        prox += 1
    filtro = _filtro_stems(i_orig, i_mus, i_voz, v_orig, v_mus, v_voz, total)
    r = run([FFMPEG, "-y", *ins, "-filter_complex", filtro,
             "-map", "0:v", "-map", "[aout]", "-c:v", "copy",
             "-c:a", "aac", "-b:a", AUDIO_KBPS, "-shortest",
             "-movflags", "+faststart", saida])
    return (r.returncode == 0 and os.path.exists(saida)), (r.stderr[-600:] if r else "")



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

        # 0) MONTAGEM DO EDITOR: a pessoa já decidiu ordem, cortes, textos e qual é
        #    o clipe principal, então a IA não reordena nada aqui. A limpeza de
        #    marca d'água também fica de fora: ela TROCA o arquivo das imagens e
        #    isso quebraria a referência por nome que o roteiro usa.
        roteiro = ler_roteiro(prod_dir)
        if roteiro:
            tom = cfg.get("tom", "equilibrado").lower()
            try:
                n_var = max(1, min(5, int(float(cfg.get("variantes", "1") or 1))))
            except ValueError:
                n_var = 1
            sem_copy = str(cfg.get("sem_copy", "")).strip().lower() in ("1", "sim", "true")
            # o que a pessoa escreveu sobre cada cena guia a copy (sem isso a IA
            # escreveria às cegas, já que aqui o plano_edicao não roda)
            contexto = contexto_cenas(roteiro)
            for i in range(n_var):
                copy = {}
                if not sem_copy and formato in ("legenda", "voz"):
                    copy = gemini_copy.gerar_copy(
                        produto, descricao, formato=formato, tom=tom,
                        contexto_visual=contexto,
                        preco=cfg.get("preco", ""),
                        plataforma=cfg.get("plataforma", "shopee"))
                sufixo = "" if n_var == 1 else f"-v{i+1}"
                ok, err = build_montagem(prod_dir, nome, cfg, roteiro, copy, sufixo,
                                         i, n_var)
                if not ok:
                    return (nome, f"ERRO vídeo v{i+1}: {err}")
                escrever_txt(nome + sufixo, copy, produto)
            return (nome, f"OK montagem ({n_var} variante(s))")

        # 1) IA tira marca d'água das imagens (PADRÃO, com cache)
        imgs_all = listar(prod_dir, "imagens", EXTS_I)
        if imgs_all and cfg.get("limpar_marca", "sim").lower() not in ("nao", "não", "no", "false", "0"):
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
        n_videos = len(listar(prod_dir, "videos", EXTS_V))
        plano = gemini_copy.plano_edicao(produto, descricao, imgs_all,
                                         n_videos=n_videos, max_fotos=6)
        idx = plano.get("indices") or list(range(len(imgs_all)))
        imagens = [imgs_all[i] for i in idx if 0 <= i < len(imgs_all)]
        contexto = plano.get("cenas", "")

        for i in range(n_var):
            # copy nova a cada variante -> legendas/roteiro diferentes
            copy = gemini_copy.gerar_copy(produto, descricao, formato=formato, tom=tom,
                                          contexto_visual=contexto,
                                          preco=cfg.get("preco", ""),
                                          plataforma=cfg.get("plataforma", "shopee"))
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


def _cli_remix():
    """`python fabrica.py --remix ...`: refaz só o áudio de um vídeo pronto.
    Fica aqui (e não no worker) pra a mixagem ser a MESMA conta do render."""
    import argparse
    p = argparse.ArgumentParser(description="Reajustar áudio de um vídeo pronto")
    p.add_argument("--remix", action="store_true")
    p.add_argument("--video", required=True)
    p.add_argument("--orig", default="")
    p.add_argument("--musica", default="")
    p.add_argument("--voz", default="")
    p.add_argument("--vol-orig", type=float, default=100.0)
    p.add_argument("--vol-mus", type=float, default=40.0)
    p.add_argument("--vol-voz", type=float, default=100.0)
    p.add_argument("--dur", type=float, default=0.0)
    p.add_argument("--saida", required=True)
    a = p.parse_args()

    def _p(v):
        return max(0.0, min(1.0, float(v) / 100.0))

    total = a.dur or duracao(a.video)
    if total <= 0:
        print("ERRO no remix: não consegui medir a duração do vídeo")
        return False
    ok, err = remixar(a.video, a.orig, a.musica, a.voz,
                      _p(a.vol_orig), _p(a.vol_mus), _p(a.vol_voz), total, a.saida)
    if not ok:
        print("ERRO no remix:", err)
    return ok


def main():
    if "--remix" in sys.argv:
        sys.exit(0 if _cli_remix() else 1)

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
    print("\nFábrica concluída.")

    # Consumo de APIs desta rodada (tokens Gemini, chars ElevenLabs, segundos Veo):
    # o worker lê esse JSON e manda pra web debitar o custo REAL do job.
    # Só grava quando rodou UM produto (é como o worker sempre chama); numa rodada
    # com vários produtos o acumulado é do processo inteiro e não dá pra ratear.
    if alvo:
        uso.dump(os.path.join(DIR_PRODUTOS, alvo, "consumo.json"))


if __name__ == "__main__":
    main()
