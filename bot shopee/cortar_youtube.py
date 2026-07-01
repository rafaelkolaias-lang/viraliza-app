# -*- coding: utf-8 -*-
"""
CORTADOR DE YOUTUBE -> CLIPES VIRAIS (uso local / worker).
Cola um link do YouTube e ele:
  1. baixa o vídeo (yt-dlp)
  2. transcreve com timestamps (faster-whisper)
  3. a IA (Gemini) escolhe os trechos mais interessantes (<= 2 min cada)
  4. corta cada trecho e reenquadra pra 9:16 (fundo desfocado + vídeo centralizado)
  5. gera um .srt por corte (legenda à parte, não queimada)

Saída: D:\\VideosIA\\cortes_youtube\\<titulo>\\corte_01.mp4 + corte_01.srt

Uso:
  python cortar_youtube.py "https://youtu.be/XXXX"
  python cortar_youtube.py "<url>" --model medium --max 8
"""
import os
import sys
import re
import json
import itertools
import argparse
import subprocess

from dotenv import load_dotenv

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

load_dotenv()

# ---- Gemini (mesmo padrão do gemini_copy.py: SDK google.genai + rodízio de chaves) ----
from google import genai
from google.genai import types

_KEYS = [k for k in (os.getenv("GEMINI_API_KEY"),
                     os.getenv("GEMINI_API_KEY_2"),
                     os.getenv("GEMINI_API_KEY_3")) if k]
_ciclo = itertools.cycle(_KEYS) if _KEYS else None
MODELO = "gemini-2.5-flash"

# ---- ffmpeg/ffprobe (mesmo caminho dos outros scripts, com fallback) ----
_FF = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFMPEG = os.path.join(_FF, "ffmpeg.exe")
FFPROBE = os.path.join(_FF, "ffprobe.exe")
if not os.path.exists(FFMPEG):
    FFMPEG = "ffmpeg"
if not os.path.exists(FFPROBE):
    FFPROBE = "ffprobe"

RCLONE = r"C:\Users\lucas\rclone\rclone.exe"
if not os.path.exists(RCLONE):
    RCLONE = "rclone"

BASE = os.path.dirname(os.path.abspath(__file__))
SAIDA_BASE = os.path.abspath(os.path.join(BASE, "..", "cortes_youtube"))


def log(m):
    print(m, flush=True)


def subir_drive(feitos, titulo, drive_base):
    """Copia os cortes pro Drive numa subpasta com o nome do vídeo, renomeando
    pra corte_NN.mp4/.srt (limpo). `feitos` = [(i, caminho_mp4, caminho_srt)]."""
    sub = nome_seguro(titulo)
    destino = f"{drive_base.rstrip('/')}/{sub}"
    log(f"→ enviando {len(feitos)} corte(s) pro Drive ({sub})...")
    enviados = 0
    for i, mp4, srt in feitos:
        r = subprocess.run([RCLONE, "copyto", mp4, f"{destino}/corte_{i:02d}.mp4"],
                           capture_output=True, text=True)
        if r.returncode == 0:
            enviados += 1
            if srt and os.path.exists(srt):
                subprocess.run([RCLONE, "copyto", srt, f"{destino}/corte_{i:02d}.srt"],
                               capture_output=True, text=True)
        else:
            log(f"  ! falhou subir corte_{i:02d}: {(r.stderr or '')[:120]}")
    log(f"  {enviados}/{len(feitos)} no Drive: {destino}")


def nome_seguro(s):
    s = (s or "video").strip()
    for ch in '<>:"/\\|?*\n\r\t':
        s = s.replace(ch, "_")
    s = re.sub(r"\s+", " ", s)
    return s[:80] or "video"


# ---------- 1. download ----------
def baixar(url, work):
    import yt_dlp
    os.makedirs(work, exist_ok=True)
    opts = {
        "format": "bv*[height<=1080]+ba/b[height<=1080]/b",
        "outtmpl": os.path.join(work, "fonte.%(ext)s"),
        "merge_output_format": "mp4",
        "quiet": True,
        "noprogress": True,
        "noplaylist": True,
    }
    log("→ baixando do YouTube...")
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
    titulo = info.get("title") or "video"
    # acha o arquivo de vídeo gerado
    cand = [os.path.join(work, f) for f in os.listdir(work)
            if f.startswith("fonte.") and f.rsplit(".", 1)[-1].lower() in ("mp4", "mkv", "webm")]
    if not cand:
        raise RuntimeError("Não encontrei o vídeo baixado.")
    return cand[0], titulo


