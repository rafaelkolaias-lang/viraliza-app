# -*- coding: utf-8 -*-
"""
Worker de render do Viraliza — versão serverrk (Linux + GPU AMD VAAPI).

Roda num container Docker no serverrk. Puxa job da VPS (web pública), renderiza
na GPU RX 5700 (h264_vaapi), salva o mp4 no SSD (/media, servido público por
https://media.univershoop.com) e reporta a URL pro app (sem subir bytes).

Env (worker.env):
  WEB_URL           = https://viraliza-app.cpgdmb.easypanel.host
  WORKER_TOKEN      = wk_...
  MEDIA_DIR         = /media                     (SSD montado)
  MEDIA_BASE_URL    = https://media.univershoop.com
  GEMINI_API_KEY(_2/_3), ELEVENLABS_API_KEYS     (pra fábrica/cortes - próxima fase)
  VAAPI_DEVICE      = /dev/dri/renderD128
"""
import os
import sys
import glob
import time
import uuid
import json
import shutil
import subprocess
import traceback

import requests

APP_DIR = os.path.dirname(os.path.abspath(__file__))  # /app no container

WEB_URL = (os.getenv("WEB_URL", "") or "").rstrip("/")
WORKER_TOKEN = os.getenv("WORKER_TOKEN", "")
MEDIA_DIR = os.getenv("MEDIA_DIR", "/media")
MEDIA_BASE_URL = (os.getenv("MEDIA_BASE_URL", "https://media.univershoop.com")).rstrip("/")
VAAPI_DEVICE = os.getenv("VAAPI_DEVICE", "/dev/dri/renderD128")
TRABALHO = "/tmp/viraliza-work"

HEADERS = {"x-worker-token": WORKER_TOKEN}


def log(msg):
    print(f"[worker] {msg}", flush=True)


# ---------------------------------------------------------------- HTTP c/ a VPS
def pegar_proximo():
    r = requests.get(f"{WEB_URL}/api/worker/proximo", headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json().get("job")


def progresso(job_id, etapa):
    try:
        requests.post(f"{WEB_URL}/api/worker/progresso/{job_id}", headers=HEADERS,
                      data={"etapa": etapa}, timeout=15)
    except Exception:
        pass


def reportar_erro(job_id, msg):
    try:
        requests.post(f"{WEB_URL}/api/worker/erro/{job_id}", headers=HEADERS,
                      data={"erro": msg[:4000]}, timeout=15)
    except Exception:
        pass


def baixar_entrada(job_id, sub, nome, destino):
    url = f"{WEB_URL}/api/worker/entrada/{job_id}/{sub}/{nome}"
    r = requests.get(url, headers=HEADERS, stream=True, timeout=180)
    r.raise_for_status()
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "wb") as f:
        for ch in r.iter_content(1 << 16):
            if ch:
                f.write(ch)


def resolver_fonte(url, work):
    """Vídeo da plataforma (marca em lote via cards): se o arquivo mora no NOSSO SSD
    (/media/...), lê DIRETO do disco - sem double-hop. Só baixa por HTTP se não achar."""
    if url.startswith(MEDIA_BASE_URL):
        rel = url[len(MEDIA_BASE_URL):].lstrip("/")
        local = os.path.join(MEDIA_DIR, rel)
        if os.path.isfile(local):
            return local  # leitura local, zero transferência
    dst = os.path.join(work, "videos", os.path.basename(url.split("?")[0]) or "fonte.mp4")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    r = requests.get(url, stream=True, timeout=180)
    r.raise_for_status()
    with open(dst, "wb") as f:
        for ch in r.iter_content(1 << 16):
            if ch:
                f.write(ch)
    return dst


def concluir_parte(job_id, parte, url, dur, leg="", tags="", thumb_url="", total=0):
    """Reporta 1 vídeo pronto (metadados + URL pública; sem bytes)."""
    data = {"parte": str(parte), "total": str(total), "url": url, "duracao": str(int(dur or 0))}
    if thumb_url:
        data["thumbUrl"] = thumb_url
    if leg:
        data["legenda"] = leg
    if tags:
        data["hashtags"] = tags
    r = requests.post(f"{WEB_URL}/api/worker/concluir/{job_id}", headers=HEADERS,
                      data=data, timeout=60)
    r.raise_for_status()
    return r.json()


