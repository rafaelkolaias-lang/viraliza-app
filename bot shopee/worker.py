# -*- coding: utf-8 -*-
"""
WORKER DE RENDER — roda no SEU PC.
Fica perguntando pra web se tem vídeo na fila. Quando tem:
  1. baixa a mídia que o usuário enviou (vídeos/imagens/música)
  2. monta a pasta produtos/job_<id>/ do jeito que a fábrica espera
  3. roda a fábrica (fabrica.py) -> gera o(s) vídeo(s) em saida/
  4. sobe o(s) vídeo(s) pronto(s) de volta pra web

Só renderiza com o PC ligado e este script rodando (é de propósito: o servidor é
fraco e não aguenta render — quem tem força é o seu PC).

Setup:
  pip install -r requirements.txt        (precisa de 'requests')
  No .env da RAIZ:
     WORKER_TOKEN=...        (o MESMO que está no app/.env)
     WEB_URL=http://localhost:3000   (ou o domínio do servidor depois)
  python worker.py
"""
import os
import sys
import glob
import json
import time
import shutil
import subprocess

import requests
from dotenv import load_dotenv

load_dotenv()

# Console do Windows costuma ser cp1252: força UTF-8 pra não estourar ao imprimir
# glifos (✓ ✗ →) no log. errors="replace" é rede de segurança.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE = os.path.dirname(os.path.abspath(__file__))
DIR_PRODUTOS = os.path.join(BASE, "produtos")
DIR_SAIDA = os.path.join(BASE, "saida")
DIR_MUSICAS = os.path.join(BASE, "entrada", "musicas")

# rclone + pasta do Drive onde TODO vídeo gerado é guardado (a web serve de lá).
RCLONE = r"C:\Users\lucas\rclone\rclone.exe"
if not os.path.exists(RCLONE):
    RCLONE = "rclone"
DRIVE_BASE = "gdrive:Acervo Viraliza"

# BACKENDS: o worker atende 1+ apps (editor antigo + viraliza V2). WEB_URL pode
# ter várias URLs separadas por vírgula. WORKER_TOKEN pode ser 1 (serve todas) ou
# vários (na mesma ordem das URLs).
_URLS = [u.strip().rstrip("/") for u in (os.getenv("WEB_URL", "http://localhost:3000") or "").split(",") if u.strip()]
_TOKS = [t.strip() for t in (os.getenv("WORKER_TOKEN", "") or "").split(",") if t.strip()]


def _token(i):
    if not _TOKS:
        return ""
    return _TOKS[i] if i < len(_TOKS) else _TOKS[-1]


# lista de (url, headers) — um por app que o worker atende
BACKENDS = [(u, {"x-worker-token": _token(i)}) for i, u in enumerate(_URLS)]
POLL_SEG = 5          # de quanto em quanto tempo pergunta se tem job
ESPERA_ERRO = 15      # se a web estiver fora, espera mais antes de tentar de novo

# ffprobe/ffmpeg (duração + miniatura) — mesmo caminho da fábrica, com fallback
_FF = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFPROBE = os.path.join(_FF, "ffprobe.exe")
FFMPEG = os.path.join(_FF, "ffmpeg.exe")
if not os.path.exists(FFPROBE):
    FFPROBE = "ffprobe"
if not os.path.exists(FFMPEG):
    FFMPEG = "ffmpeg"


def log(msg):
    print(msg, flush=True)


def gerar_thumb(video_path, thumb_path):
    """1º frame do vídeo como imagem pequena (prévia)."""
    try:
        subprocess.run(
            [FFMPEG, "-y", "-ss", "0.5", "-i", video_path, "-frames:v", "1",
             "-vf", "scale=360:-2", thumb_path],
            capture_output=True, timeout=60,
        )
        return os.path.exists(thumb_path)
    except Exception:
        return False


def ler_legenda(txt_path):
    """Lê o .txt da fábrica e separa DESCRIÇÃO (legenda) e HASHTAGS."""
    legenda, hashtags = "", ""
    try:
        with open(txt_path, encoding="utf-8") as f:
            t = f.read()
        if "--- DESCRIÇÃO ---" in t:
            resto = t.split("--- DESCRIÇÃO ---", 1)[1]
            if "--- HASHTAGS ---" in resto:
                legenda, hashtags = resto.split("--- HASHTAGS ---", 1)
            else:
                legenda = resto
        legenda, hashtags = legenda.strip(), hashtags.strip()
    except Exception:
        pass
    return legenda, hashtags