def duracao(path):
    try:
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True,
        )
        return float(out.stdout.strip())
    except Exception:
        return 0.0


# ---------- 2. transcrição ----------
# Const-me/Whisper: roda na GPU (Direct3D 11) — inclusive AMD (RX 580). Se o
# binário + um modelo ggml existirem, usamos a GPU; senão cai pro faster-whisper (CPU).
TOOLS_WCLI = os.path.abspath(os.path.join(BASE, "..", "tools", "whisper-cli"))
WHISPER_CLI = os.path.join(TOOLS_WCLI, "main.exe")


def _modelo_ggml():
    import glob
    if not os.path.isdir(TOOLS_WCLI):
        return None
    for n in ("ggml-medium.bin", "ggml-small.bin", "ggml-base.bin"):
        p = os.path.join(TOOLS_WCLI, n)
        if os.path.exists(p):
            return p
    c = glob.glob(os.path.join(TOOLS_WCLI, "ggml-*.bin"))
    return c[0] if c else None


def _parse_srt(path):
    import re as _re
    segs = []
    with open(path, encoding="utf-8", errors="replace") as f:
        conteudo = f.read()
    for b in _re.split(r"\n\s*\n", conteudo):
        m = _re.search(
            r"(\d\d):(\d\d):(\d\d)[,.](\d+)\s*-->\s*(\d\d):(\d\d):(\d\d)[,.](\d+)", b)
        if not m:
            continue
        a = int(m[1]) * 3600 + int(m[2]) * 60 + int(m[3]) + int(m[4]) / 1000
        c = int(m[5]) * 3600 + int(m[6]) * 60 + int(m[7]) + int(m[8]) / 1000
        linhas = b.splitlines()
        idx = next((i for i, x in enumerate(linhas) if "-->" in x), -1)
        txt = " ".join(x.strip() for x in linhas[idx + 1:] if x.strip())
        if txt and c > a:
            segs.append({"start": a, "end": c, "text": txt})
    return segs


def transcrever_gpu(wav, lang):
    modelo = _modelo_ggml()
    if not (os.path.exists(WHISPER_CLI) and modelo):
        return None
    log(f"→ transcrevendo na GPU (Const-me/D3D11 · {os.path.basename(modelo)} · {lang})...")
    cands = [wav + ".srt", os.path.splitext(wav)[0] + ".srt"]
    for c in cands:
        try:
            os.remove(c)
        except OSError:
            pass
    try:
        proc = subprocess.Popen(
            [WHISPER_CLI, "-gpu", "0", "-m", modelo, "-f", wav, "-l", lang, "-osrt"],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            text=True, errors="replace", bufsize=1,
        )
        # mostra o progresso do Const-me ao vivo (linha que se atualiza)
        ultimo = -1
        for linha in proc.stderr:
            m = re.search(r"progress\s*=\s*(\d+)\s*%", linha)
            if m:
                pct = int(m.group(1))
                if pct != ultimo:
                    print(f"\r  transcrevendo na GPU... {pct}%   ", end="", flush=True)
                    ultimo = pct
        proc.wait(timeout=3600)
        if ultimo >= 0:
            print()  # quebra a linha do progresso
    except Exception as e:
        try:
            proc.kill()
        except Exception:
            pass
        log(f"  (GPU falhou: {e} — caindo pro CPU)")
        return None
    srt = next((c for c in cands if os.path.exists(c)), None)
    if not srt:
        log("  (GPU não gerou legenda — caindo pro CPU)")
        return None
    segs = _parse_srt(srt)
    try:
        os.remove(srt)
    except OSError:
        pass
    if segs:
        log(f"  GPU OK · {len(segs)} segmentos")
    return segs or None