def concluir_finalizar(job_id, dur=0):
    r = requests.post(f"{WEB_URL}/api/worker/concluir/{job_id}", headers=HEADERS,
                      data={"finalizar": "1", "duracao": str(int(dur or 0))}, timeout=60)
    r.raise_for_status()
    return r.json()


# ------------------------------------------------------------------- ffmpeg/GPU
def _run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, errors="replace")


def duracao(path):
    r = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
              "-of", "default=nk=1:nw=1", path])
    try:
        return int(float(r.stdout.strip()))
    except Exception:
        return 0


def subir_midia(local_path, sub):
    """Copia o arquivo pro SSD (/media/<sub>/<uuid>.<ext>) e devolve a URL pública."""
    ext = os.path.splitext(local_path)[1] or ".mp4"
    nome = f"{uuid.uuid4().hex}{ext}"
    dst_dir = os.path.join(MEDIA_DIR, sub)
    os.makedirs(dst_dir, exist_ok=True)
    shutil.copyfile(local_path, os.path.join(dst_dir, nome))
    return f"{MEDIA_BASE_URL}/{sub}/{nome}"


def gerar_thumb(video_path, thumb_path, quando=1):
    r = _run(["ffmpeg", "-y", "-ss", str(quando), "-i", video_path,
              "-frames:v", "1", "-vf", "scale=400:-2", thumb_path])
    return r.returncode == 0 and os.path.exists(thumb_path)


# Reenquadra 9:16 (fundo desfocado + vídeo centralizado) + carimba template por cima,
# encodando na GPU (h264_vaapi). O overlay/gblur roda no CPU; só o encode é GPU.
LOTE_W, LOTE_H = 1080, 1920
LOTE_MARGEM = 54  # ~5% da largura, respiro da logo até a borda

# base = vídeo já reenquadrado 9:16 (fundo desfocado + vídeo por cima), sem a marca
_LOTE_BASE = (
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
    "crop=1080:1920,scale=216:384,gblur=sigma=10,scale=1080:1920[bg];"
    "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
    "[bg][fg]overlay=(W-w)/2:(H-h)/2[base];"
)

# atalho: quando o vídeo JÁ é ~9:16, o fundo desfocado é trabalho jogado fora.
# Só escala/corta pra 1080x1920 (sem gblur nem duplo-scale) -> economiza MUITO CPU.
_LOTE_BASE_VERTICAL = (
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[base];"
)


def _dimensoes(path):
    """(largura, altura) do vídeo via ffprobe. (0,0) se falhar."""
    r = _run(["ffprobe", "-v", "error", "-select_streams", "v:0",
              "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", path])
    try:
        w, h = r.stdout.strip().split("x")[:2]
        return int(w), int(h)
    except Exception:
        return 0, 0


def _ja_vertical(path):
    """True se o vídeo já é ~9:16 (não precisa do fundo desfocado)."""
    w, h = _dimensoes(path)
    if not w or not h:
        return False
    return 1.70 <= (h / w) <= 1.90  # 9:16 = 1.777


def _xy_marca(pos):
    """Posição da logo (expressões do overlay: W/H = vídeo, w/h = logo)."""
    v, _, h = str(pos or "meio-meio").partition("-")
    x = {"esq": str(LOTE_MARGEM), "meio": "(W-w)/2",
         "dir": f"W-w-{LOTE_MARGEM}"}.get(h, "(W-w)/2")
    y = {"cima": str(LOTE_MARGEM), "meio": "(H-h)/2",
         "baixo": f"H-h-{LOTE_MARGEM}"}.get(v, "(H-h)/2")
    return x, y