def duracao(path):
    try:
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True,
        )
        return int(round(float(out.stdout.strip())))
    except Exception:
        return 0


def dimensoes(path):
    """(largura, altura) do vídeo, ou None se não der."""
    try:
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path],
            capture_output=True, text=True,
        )
        w, h = out.stdout.strip().split("x")
        return int(w), int(h)
    except Exception:
        return None


def carimbar_direto(nome):
    """Job 'só marca' (Em lote): pega o(s) vídeo(s) de entrada e SÓ carimba o
    template por cima — SEM fábrica (sem música de fundo, sem legenda, sem copy).
    Mantém o áudio original do vídeo. Saída em yuv420p (abre em todo player).
    Retorna a lista de saídas geradas (em DIR_SAIDA)."""
    prod_dir = os.path.join(DIR_PRODUTOS, nome)
    vids = sorted(glob.glob(os.path.join(prod_dir, "videos", "*")))
    tdir = os.path.join(prod_dir, "template")
    imgs = ([f for f in sorted(os.listdir(tdir))
             if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
            if os.path.isdir(tdir) else [])
    if not vids or not imgs:
        return []
    template = os.path.join(tdir, imgs[0])

    saidas = []
    for i, v in enumerate(vids):
        out = os.path.join(DIR_SAIDA, f"{nome}.mp4" if i == 0 else f"{nome}-{i + 1}.mp4")
        dim = dimensoes(v)
        if not dim:
            log(f"   ! sem dimensões de {os.path.basename(v)} — pulei")
            continue
        # SAÍDA 9:16 (1080x1920, formato TikTok/celular) SEMPRE: reenquadra o
        # vídeo (fundo desfocado + vídeo centralizado) e carimba a moldura por cima.
        # format=yuv420p é OBRIGATÓRIO: o PNG (rgba) faria o x264 sair em yuv444p
        # (High 4:4:4), que o player do Windows/celular não abre (0x80004005).
        filtro = (
            "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,scale=216:384,gblur=sigma=10,scale=1080:1920[bg];"
            "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2[base];"
            "[1:v]scale=1080:1920[ov];"
            "[base][ov]overlay=0:0:format=auto,format=yuv420p[v]"
        )
        r = subprocess.run(
            [FFMPEG, "-y", "-i", v, "-i", template,
             "-filter_complex", filtro, "-map", "[v]", "-map", "0:a?",
             "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
             "-crf", "20", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out],
            capture_output=True, text=True, errors="replace",
        )
        if r.returncode == 0 and os.path.exists(out) and os.path.getsize(out) > 0:
            saidas.append(out)
            log(f"   ✓ marca carimbada em {os.path.basename(out)}")
        else:
            log(f"   ! falhou carimbar {os.path.basename(v)}: {(r.stderr or '')[-200:]}")
    return saidas


def baixar_arquivo(base, headers, job_id, sub, nome, destino):
    url = f"{base}/api/worker/entrada/{job_id}/{sub}/{nome}"
    r = requests.get(url, headers=headers, stream=True, timeout=120)
    r.raise_for_status()
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "wb") as f:
        for chunk in r.iter_content(chunk_size=1 << 16):
            if chunk:
                f.write(chunk)