def transcrever_cpu(wav, modelo, lang):
    from faster_whisper import WhisperModel
    nth = os.cpu_count() or 8
    log(f"→ transcrevendo no CPU (faster-whisper {modelo} · {nth} threads)...")
    wm = WhisperModel(modelo, device="cpu", compute_type="int8", cpu_threads=nth)
    idioma = None if lang in ("auto", "", None) else lang
    segs, info = wm.transcribe(wav, vad_filter=True, language=idioma)
    out = []
    for s in segs:
        txt = (s.text or "").strip()
        if txt:
            out.append({"start": float(s.start), "end": float(s.end), "text": txt})
    log(f"  CPU OK · idioma {info.language} · {len(out)} segmentos")
    return out


def transcrever(video, modelo, lang):
    """Extrai o áudio e transcreve. Tenta a GPU (Const-me); se não der, CPU."""
    wav = os.path.splitext(video)[0] + ".wav"
    log("→ extraindo áudio...")
    subprocess.run(
        [FFMPEG, "-y", "-i", video, "-ac", "1", "-ar", "16000", "-vn", wav],
        capture_output=True,
    )
    segs = transcrever_gpu(wav, lang)
    if not segs:
        segs = transcrever_cpu(wav, modelo, lang)
    try:
        os.remove(wav)
    except OSError:
        pass
    return segs


# ---------- 3. escolher cortes (Gemini) ----------
SISTEMA_CORTES = """Você é um editor de cortes virais para TikTok/Reels/Shorts.
Recebe a transcrição de um vídeo com tempos (em segundos) e escolhe trechos para
virarem clipes. O MAIS IMPORTANTE: cada clipe tem que ser uma HISTÓRIA COMPLETA.

O QUE É UM BOM CORTE (siga à risca):
- AUTOSSUFICIENTE: quem assiste SÓ o clipe entende o assunto do início ao fim,
  sem precisar do resto do vídeo. Nada de começar no meio de uma explicação nem
  terminar antes de o fato/ideia ser concluído.
- ESTRUTURA: começa com um GANCHO (uma frase/momento que prende nos primeiros
  segundos — pergunta, dado surpreendente, afirmação forte), DESENVOLVE o assunto
  com o contexto necessário e FECHA com a conclusão/desfecho. Hook → história → fim.
- COMPLETO: inclua a fala ANTES (a montagem/contexto) E a fala DEPOIS (o desfecho/
  resposta). Se o trecho responde uma pergunta, inclua a pergunta E a resposta inteira.
- Começa e termina em FRONTEIRA DE FRASE (nunca no meio de uma sentença).

REGRAS:
- Cada clipe: MÍNIMO ~20s, MÁXIMO 120s. Prefira 30–90s — tempo pra contar a história.
- Qualidade > quantidade: poucos cortes REDONDOS valem mais que muitos pela metade.
  Se o vídeo só tiver 2 ou 3 momentos realmente completos, devolva só esses.
- Não pegue vinheta, enrolação, repetição ou trecho solto sem desfecho.
- TÍTULO curto e chamativo (estilo TikTok), prometendo a história que o clipe entrega.
- Use os tempos exatos da transcrição pro início e fim.
- Responda SOMENTE com JSON válido: {"cortes":[{"inicio":<seg>,"fim":<seg>,"titulo":"..."}]}"""


