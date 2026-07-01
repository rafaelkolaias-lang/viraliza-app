# -*- coding: utf-8 -*-
"""
Teste do Veo: anima 1 imagem -> 1 clipe (image-to-video, SILENCIOSO, barato).
Tenta as 3 chaves; só a que tiver billing gera (as outras falham sem custo).
"""
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

KEYS = [("GEMINI_API_KEY", os.getenv("GEMINI_API_KEY")),
        ("GEMINI_API_KEY_2", os.getenv("GEMINI_API_KEY_2")),
        ("GEMINI_API_KEY_3", os.getenv("GEMINI_API_KEY_3"))]

MODELO = "veo-2.0-generate-001"   # mais barato, sem audio
IMG = r"d:\VideosIA\entrada\imagens\WhatsApp Image 2026-06-11 at 12.32.45 (1).jpeg"
SAIDA = r"d:\VideosIA\saida\veo_teste.mp4"
PROMPT = ("The young woman gently turns and poses confidently, showing off her yellow "
          "and green BRAZIL cropped top and shorts. Subtle natural movement, soft studio "
          "light, fashion product video, photorealistic. Fully clothed, tasteful.")


def tentar(nome_key, key):
    print(f"\n>>> Tentando {nome_key} ...")
    client = genai.Client(api_key=key)
    with open(IMG, "rb") as f:
        img_bytes = f.read()
    op = client.models.generate_videos(
        model=MODELO,
        prompt=PROMPT,
        image=types.Image(image_bytes=img_bytes, mime_type="image/jpeg"),
        config=types.GenerateVideosConfig(
            aspect_ratio="9:16",
            number_of_videos=1,
            duration_seconds=5,
            person_generation="allow_adult",
        ),
    )
    print("    operação iniciada, aguardando o Veo gerar (~1-2 min)...")
    t0 = time.time()
    while not op.done:
        time.sleep(15)
        op = client.operations.get(op)
        print(f"    ... {int(time.time()-t0)}s")
    gen = op.response.generated_videos[0]
    client.files.download(file=gen.video)
    gen.video.save(SAIDA)
    print(f"    OK! Vídeo salvo em {SAIDA}")
    return True


def main():
    for nome, key in KEYS:
        if not key:
            continue
        try:
            if tentar(nome, key):
                print(f"\n=== SUCESSO com {nome} ===")
                return
        except Exception as e:
            msg = str(e)
            curto = msg[:160]
            print(f"    FALHOU ({nome}): {curto}")
            # se for billing/quota, segue pra proxima chave
    print("\n=== Nenhuma chave conseguiu gerar (provável: billing não ativo) ===")


if __name__ == "__main__":
    main()