def filtro_lote(tam=100, pos="meio-meio", vertical=False, x_pct=None, y_pct=None):
    """Monta o filtro de carimbo. tam=100 -> moldura (preenche a tela); tam<100 ->
    logo escalada pra tam% da largura. Se x_pct/y_pct (0-100) vierem, a logo fica
    livre com o CENTRO em (x_pct%, y_pct%); senão usa a posição nomeada (9 pontos)."""
    try:
        tam = int(float(tam))
    except (TypeError, ValueError):
        tam = 100
    if tam >= 100:
        ov = "[1:v]scale=1080:1920[ov];[base][ov]overlay=0:0"
    else:
        tam = max(10, min(99, tam))
        w = max(80, round(LOTE_W * tam / 100))
        if x_pct is not None and y_pct is not None:
            # posição livre: centro da logo em (x_pct%, y_pct%). W/H = base, w/h = logo.
            ov = (f"[1:v]scale={w}:-1[ov];[base][ov]"
                  f"overlay=(W*{x_pct:.2f}/100)-w/2:(H*{y_pct:.2f}/100)-h/2")
        else:
            x, y = _xy_marca(pos)
            ov = f"[1:v]scale={w}:-1[ov];[base][ov]overlay={x}:{y}"
    base = _LOTE_BASE_VERTICAL if vertical else _LOTE_BASE
    return base + ov + ":format=auto,format=nv12,hwupload[v]"


def carimbar_gpu(video, template, out, manter_audio=True, tam=100, pos="meio-meio",
                 x_pct=None, y_pct=None):
    """Em lote: 9:16 + template, encode na GPU. manter_audio=True mantém o som do
    vídeo original; False deixa mudo. tam/pos (ou x_pct/y_pct livres) controlam a marca."""
    audio = ["-map", "0:a?", "-c:a", "aac", "-b:a", "128k"] if manter_audio else ["-an"]
    vertical = _ja_vertical(video)  # já 9:16 -> pula o fundo desfocado (bem mais rápido)
    cmd = [
        "ffmpeg", "-y", "-vaapi_device", VAAPI_DEVICE,
        "-i", video, "-i", template,
        "-filter_complex", filtro_lote(tam, pos, vertical, x_pct, y_pct), "-map", "[v]", *audio,
        "-c:v", "h264_vaapi", "-rc_mode", "CQP", "-qp", "23",
        "-movflags", "+faststart", out,
    ]
    r = _run(cmd)
    ok = r.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 0
    if not ok:
        log("   ! ffmpeg falhou: " + (r.stderr or "")[-300:])
    return ok


# ----------------------------------------------------------------- tipos de job
def render_lote(job, work):
    """Job 'marca' (Em lote): baixa vídeo(s) + template, carimba 9:16 na GPU,
    sobe cada saída pro SSD e reporta a URL."""
    job_id = job["id"]
    arquivos = job.get("arquivos", {})
    vids = arquivos.get("videos", [])
    tmpls = arquivos.get("template", [])

    # som original do vídeo: "manter" (padrão) ou "remover" (Mudo)
    try:
        opc = json.loads(job.get("opcoes") or "{}")
    except Exception:
        opc = {}
    manter_audio = opc.get("audioVideo") != "remover"
    # tamanho (% da largura; 100 = moldura/tela cheia) + posição (9 pontos) da marca
    marca_tam = opc.get("marcaTamanho", 100)
    marca_pos = opc.get("marcaPosicao", "meio-meio")
    # posição livre (centro da logo em x/y %); só vale no modo logo (tam<100)
    def _pct(v):
        try:
            return max(0.0, min(100.0, float(v)))
        except (TypeError, ValueError):
            return None
    marca_x = _pct(opc.get("marcaX"))
    marca_y = _pct(opc.get("marcaY"))
    # vídeo da plataforma (via card "Colocar marca"): vem por URL e é lido LOCAL
    fonte_url = (opc.get("fonteUrl") or "").strip()

    if not tmpls:
        raise RuntimeError("Em lote precisa de um template.")

    progresso(job_id, "Baixando arquivos")
    baixar_entrada(job_id, "template", tmpls[0], os.path.join(work, "template", tmpls[0]))
    template = os.path.join(work, "template", tmpls[0])

    # entradas: ou a fonte da plataforma (1, lida local), ou os vídeos enviados (upload)
    if fonte_url:
        entradas = [resolver_fonte(fonte_url, work)]
    else:
        if not vids:
            raise RuntimeError("Em lote precisa de pelo menos 1 vídeo.")
        entradas = []
        for v in vids:
            baixar_entrada(job_id, "videos", v, os.path.join(work, "videos", v))
            entradas.append(os.path.join(work, "videos", v))

    total = len(entradas)
    ult_dur = 0
    for i, entrada in enumerate(entradas):
        progresso(job_id, f"Renderizando {i + 1}/{total}")
        out = os.path.join(work, f"saida-{i + 1}.mp4")
        if not carimbar_gpu(entrada, template, out, manter_audio=manter_audio,
                            tam=marca_tam, pos=marca_pos, x_pct=marca_x, y_pct=marca_y):
            raise RuntimeError(f"Falha ao renderizar o vídeo {i + 1}.")
        dur = duracao(out)
        ult_dur = dur
        url = subir_midia(out, "gerados")
        thumb_url = ""
        thumb = os.path.join(work, f"thumb-{i + 1}.jpg")
        if gerar_thumb(out, thumb):
            thumb_url = subir_midia(thumb, "thumbs")
        progresso(job_id, "Subindo")
        concluir_parte(job_id, i, url, dur, thumb_url=thumb_url, total=total)
        log(f"   ✓ saída {i + 1}/{total} no ar: {url}")
    return ult_dur