def escolher_cortes(segmentos, dur, maximo, alvo=0):
    """alvo = duração desejada por corte em segundos (0 = livre, 20–120)."""
    if not _ciclo:
        raise RuntimeError("Faltam as chaves GEMINI_API_KEY no .env da raiz.")
    linhas = [f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}" for s in segmentos]
    transcricao = "\n".join(linhas)[:120000]  # cabe no contexto
    if alvo and alvo > 0:
        mn = max(10, int(alvo * 0.6))
        regra_dur = (
            f"Cada corte deve ter PERTO DE {alvo}s (entre {mn}s e {alvo}s). "
            f"Termine sempre em fim de frase, sem passar de {alvo}s."
        )
    else:
        regra_dur = "Cada um entre 20s e 120s. Prefira 30–90s."
    prompt = (
        f"Duração total do vídeo: {dur:.0f}s.\n"
        f"Devolva no MÁXIMO {maximo} cortes — mas só os que forem HISTÓRIA COMPLETA "
        f"(gancho no começo, desenvolve, fecha o fato). {regra_dur}\n"
        f"Se tiver menos momentos redondos que isso, devolva menos. Qualidade > quantidade.\n\n"
        f"TRANSCRIÇÃO COM TEMPOS:\n{transcricao}"
    )
    erros = []
    cortes = None
    for _ in range(len(_KEYS)):
        key = next(_ciclo)
        try:
            client = genai.Client(api_key=key)
            resp = client.models.generate_content(
                model=MODELO,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SISTEMA_CORTES,
                    response_mime_type="application/json",
                    temperature=0.4,
                    max_output_tokens=8192,
                    # 2.5-flash liga "thinking" por padrão e isso come o orçamento
                    # de tokens -> volta JSON vazio/truncado. Desligamos.
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
            texto = (resp.text or "").strip()
            if not texto:
                # diagnostico: por que veio vazio (MAX_TOKENS? SAFETY?)
                motivo = ""
                try:
                    motivo = str(resp.candidates[0].finish_reason)
                except Exception:
                    pass
                erros.append(f"resposta vazia (finish={motivo or '?'})")
                continue
            data = json.loads(texto)
            cortes = data.get("cortes", []) if isinstance(data, dict) else []
            break
        except Exception as e:
            erros.append(str(e)[:140])
            cortes = None
    if cortes is None:
        raise RuntimeError("Gemini falhou: " + " | ".join(erros))

    # sanea: clampa nos limites do vídeo e no teto escolhido, descarta inválidos
    teto = alvo if (alvo and alvo > 0) else 120
    minimo = max(8, int(teto * 0.5))   # corte curto não pode ser quase nada
    limpos = []
    for c in cortes:
        try:
            ini = max(0.0, float(c["inicio"]))
            fim = min(dur, float(c["fim"]))
        except (KeyError, ValueError, TypeError):
            continue
        if fim - ini < minimo:
            continue
        if fim - ini > teto:
            fim = ini + teto
        limpos.append({"inicio": ini, "fim": fim,
                       "titulo": (c.get("titulo") or "Corte").strip()[:80]})
    return limpos


def cortes_heuristicos(segmentos, maximo, alvo=75.0):
    """Plano B: se a IA não devolver nada, agrupa a transcrição em blocos de
    ~alvo segundos terminando em fim de frase. Não é tão esperto, mas entrega."""
    fim_frase = (".", "!", "?", "…")
    teto = max(alvo, 30.0)          # nunca deixa o bloco passar muito do alvo
    minimo = max(8.0, alvo * 0.5)
    blocos = []
    ini = None
    ult = None
    texto = ""
    for s in segmentos:
        if ini is None:
            ini = s["start"]
        ult = s["end"]
        texto = (texto + " " + s["text"]).strip()
        dur = ult - ini
        # fecha o bloco quando passou do alvo e a frase terminou (ou estourou o teto)
        if (dur >= alvo and texto.endswith(fim_frase)) or dur >= teto:
            if dur >= minimo:
                blocos.append({"inicio": ini, "fim": ult,
                               "titulo": texto[:60].strip() or "Corte"})
            ini = None
            texto = ""
    if ini is not None and ult is not None and (ult - ini) >= minimo:
        blocos.append({"inicio": ini, "fim": ult,
                       "titulo": texto[:60].strip() or "Corte"})
    return blocos[:maximo]


# ---------- 4. cortar + reenquadrar 9:16 ----------
# Codificador de vídeo: tenta a GPU AMD (h264_amf / VCE da RX 580) e cai pro CPU
# (libx264) se não rolar. _amf_ok é descoberto na 1ª vez e fica em cache.
_amf_ok = None


def _tem_amf():
    """A RX 580 tem encoder H.264 por hardware (AMF). Vê se o ffmpeg expõe."""
    try:
        r = subprocess.run([FFMPEG, "-hide_banner", "-encoders"],
                           capture_output=True, text=True, errors="replace")
        return "h264_amf" in (r.stdout or "")
    except Exception:
        return False


def _encoders_a_tentar():
    """Ordem de codificadores a tentar. GPU primeiro (se disponível), CPU de reserva."""
    global _amf_ok
    cpu = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "21"]
    if _amf_ok is False:
        return [("cpu", cpu)]
    if _amf_ok is None:
        _amf_ok = _tem_amf()
        if _amf_ok:
            log("  (codificando na GPU AMD · h264_amf)")
    if not _amf_ok:
        return [("cpu", cpu)]
    gpu = ["-c:v", "h264_amf", "-usage", "transcoding", "-quality", "quality",
           "-rc", "cqp", "-qp_i", "22", "-qp_p", "22", "-pix_fmt", "yuv420p"]
    return [("amf", gpu), ("cpu", cpu)]


