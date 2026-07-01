# -*- coding: utf-8 -*-
"""
Acumulador de consumo de APIs por execucao da fabrica (Gemini + ElevenLabs).
Cada chamada de API reporta aqui; no fim, dump() grava consumo.json e o worker
manda pra web debitar pelo custo REAL.

Unidades:
  geminiFlashTokens -> tokens totais nos modelos de texto/visao (gemini-2.5-flash)
  geminiImgTokens   -> tokens totais nos modelos de imagem (gemini-2.5-flash-image)
  elevenChars       -> caracteres narrados na ElevenLabs
"""
import json
import threading

_lock = threading.Lock()
_uso = {"geminiFlashTokens": 0, "geminiImgTokens": 0, "elevenChars": 0}


def add_gemini(model, usage_metadata):
    """Soma os tokens de um generate_content (usage_metadata.total_token_count)."""
    try:
        total = int(getattr(usage_metadata, "total_token_count", 0) or 0)
    except Exception:
        total = 0
    if total <= 0:
        return
    eh_img = "image" in (model or "")
    with _lock:
        _uso["geminiImgTokens" if eh_img else "geminiFlashTokens"] += total


def add_eleven(chars):
    """Soma os caracteres de uma narracao gerada na ElevenLabs."""
    try:
        n = int(chars or 0)
    except Exception:
        n = 0
    if n > 0:
        with _lock:
            _uso["elevenChars"] += n


def snapshot():
    with _lock:
        return dict(_uso)


def dump(path):
    """Grava o consumo acumulado num JSON (pro worker enviar pra web)."""
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(snapshot(), f)
    except Exception:
        pass