def ler_legenda(txt_path):
    """Lê o .txt e devolve (legenda LIMPA, hashtags). A fábrica grava com cabeçalhos
    (=== POSTAGEM ===, --- DESCRIÇÃO ---, --- HASHTAGS ---) — aqui tiramos tudo isso
    e sobra só a copy pronta pra postar. Cortes gravam só o título (sem cabeçalho)."""
    if not os.path.exists(txt_path):
        return "", ""
    try:
        with open(txt_path, encoding="utf-8") as f:
            txt = f.read()
    except Exception:
        return "", ""
    if "--- DESCRIÇÃO ---" in txt:
        resto = txt.split("--- DESCRIÇÃO ---", 1)[1]
        if "--- HASHTAGS ---" in resto:
            desc, htag = resto.split("--- HASHTAGS ---", 1)
            legenda = desc.strip()
            tags = " ".join(t for t in htag.split() if t.startswith("#")) or htag.strip()
        else:
            legenda, tags = resto.strip(), ""
    else:
        legenda = txt.strip()
        tags = " ".join(t for t in txt.split() if t.startswith("#"))
    return legenda, tags


def montar_pasta_fabrica(job):
    """Cria /app/produtos/job_<id>/ com a mídia de entrada + config.txt + descricao.txt
    (mesmo formato que a fábrica espera). Baixa os arquivos da VPS."""
    job_id = job["id"]
    nome = f"job_{job_id}"
    prod_dir = os.path.join(APP_DIR, "produtos", nome)
    shutil.rmtree(prod_dir, ignore_errors=True)
    os.makedirs(prod_dir, exist_ok=True)

    arquivos = job.get("arquivos", {})
    for sub in ("videos", "imagens"):
        for fname in arquivos.get(sub, []):
            baixar_entrada(job_id, sub, fname, os.path.join(prod_dir, sub, fname))
    for fname in arquivos.get("template", []):
        baixar_entrada(job_id, "template", fname, os.path.join(prod_dir, "template", fname))

    # música própria do usuário -> entrada/musicas/job_<id>.<ext> e aponta no config;
    # se não mandou, a fábrica usa a biblioteca padrão (para vender produtos.mp3 etc.)
    cfg_musica = ""
    musicas = arquivos.get("musica", [])
    if musicas:
        os.makedirs(os.path.join(APP_DIR, "entrada", "musicas"), exist_ok=True)
        fname = musicas[0]
        ext = os.path.splitext(fname)[1] or ".mp3"
        baixar_entrada(job_id, "musica", fname,
                       os.path.join(APP_DIR, "entrada", "musicas", f"job_{job_id}{ext}"))
        cfg_musica = f"job_{job_id}"

    with open(os.path.join(prod_dir, "descricao.txt"), "w", encoding="utf-8") as f:
        f.write(job.get("descricao", "") or "")

    # opções extras (JSON): hoje usamos audioVideo = "manter" | "remover" (som do vídeo)
    try:
        opc = json.loads(job.get("opcoes") or "{}")
    except Exception:
        opc = {}
    audio_original = "manter" if opc.get("audioVideo") == "manter" else "remover"
    # onde vai vender: muda o CTA/hashtags da copy ("shopee" = sacolinha laranja; "outro" = neutro)
    plataforma = (opc.get("plataforma") or "shopee").strip().lower() or "shopee"

    linhas = [
        f"produto: {job.get('produto', nome)}",
        f"formato: {job.get('formato', 'legenda')}",
        f"tom: {job.get('tom', 'agressivo')}",
        f"variantes: {job.get('variantes', 1)}",
        f"preco: {job.get('preco', '')}",
        f"legenda_pos: {job.get('legenda_pos', 'baixo')}",
        f"audio_original: {audio_original}",
        f"plataforma: {plataforma}",
    ]
    if cfg_musica:
        linhas.append(f"musica: {cfg_musica}")
    with open(os.path.join(prod_dir, "config.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")
    return nome


def render_fabrica(job, work):
    """Job 'produto' (fábrica): copy do Gemini + voz/legenda + montagem. Reusa o
    fabrica.py como subprocesso; coleta as saídas e sobe pro SSD."""
    job_id = job["id"]
    progresso(job_id, "Preparando")
    nome = montar_pasta_fabrica(job)

    env = dict(os.environ)
    if job.get("voz_id"):
        env["ELEVEN_VOICE_ID"] = job["voz_id"]
    if job.get("eleven_key"):  # BYO: usa a chave do usuário na frente das da plataforma
        env["ELEVENLABS_API_KEYS"] = job["eleven_key"]

    # limpa saídas antigas desse nome
    for old in glob.glob(os.path.join(APP_DIR, "saida", nome + "*")):
        try:
            os.remove(old)
        except OSError:
            pass

    progresso(job_id, "Escrevendo copy + narração")
    r = subprocess.run([sys.executable, "fabrica.py", nome, "--tudo"],
                       cwd=APP_DIR, env=env, capture_output=True, text=True, errors="replace")
    saidas = sorted(glob.glob(os.path.join(APP_DIR, "saida", nome + "*.mp4")))
    if not saidas:
        # erro DETALHADO: puxa as linhas úteis (voz/cota/traceback) em vez de só cortar
        full = ((r.stdout or "") + "\n" + (r.stderr or "")).strip()
        pistas = ("[voz]", "Voz falhou", "FALHOU", "ERRO", "Error", "Traceback",
                  "cota", "quota", "HTTP 4", "HTTP 5", "library voices")
        uteis = [ln for ln in full.splitlines() if any(p in ln for p in pistas)]
        resumo = "\n".join(uteis[-12:]) if uteis else full[-800:]
        raise RuntimeError("Fábrica não gerou vídeo.\n" + resumo)

    leg, tags = ler_legenda(os.path.join(APP_DIR, "saida", nome + ".txt"))
    total = len(saidas)
    ult_dur = 0
    for i, mp4 in enumerate(saidas):
        progresso(job_id, f"Subindo {i + 1}/{total}")
        dur = duracao(mp4)
        ult_dur = dur
        url = subir_midia(mp4, "gerados")
        thumb_url = ""
        thumb = mp4 + ".thumb.jpg"
        if gerar_thumb(mp4, thumb):
            thumb_url = subir_midia(thumb, "thumbs")
        concluir_parte(job_id, i, url, dur, leg=leg, tags=tags, thumb_url=thumb_url, total=total)
        log(f"   ✓ variante {i + 1}/{total} no ar: {url}")
    # limpa a saída local (já está no SSD)
    for f in saidas + glob.glob(os.path.join(APP_DIR, "saida", nome + "*.txt")):
        try:
            os.remove(f)
        except OSError:
            pass
    shutil.rmtree(os.path.join(APP_DIR, "produtos", nome), ignore_errors=True)
    return ult_dur


def render_cortes(job, work):
    """Job 'cortes' (clipador YouTube): baixa o vídeo, transcreve (faster-whisper nos
    12 núcleos), a IA escolhe os melhores momentos e corta em 9:16. Sobe cada corte
    pro SSD e reporta a URL. Reusa o cortar_youtube.py (já tem fallback Linux)."""
    job_id = job["id"]
    link = (job.get("fonte") or "").strip()
    if not link:
        raise RuntimeError("Job de cortes sem link do YouTube.")
    try:
        opc = json.loads(job.get("opcoes") or "{}")
    except Exception:
        opc = {}
    maxc = str(int(opc.get("max", 8) or 8))
    dur_alvo = str(int(opc.get("dur", 0) or 0))
    quer_leg = bool(opc.get("legenda"))
    pos = opc.get("pos", "baixo")
    cor = opc.get("cor", "amarelo")
    prefix = "corte"
    outdir = os.path.join(work, "cortes")
    os.makedirs(outdir, exist_ok=True)

    progresso(job_id, "Baixando + transcrevendo")
    r = subprocess.run(
        [sys.executable, "cortar_youtube.py", link, "--outdir", outdir,
         "--prefix", prefix, "--max", maxc, "--dur", dur_alvo,
         "--lang", "pt", "--workers", "2"],
        cwd=APP_DIR, capture_output=True, text=True, errors="replace")
    cortes = sorted(glob.glob(os.path.join(outdir, f"{prefix}_*.mp4")))
    if not cortes:
        cauda = ((r.stdout or "") + "\n" + (r.stderr or "")).strip()[-500:]
        raise RuntimeError("Não gerou nenhum corte. " + cauda)

    total = len(cortes)
    ult_dur = 0
    for i, mp4 in enumerate(cortes):
        progresso(job_id, f"Subindo {i + 1}/{total}")
        if quer_leg:  # legenda palavra-por-palavra (opcional, não-fatal)
            tmp = os.path.splitext(mp4)[0] + "_leg.mp4"
            subprocess.run(
                [sys.executable, "legendar_video.py", mp4, "--out", tmp,
                 "--pos", pos, "--cor", cor, "--lang", "pt"],
                cwd=APP_DIR, capture_output=True, text=True, errors="replace")
            if os.path.exists(tmp) and os.path.getsize(tmp) > 0:
                os.replace(tmp, mp4)
        leg, tags = ler_legenda(os.path.splitext(mp4)[0] + ".txt")
        dur = duracao(mp4)
        ult_dur = dur
        url = subir_midia(mp4, "cortes")
        thumb_url = ""
        thumb = mp4 + ".thumb.jpg"
        if gerar_thumb(mp4, thumb):
            thumb_url = subir_midia(thumb, "thumbs")
        concluir_parte(job_id, i, url, dur, leg=leg, tags=tags, thumb_url=thumb_url, total=total)
        log(f"   ✓ corte {i + 1}/{total} no ar: {url}")
    return ult_dur


DISPATCH = {
    "produto": render_fabrica,    # fábrica: copy Gemini + voz/legenda + montagem
    "marca": render_lote,         # Em lote: só carimba o template
    "cortes": render_cortes,      # clipador YouTube (faster-whisper + 9:16)
}


# ------------------------------------------------------------------------- main
def processar(job):
    job_id = job["id"]
    tipo = job.get("tipo", "produto")
    log(f">> job {job_id} (tipo={tipo})")
    work = os.path.join(TRABALHO, job_id)
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work, exist_ok=True)
    try:
        fn = DISPATCH.get(tipo)
        if fn is None:
            raise RuntimeError(f"Tipo de vídeo desconhecido: {tipo}")
        dur = fn(job, work)
        concluir_finalizar(job_id, dur or 0)
        log(f"<< job {job_id} concluído")
    except Exception as e:
        msg = f"{e}"
        log(f"!! erro no job {job_id}: {msg}")
        traceback.print_exc()
        reportar_erro(job_id, msg)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main():
    if not WEB_URL or not WORKER_TOKEN:
        log("FALTA WEB_URL / WORKER_TOKEN no env. Saindo.")
        sys.exit(1)
    os.makedirs(MEDIA_DIR, exist_ok=True)
    log(f"worker serverrk on. VPS={WEB_URL} | media={MEDIA_BASE_URL} | gpu={VAAPI_DEVICE}")
    ocioso = 0
    while True:
        try:
            job = pegar_proximo()
        except Exception as e:
            log(f"erro no polling: {e}")
            time.sleep(10)
            continue
        if not job:
            ocioso += 1
            if ocioso % 12 == 1:
                log("fila vazia...")
            time.sleep(5)
            continue
        ocioso = 0
        processar(job)


if __name__ == "__main__":
    main()