def cortar_vertical(video, ini, fim, out):
    """Corta [ini,fim] e gera 1080x1920 (fundo desfocado + vídeo centralizado).
    Desfoque é feito numa miniatura (rápido) e o encode tenta a GPU AMD."""
    global _amf_ok
    dur = fim - ini
    # desfoca o fundo numa imagem PEQUENA e dá upscale — fica igual visualmente
    # mas é ~20x mais barato que boxblur em 1080x1920.
    filtro = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
        "crop=1080:1920,scale=216:384,gblur=sigma=10,scale=1080:1920[bg];"
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]"
    )
    # escreve num temp e renomeia no fim — quem observa a pasta só vê o arquivo
    # COMPLETO (essencial pro worker subir cada corte com segurança em paralelo).
    tmp = out + ".part.mp4"
    base = [FFMPEG, "-y", "-ss", f"{ini:.2f}", "-t", f"{dur:.2f}", "-i", video,
            "-filter_complex", filtro, "-map", "[v]", "-map", "0:a?"]
    cauda = ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", tmp]
    for tipo, venc in _encoders_a_tentar():
        try:
            os.remove(tmp)
        except OSError:
            pass
        r = subprocess.run(base + venc + cauda,
                           capture_output=True, text=True, errors="replace")
        if r.returncode == 0 and os.path.exists(tmp) and os.path.getsize(tmp) > 0:
            if tipo == "amf":
                _amf_ok = True
            os.replace(tmp, out)   # rename atômico
            return True
        if tipo == "amf":
            _amf_ok = False  # GPU falhou — desliga e usa CPU daqui pra frente
            log("  (GPU falhou no encode — caindo pro CPU)")
    try:
        os.remove(tmp)
    except OSError:
        pass
    return False


