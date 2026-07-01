# -*- coding: utf-8 -*-
"""
GERA AS PREVIAS DE VOZ (uma frase padrao) e sobe pro site.

Roda no SEU PC (onde esta a chave ElevenLabs). Para cada voz da lista curada do
site (GET /api/voices), gera a previa UMA vez e envia pro servidor, que guarda em
public/voice-previews/<id>.mp3. O Estudio toca isso no botao de play. Reusa: por
padrao so gera as que ainda nao existem (--force refaz todas).

Pre-requisitos no .env da raiz (mesmos do worker):
  WEB_URL=http://localhost:3000        (ou o dominio em producao)
  WORKER_TOKEN=...                     (o mesmo do app)
  ELEVENLABS_API_KEYS=sk_...           (ja usado pela narracao)

Uso:
  python gerar_previews_voz.py
  python gerar_previews_voz.py --force
"""
import os
import argparse
import tempfile

import requests
from dotenv import load_dotenv

# reaproveita a geracao de voz (rodizio de chaves + voice_id) que a narracao usa
from narrar_video import gerar_voz_com_tempos

load_dotenv()

# Frase unica falada por TODAS as vozes na previa. Troque aqui se quiser.
FRASE = (
    "Oi! Essa é uma prévia da minha voz. Aqui na Viraliza, você transforma "
    "qualquer ideia em vídeo viral e vende muito mais online. Escolha esta voz "
    "e crie um criativo incrível agora mesmo."
)

WEB_URL = (os.getenv("WEB_URL", "http://localhost:3000") or "").split(",")[0].strip().rstrip("/")
TOKEN = (os.getenv("WORKER_TOKEN", "") or "").split(",")[0].strip()


def listar_vozes():
    r = requests.get(f"{WEB_URL}/api/voices", timeout=30)
    r.raise_for_status()
    return r.json().get("vozes", [])


def ja_existe(vid):
    try:
        r = requests.head(f"{WEB_URL}/api/midia/voice-previews/{vid}.mp3", timeout=15)
        return r.status_code == 200
    except Exception:
        return False


def subir(vid, mp3_path):
    with open(mp3_path, "rb") as f:
        r = requests.post(
            f"{WEB_URL}/api/worker/voz-preview",
            headers={"x-worker-token": TOKEN},
            data={"id": vid},
            files={"audio": (vid + ".mp3", f, "audio/mpeg")},
            timeout=120,
        )
    r.raise_for_status()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true",
                    help="regera todas (ignora as que ja existem)")
    args = ap.parse_args()

    if not TOKEN:
        print("Falta WORKER_TOKEN no .env da raiz."); return

    try:
        vozes = listar_vozes()
    except Exception as e:
        print(f"Nao consegui ler a lista de vozes em {WEB_URL}/api/voices: {e}")
        return

    print(f"{len(vozes)} voz(es) na lista curada. Site: {WEB_URL}\n")
    feitas = puladas = falhas = 0
    tmpdir = tempfile.gettempdir()

    for v in vozes:
        vid = v.get("id", "")
        nome = v.get("nome", vid)
        if not vid:
            continue
        if not args.force and ja_existe(vid):
            print(f"  = {nome}: ja tem previa, pulei"); puladas += 1; continue
        print(f"  + {nome}: gerando previa...")
        out = os.path.join(tmpdir, f"preview_{vid}.mp3")
        try:
            gerar_voz_com_tempos(FRASE, out, voice_id=vid)
            subir(vid, out)
            feitas += 1
            print(f"    ok, no ar")
        except Exception as e:
            falhas += 1
            print(f"    ! falhou: {e}")
        finally:
            try:
                os.remove(out)
            except OSError:
                pass

    print(f"\nConcluido. {feitas} gerada(s), {puladas} ja existiam, {falhas} falha(s).")


if __name__ == "__main__":
    main()
