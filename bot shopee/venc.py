# -*- coding: utf-8 -*-
"""
Codec de vídeo compartilhado: GPU AMD via VAAPI (serverrk, RX 5700) com queda
automática pro CPU (libx264) quando a placa não existe ou o encode falha.

No serverrk existe /dev/dri/renderD128 e o ffmpeg tem h264_vaapi -> encoda na GPU.
No PC do Lucas (Windows) não há VAAPI -> cai direto no libx264 e tudo roda igual.
VENC_CPU=1 força o CPU (útil pra depurar). VAAPI_DEVICE troca o render node.

Como usar num encode com filter_complex que termina o vídeo num label (ex.: [vout]):
    for modo in venc.modos(FFMPEG):
        filtro = f"...subtitles=x{venc.fim_v(modo)};[1:a]...[aout]"   # fim_v fecha [vout]
        cmd = [FFMPEG, "-y", *venc.dev_args(modo), *inputs,
               "-filter_complex", filtro, "-map", "[vout]", "-map", "[aout]",
               *venc.codec_v(modo, crf=CRF), "-c:a", "aac", saida]
        r = run(cmd)
        if r.returncode == 0:
            break
        if modo == "gpu":
            venc.desligar_gpu()   # GPU falhou -> próxima volta já vai de CPU
"""
import os
import subprocess

VAAPI_DEVICE = os.environ.get("VAAPI_DEVICE", "/dev/dri/renderD128")
_FORCAR_CPU = os.environ.get("VENC_CPU") == "1"
_cache = None  # None = ainda não testou; True/False = descoberto


def gpu_ok(ffmpeg="ffmpeg"):
    """True se dá pra encodar na GPU (VAAPI). Descobre 1x e mantém em cache."""
    global _cache
    if _FORCAR_CPU:
        return False
    if _cache is None:
        try:
            tem_dev = os.path.exists(VAAPI_DEVICE)
            r = subprocess.run([ffmpeg, "-hide_banner", "-encoders"],
                               capture_output=True, text=True, errors="replace")
            _cache = bool(tem_dev and ("h264_vaapi" in (r.stdout or "")))
        except Exception:
            _cache = False
    return _cache


def desligar_gpu():
    """Chamar quando um encode na GPU falhar em runtime: não tenta mais nesta sessão."""
    global _cache
    _cache = False


def modos(ffmpeg="ffmpeg"):
    """Ordem de tentativa: GPU e depois CPU (se a GPU existir); senão só CPU."""
    return ["gpu", "cpu"] if gpu_ok(ffmpeg) else ["cpu"]


def dev_args(modo):
    """Args que vão logo depois de 'ffmpeg -y' (antes dos -i). Só no modo GPU."""
    return ["-vaapi_device", VAAPI_DEVICE] if modo == "gpu" else []


def fim_v(modo, label="vout", cpu_fmt="yuv420p"):
    """Sufixo do ÚLTIMO elo de vídeo do filtro, fechando o label de saída.
    GPU: sobe o frame pra placa (nv12 + hwupload). CPU: fixa o pixel format.
    Ex.: '...,overlay=...' + fim_v(modo) -> '...,overlay=...,format=nv12,hwupload[vout]'."""
    if modo == "gpu":
        return f",format=nv12,hwupload[{label}]"
    return f",format={cpu_fmt}[{label}]"


def codec_v(modo, crf=18, qp=23, preset="slow"):
    """Args de codec de vídeo. GPU = h264_vaapi (CQP); CPU = libx264.
    No GPU não vai -pix_fmt (o hwupload já entrega nv12 na placa)."""
    if modo == "gpu":
        return ["-c:v", "h264_vaapi", "-rc_mode", "CQP", "-qp", str(qp)]
    return ["-c:v", "libx264", "-preset", preset, "-crf", str(crf), "-pix_fmt", "yuv420p"]