# ---------- 5. .srt por corte ----------
def t_srt(seg):
    if seg < 0:
        seg = 0
    h = int(seg // 3600); m = int((seg % 3600) // 60)
    s = int(seg % 60); ms = int(round((seg - int(seg)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def srt_do_corte(segmentos, ini, fim):
    linhas = []
    n = 0
    for s in segmentos:
        if s["end"] <= ini or s["start"] >= fim:
            continue
        a = max(s["start"], ini) - ini
        b = min(s["end"], fim) - ini
        if b - a < 0.1:
            continue
        n += 1
        linhas.append(f"{n}\n{t_srt(a)} --> {t_srt(b)}\n{s['text']}\n")
    return "\n".join(linhas)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", help="link do YouTube")
    ap.add_argument("--model", default="small", help="faster-whisper (fallback CPU): tiny/base/small/medium")
    ap.add_argument("--lang", default="pt", help="idioma do vídeo: pt, en, es... (GPU exige concreto)")
    ap.add_argument("--max", type=int, default=8, help="máx de cortes")
    ap.add_argument("--dur", type=int, default=0, help="duração-alvo de cada corte em segundos (ex: 30, 60, 90; 0=livre)")
    ap.add_argument("--workers", type=int, default=2, help="quantos cortes renderizar em paralelo (semáforo)")
    ap.add_argument("--outdir", default="", help="pasta de saída (padrão: cortes_youtube/<título>)")
    ap.add_argument("--prefix", default="corte", help="prefixo dos arquivos de saída")
    ap.add_argument("--drive", default="", help="remote do Drive (ex: 'gdrive:Acervo Viraliza/Cortes YouTube') — sobe os cortes")
    args = ap.parse_args()

    if not _KEYS:
        log("Faltam as chaves GEMINI_API_KEY no .env da raiz."); return

    # pasta de trabalho ÚNICA por job (evita colisão/.part travado entre runs)
    import shutil
    work = os.path.join(SAIDA_BASE, "_tmp", nome_seguro(args.prefix))
    shutil.rmtree(work, ignore_errors=True)
    video, titulo = baixar(args.url, work)
    dur = duracao(video)
    log(f"  título: {titulo} | duração: {dur:.0f}s")

    segmentos = transcrever(video, args.model, args.lang)
    if not segmentos:
        log("✗ não consegui transcrever (sem fala?)."); return

    alvo = args.dur if args.dur and args.dur > 0 else 0
    if alvo:
        log(f"→ Gemini escolhendo cortes de ~{alvo}s...")
    else:
        log("→ Gemini escolhendo os melhores cortes...")
    try:
        cortes = escolher_cortes(segmentos, dur, args.max, alvo)
    except Exception as e:
        log(f"  IA falhou ({str(e)[:120]}); usando plano B.")
        cortes = []
    if not cortes:
        log("  IA não retornou cortes — montando por fronteira de frase (plano B)...")
        cortes = cortes_heuristicos(segmentos, args.max, alvo or 75.0)
    if not cortes:
        log("✗ não consegui montar cortes (vídeo sem fala suficiente?)."); return
    log(f"  {len(cortes)} corte(s) escolhido(s).")

    destino = args.outdir or os.path.join(SAIDA_BASE, nome_seguro(titulo))
    os.makedirs(destino, exist_ok=True)
    # limpa cortes de uma rodada anterior (mesmo prefixo) pra não misturar
    import glob as _g
    for old in _g.glob(os.path.join(destino, f"{args.prefix}_*")):
        try:
            os.remove(old)
        except OSError:
            pass
    # ---- render em PARALELO (semáforo = --workers) ----
    # O .srt e o .txt são escritos ANTES; o .mp4 (rename atômico) aparece por
    # ÚLTIMO — assim o worker pode subir cada corte assim que o .mp4 surgir.
    from concurrent.futures import ThreadPoolExecutor, as_completed
    total = len(cortes)
    n_workers = max(1, min(args.workers, total))

    def _render_um(i, c):
        base = f"{args.prefix}_{i:02d}"
        mp4 = os.path.join(destino, base + ".mp4")
        srt = os.path.join(destino, base + ".srt")
        txt = os.path.join(destino, base + ".txt")
        with open(srt, "w", encoding="utf-8") as f:
            f.write(srt_do_corte(segmentos, c["inicio"], c["fim"]))
        with open(txt, "w", encoding="utf-8") as f:
            f.write(c["titulo"])
        log(f"  [{i}/{total}] {c['titulo']}  ({c['inicio']:.0f}s→{c['fim']:.0f}s)")
        if cortar_vertical(video, c["inicio"], c["fim"], mp4):
            return (i, mp4, srt)
        for q in (srt, txt):
            try:
                os.remove(q)
            except OSError:
                pass
        log(f"     ! falhou cortar o corte {i}")
        return None

    log(f"  renderizando {total} corte(s) — {n_workers} em paralelo...")
    feitos = []  # [(i, mp4, srt)]
    with ThreadPoolExecutor(max_workers=n_workers) as ex:
        futs = [ex.submit(_render_um, i, c) for i, c in enumerate(cortes, 1)]
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                feitos.append(r)
    feitos.sort(key=lambda x: x[0])

    # sobe pro Drive (se pedido)
    if args.drive and feitos:
        subir_drive(feitos, titulo, args.drive)

    # limpa a pasta de trabalho inteira (vídeo fonte + restos)
    shutil.rmtree(work, ignore_errors=True)

    log(f"\n>>> PRONTO. {len(feitos)} corte(s) em {destino}")


if __name__ == "__main__":
    main()