def montar_pasta(base, headers, job):
    """Cria produtos/job_<id>/ com a mídia + config.txt + descricao.txt."""
    job_id = job["id"]
    nome = f"job_{job_id}"
    prod_dir = os.path.join(DIR_PRODUTOS, nome)
    if os.path.exists(prod_dir):
        shutil.rmtree(prod_dir, ignore_errors=True)
    os.makedirs(prod_dir, exist_ok=True)

    arquivos = job.get("arquivos", {})
    for sub in ("videos", "imagens"):
        for fname in arquivos.get(sub, []):
            log(f"   baixando {sub}/{fname}")
            baixar_arquivo(base, headers, job_id, sub, fname, os.path.join(prod_dir, sub, fname))

    # template (logo/@) opcional — vai pra produtos/job_<id>/template/
    for fname in arquivos.get("template", []):
        log(f"   baixando template/{fname}")
        baixar_arquivo(base, headers, job_id, "template", fname, os.path.join(prod_dir, "template", fname))

    # música: o usuário pode mandar a dele. A fábrica lê de entrada/musicas/ (biblioteca
    # global), então copiamos a música pra lá com o nome do job e apontamos no config.
    cfg_musica = ""
    musicas = arquivos.get("musica", [])
    if musicas:
        os.makedirs(DIR_MUSICAS, exist_ok=True)
        fname = musicas[0]
        ext = os.path.splitext(fname)[1] or ".mp3"
        destino = os.path.join(DIR_MUSICAS, f"job_{job_id}{ext}")
        log(f"   baixando musica/{fname}")
        baixar_arquivo(base, headers, job_id, "musica", fname, destino)
        cfg_musica = f"job_{job_id}"

    with open(os.path.join(prod_dir, "descricao.txt"), "w", encoding="utf-8") as f:
        f.write(job.get("descricao", "") or "")

    linhas = [
        f"produto: {job.get('produto', nome)}",
        f"formato: {job.get('formato', 'legenda')}",
        f"tom: {job.get('tom', 'agressivo')}",
        f"variantes: {job.get('variantes', 1)}",
        f"preco: {job.get('preco', '')}",
        f"legenda_pos: {job.get('legenda_pos', 'baixo')}",
    ]
    voz_id = (job.get("voz_id") or "").strip()
    if voz_id:
        linhas.append(f"voz_id: {voz_id}")
    if cfg_musica:
        linhas.append(f"musica: {cfg_musica}")
    with open(os.path.join(prod_dir, "config.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")

    return nome


def rodar_fabrica(nome, eleven_key="", base="", token="", job_id=""):
    """Roda a fábrica só pra esse produto. Retorna (saidas, log).
    eleven_key = chave ElevenLabs do usuário (BYO); vai por env (NÃO em disco) só
    pra este processo, e a narração usa a conta dele.
    base/token/job_id = contexto da web pra fábrica reportar a fase do render."""
    log(f"   rodando a fábrica ({nome})...")
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    if eleven_key:
        env["ELEVEN_USER_KEY"] = eleven_key
    if base and token and job_id:
        env["PROGRESSO_BASE"] = base
        env["PROGRESSO_TOKEN"] = token
        env["PROGRESSO_JOB_ID"] = job_id
    r = subprocess.run(
        [sys.executable, "fabrica.py", nome, "--tudo"],
        cwd=BASE, capture_output=True, text=True, errors="replace",
        env=env,
    )
    saida_log = (r.stdout or "") + "\n" + (r.stderr or "")
    saidas = sorted(glob.glob(os.path.join(DIR_SAIDA, f"{nome}*.mp4")))
    return saidas, saida_log.strip()


def _ler_consumo(nome):
    """Lê o consumo.json que a fábrica gravou (tokens Gemini + chars ElevenLabs).
    Vazio = sem uso de API (a web cobra o preço fixo de processamento)."""
    p = os.path.join(DIR_PRODUTOS, nome, "consumo.json")
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


import re as _re
import threading as _threading
from concurrent.futures import ThreadPoolExecutor as _Pool

# casa exatamente <nome>_01.mp4 (ignora _leg.mp4 e .part.mp4)
def _padrao_corte(nome):
    return _re.compile(_re.escape(nome) + r"_\d+\.mp4$")


def rodar_cortes(base, headers, job, nome):
    """Job "Cortes de qualquer vídeo": roda o cortar_youtube em PARALELO e SOBE
    cada corte assim que o .mp4 fica pronto (legenda + thumb + upload incremental,
    com semáforo). No fim, finaliza o job. Retorna (n_subidos, motivo_erro)."""
    import json as _json
    link = (job.get("fonte") or "").strip()
    if not link:
        return 0, "Job de cortes sem link."
    try:
        opc = _json.loads(job.get("opcoes") or "{}")
    except Exception:
        opc = {}
    maxc = str(int(opc.get("max", 8) or 8))
    dur_alvo = str(int(opc.get("dur", 0) or 0))   # duração-alvo por corte (s); 0=livre
    quer_leg = bool(opc.get("legenda"))
    pos = opc.get("pos", "baixo")
    cor = opc.get("cor", "amarelo")
    job_id = job["id"]
    rx = _padrao_corte(nome)

    # limpa restos de uma rodada anterior com o mesmo prefixo
    for old in glob.glob(os.path.join(DIR_SAIDA, f"{nome}_*")):
        try:
            os.remove(old)
        except OSError:
            pass

    log(f"   cortando do link: {link}" + (f" (cortes de ~{dur_alvo}s)" if dur_alvo != "0" else ""))
    # nota: o Drive agora é feito AQUI (drive_subir por corte), não no cortar_youtube
    proc = subprocess.Popen(
        [sys.executable, "cortar_youtube.py", link, "--outdir", DIR_SAIDA,
         "--prefix", nome, "--max", maxc, "--dur", dur_alvo, "--lang", "pt",
         "--workers", "2"],
        cwd=BASE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, errors="replace", bufsize=1,
        env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"},
    )

    # ecoa a saída do cortar_youtube no log (pra ver download/transcrição/%)
    def _echo():
        for linha in proc.stdout:
            log("   " + linha.rstrip())
    t_echo = _threading.Thread(target=_echo, daemon=True)
    t_echo.start()

    vistos = set()
    contador = {"n": 0}
    # legenda roda em paralelo; o UPLOAD é serial (o servidor acumula o JSON de
    # saídas e não é seguro 2 requests gravarem ao mesmo tempo).
    upload_lock = _threading.Lock()
    erros = []

    def _processa_corte(mp4):
        try:
            # legenda palavra-por-palavra (se pedido) — troca pelo legendado
            if quer_leg:
                tmp = os.path.splitext(mp4)[0] + "_leg.mp4"
                subprocess.run(
                    [sys.executable, "legendar_video.py", mp4, "--out", tmp,
                     "--pos", pos, "--cor", cor, "--lang", "pt"],
                    cwd=BASE, capture_output=True, text=True, errors="replace",
                )
                if os.path.exists(tmp) and os.path.getsize(tmp) > 0:
                    os.replace(tmp, mp4)
            leg, tags = ler_legenda(os.path.splitext(mp4)[0] + ".txt")
            dur = duracao(mp4)
            # TUDO vai pro Drive — a web serve de lá (sobrevive a redeploy + thumb).
            drive_id = drive_subir(mp4, f"Cortes YouTube/{nome}")
            # frame real (JPG) -> Drive: capa instantânea e confiável
            thumb = os.path.splitext(mp4)[0] + ".thumb.jpg"
            thumb_drive = None
            if gerar_thumb(mp4, thumb):
                if drive_id:
                    thumb_drive = drive_subir(thumb, f"Cortes YouTube/{nome}")
            else:
                thumb = None
            thumb_local = thumb if (not drive_id and thumb) else None
            with upload_lock:  # serializa o upload (evita corrida no banco)
                parte = contador["n"]
                contador["n"] += 1
                concluir_parte(base, headers, job_id, parte, mp4, dur, leg, tags,
                               thumb_local, drive_id, thumb_drive)
            log(f"   ✓ corte {parte + 1} no ar" + (" [Drive]" if drive_id else " [local]"))
        except Exception as e:
            erros.append(str(e))
            log(f"   ! falha ao subir um corte: {e}")

    # semáforo do pipeline (legenda+upload) — 2 cortes por vez
    with _Pool(max_workers=2) as ex:
        while True:
            for p in sorted(glob.glob(os.path.join(DIR_SAIDA, f"{nome}_*.mp4"))):
                if p in vistos or not rx.search(os.path.basename(p)):
                    continue
                vistos.add(p)
                ex.submit(_processa_corte, p)
            if proc.poll() is not None:
                # processo acabou — varre o que sobrou e encerra
                for p in sorted(glob.glob(os.path.join(DIR_SAIDA, f"{nome}_*.mp4"))):
                    if p in vistos or not rx.search(os.path.basename(p)):
                        continue
                    vistos.add(p)
                    ex.submit(_processa_corte, p)
                break
            time.sleep(2)
        # __exit__ do pool espera os uploads em andamento terminarem
    t_echo.join(timeout=5)

    n = contador["n"]
    if n == 0:
        return 0, "Não gerou nenhum corte (veja o log acima)."
    concluir_finalizar(base, headers, job_id, 0)
    return n, ""


def concluir(base, headers, job_id, saidas, consumo=None):
    """Sobe os vídeos prontos + miniatura + legenda/hashtags de cada variante.
    Com RETRY: se o servidor der um 502/timeout passageiro, tenta de novo."""
    dur = duracao(saidas[0]) if saidas else 0

    # prepara legendas (do .txt da fábrica) e miniaturas de cada variante
    legendas = []
    thumbs = {}  # índice -> caminho do thumb
    for i, p in enumerate(saidas):
        leg, tags = ler_legenda(os.path.splitext(p)[0] + ".txt")
        legendas.append({"legenda": leg, "hashtags": tags})
        tp = os.path.splitext(p)[0] + ".thumb.jpg"
        if gerar_thumb(p, tp):
            thumbs[i] = tp

    tentativas = 5
    for t in range(1, tentativas + 1):
        abertos = []
        try:
            files = []
            for i, p in enumerate(saidas):
                fh = open(p, "rb")
                abertos.append(fh)
                nome = "video.mp4" if i == 0 else f"video-{i + 1}.mp4"
                files.append(("videos", (nome, fh, "video/mp4")))
                if i in thumbs:
                    ft = open(thumbs[i], "rb")
                    abertos.append(ft)
                    files.append((f"thumb_{i}", (f"thumb-{i}.jpg", ft, "image/jpeg")))
            r = requests.post(
                f"{base}/api/worker/concluir/{job_id}",
                headers=headers, files=files,
                data={"duracao": str(dur),
                      "legendas": json.dumps(legendas, ensure_ascii=False),
                      **({"consumo": json.dumps(consumo)} if consumo else {})},
                timeout=600,
            )
            r.raise_for_status()
            return  # sucesso
        except requests.RequestException as e:
            if t >= tentativas:
                raise  # esgotou -> deixa o processar() marcar erro
            espera = 10 * t
            log(f"   upload falhou ({e}) — tentativa {t}/{tentativas}, de novo em {espera}s")
            time.sleep(espera)
        finally:
            for fh in abertos:
                fh.close()


def drive_subir(mp4, subpasta):
    """Sobe o mp4 pro Drive em 'Acervo Viraliza/<subpasta>/' e devolve o ID do
    arquivo no Drive (ou None se falhar). A web serve direto do Drive."""
    nome = os.path.basename(mp4)
    destino_dir = f"{DRIVE_BASE}/{subpasta}"
    destino = f"{destino_dir}/{nome}"
    try:
        r = subprocess.run(
            [RCLONE, "copyto", mp4, destino],
            capture_output=True, text=True, errors="replace", timeout=600,
        )
        if r.returncode != 0:
            log(f"   ! rclone falhou: {(r.stderr or '')[:140]}")
            return None
        r2 = subprocess.run(
            [RCLONE, "lsjson", destino_dir],
            capture_output=True, text=True, errors="replace", timeout=120,
        )
        if r2.returncode == 0:
            for item in json.loads(r2.stdout or "[]"):
                if item.get("Name") == nome:
                    return item.get("ID")
    except Exception as e:
        log(f"   ! erro subindo pro Drive: {e}")
    return None


def concluir_parte(base, headers, job_id, parte, mp4, dur, leg, tags, thumb,
                   drive_id=None, thumb_drive_id=None):
    """Sobe UM corte (incremental). Se tiver drive_id, manda SÓ os metadados
    (o vídeo já está no Drive — a web serve de lá); senão manda os bytes.
    thumb_drive_id = ID do JPG da miniatura no Drive (capa real, instantânea)."""
    url = f"{base}/api/worker/concluir/{job_id}"
    for t in range(1, 6):
        abertos = []
        try:
            data = {"parte": str(parte), "duracao": str(dur or 0),
                    "legenda": leg or "", "hashtags": tags or ""}
            if thumb_drive_id:
                data["thumbDriveId"] = thumb_drive_id
            files = []
            if drive_id:
                data["driveId"] = drive_id
            else:
                fh = open(mp4, "rb"); abertos.append(fh)
                files.append(("video", (os.path.basename(mp4), fh, "video/mp4")))
                if thumb and os.path.exists(thumb):
                    ft = open(thumb, "rb"); abertos.append(ft)
                    files.append(("thumb", ("thumb.jpg", ft, "image/jpeg")))
            r = requests.post(
                url, headers=headers, files=files or None, data=data, timeout=600,
            )
            r.raise_for_status()
            return
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else 0
            if code and code < 500:
                raise  # erro definitivo (ex: app antigo sem modo incremental)
            if t >= 5:
                raise
            time.sleep(8 * t)
        except requests.RequestException:
            if t >= 5:
                raise
            time.sleep(8 * t)
        finally:
            for fh in abertos:
                fh.close()


def concluir_drive(base, headers, job_id, saidas, subpasta, consumo=None):
    """Sobe CADA saída pro Drive e registra incremental (a web serve do Drive).
    Se o backend não suportar incremental (app antigo), cai pro upload batch."""
    if not saidas:
        return
    dur = duracao(saidas[0])
    try:
        for parte, p in enumerate(saidas):
            leg, tags = ler_legenda(os.path.splitext(p)[0] + ".txt")
            drive_id = drive_subir(p, subpasta)
            # frame real (JPG) -> Drive: capa instantânea e confiável
            thumb = os.path.splitext(p)[0] + ".thumb.jpg"
            thumb_drive = None
            if gerar_thumb(p, thumb):
                if drive_id:
                    thumb_drive = drive_subir(thumb, subpasta)
            else:
                thumb = None
            thumb_local = thumb if (not drive_id and thumb) else None
            concluir_parte(base, headers, job_id, parte, p, duracao(p),
                           leg, tags, thumb_local, drive_id, thumb_drive)
            log(f"   ✓ vídeo {parte + 1}/{len(saidas)} no ar"
                + (" [Drive]" if drive_id else " [local]"))
        concluir_finalizar(base, headers, job_id, dur, consumo)
    except requests.RequestException as e:
        log(f"   incremental indisponível ({str(e)[:80]}); usando upload batch.")
        concluir(base, headers, job_id, saidas, consumo)


def concluir_finalizar(base, headers, job_id, dur, consumo=None):
    """Fecha o job depois do streaming das partes (marca 'pronto').
    Manda o consumo de APIs (se houver) pra web debitar pelo custo real."""
    url = f"{base}/api/worker/concluir/{job_id}"
    for t in range(1, 6):
        try:
            data = {"finalizar": "1", "duracao": str(dur or 0)}
            if consumo:
                data["consumo"] = json.dumps(consumo)
            r = requests.post(url, headers=headers, data=data, timeout=60)
            r.raise_for_status()
            return
        except requests.RequestException as e:
            if t >= 5:
                raise
            time.sleep(8 * t)


def reportar_erro(base, headers, job_id, msg):
    try:
        requests.post(
            f"{base}/api/worker/erro/{job_id}",
            headers=headers, json={"erro": msg[-500:]}, timeout=30,
        )
    except Exception as e:
        log(f"   (não consegui reportar o erro: {e})")


def reportar_progresso(base, headers, job_id, etapa):
    """Avisa a web a FASE atual do render (aparece no card 'Renderizando')."""
    try:
        requests.post(
            f"{base}/api/worker/progresso/{job_id}",
            headers=headers, json={"etapa": etapa}, timeout=15,
        )
    except Exception:
        pass  # progresso é cosmético; nunca atrapalha o render


def limpar(nome, job_id, saidas):
    shutil.rmtree(os.path.join(DIR_PRODUTOS, nome), ignore_errors=True)
    for p in saidas:
        base = os.path.splitext(p)[0]
        for q in (p, base + ".txt", base + ".thumb.jpg"):
            try:
                os.remove(q)
            except OSError:
                pass
    for m in glob.glob(os.path.join(DIR_MUSICAS, f"job_{job_id}.*")):
        try:
            os.remove(m)
        except OSError:
            pass


def processar(base, headers, job):
    job_id = job["id"]
    nome = f"job_{job_id}"
    saidas = []
    try:
        log(f"\n>> job {job_id} — {job.get('produto', '')}  [{base}]")
        reportar_progresso(base, headers, job_id, "Preparando seus arquivos")
        nome = montar_pasta(base, headers, job)
        if job.get("tipo") == "cortes":
            # "Cortes de qualquer vídeo": roda em paralelo e sobe cada corte
            # assim que fica pronto (streaming). Faz o upload + finaliza internamente.
            log("   modo cortes (link de vídeo) — paralelo + streaming")
            n, motivo = rodar_cortes(base, headers, job, nome)
            if not n:
                log("   ✗ não gerou vídeo")
                reportar_erro(base, headers, job_id, motivo or "Não gerou vídeo.")
                return
            log(f"   ✓ {n} corte(s) no ar (streaming)")
            saidas = sorted(glob.glob(os.path.join(DIR_SAIDA, f"{nome}_*.mp4")))
            limpar(nome, job_id, saidas)
            return
        elif job.get("arquivos", {}).get("template"):
            # "Em lote": só carimba a marca no vídeo original — sem fábrica,
            # sem música de fundo, sem legenda automática.
            log("   modo marca (Em lote) — só carimbo, sem fábrica/música/legenda")
            saidas = carimbar_direto(nome)
            motivo = "Não consegui carimbar a marca (vídeo inválido?)."
        else:
            reportar_progresso(base, headers, job_id, "Montando o vídeo")
            token = headers.get("x-worker-token", "")
            saidas, motivo = rodar_fabrica(
                nome, job.get("eleven_key", ""), base, token, job_id)
        if not saidas:
            log("   ✗ não gerou vídeo")
            reportar_erro(base, headers, job_id, motivo or "Não gerou vídeo.")
            return
        log(f"   ✓ {len(saidas)} vídeo(s) — subindo pro Drive...")
        reportar_progresso(base, headers, job_id, "Subindo o vídeo")
        consumo = _ler_consumo(nome)
        concluir_drive(base, headers, job_id, saidas, f"Gerados/{nome}", consumo)
        log("   ✓ pronto e disponível na web!")
        limpar(nome, job_id, saidas)
    except Exception as e:
        log(f"   ✗ erro: {e}")
        reportar_erro(base, headers, job_id, str(e))
        limpar(nome, job_id, saidas)


def pegar_proximo(base, headers):
    r = requests.get(f"{base}/api/worker/proximo", headers=headers, timeout=30)
    r.raise_for_status()
    return r.json().get("job")


def main():
    if not BACKENDS or not any(h.get("x-worker-token") for _, h in BACKENDS):
        log("Faltou WEB_URL/WORKER_TOKEN no .env da raiz (o mesmo do app/.env)."); return
    os.makedirs(DIR_PRODUTOS, exist_ok=True)
    os.makedirs(DIR_SAIDA, exist_ok=True)
    log("Worker ligado. Atendendo:")
    for u, _ in BACKENDS:
        log(f"  - {u}")
    log("Esperando vídeos na fila... (Ctrl+C pra sair)\n")
    ocioso = False
    while True:
        try:
            achou_algum = False
            for base, headers in BACKENDS:
                try:
                    job = pegar_proximo(base, headers)
                except requests.RequestException as e:
                    log(f"web indisponível ({base}: {e})")
                    continue
                if job:
                    ocioso = False
                    achou_algum = True
                    processar(base, headers, job)
            if not achou_algum:
                if not ocioso:
                    log("(fila vazia em todos — aguardando)")
                    ocioso = True
                time.sleep(POLL_SEG)
        except KeyboardInterrupt:
            log("\nWorker encerrado."); break
        except Exception as e:
            log(f"erro inesperado ({e}). De novo em {ESPERA_ERRO}s...")
            time.sleep(ESPERA_ERRO)


if __name__ == "__main__":
    main()
