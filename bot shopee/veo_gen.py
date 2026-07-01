# -*- coding: utf-8 -*-
"""
Geração de cena com Veo (image-to-video, SILENCIOSO).
Tenta as chaves até achar uma com billing. SÓ deve ser chamado quando NÃO há cache
(o controle de custo/cache fica em quem chama).
"""
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

KEYS = [k for k in (os.getenv("GEMINI_API_KEY"),
                    os.getenv("GEMINI_API_KEY_2"),
                    os.getenv("GEMINI_API_KEY_3")) if k]

MODELO_VEO = os.getenv("VEO_MODEL", "veo-2.0-generate-001")  # barato, sem audio
SEGUNDOS = int(os.getenv("VEO_SEGUNDOS", "5"))


def gerar_clipe(imagem_path, prompt, saida, negative="", segundos=SEGUNDOS):
    """Anima imagem -> clipe 9:16 silencioso. Retorna (ok, info)."""
    with open(imagem_path, "rb") as f:
        img = f.read()
    mime = "image/png" if imagem_path.lower().endswith(".png") else "image/jpeg"
    erros = []
    for key in KEYS:
        try:
            client = genai.Client(api_key=key)
            op = client.models.generate_videos(
                model=MODELO_VEO,
                prompt=prompt,
                image=types.Image(image_bytes=img, mime_type=mime),
                config=types.GenerateVideosConfig(
                    aspect_ratio="9:16",
                    number_of_videos=1,
                    duration_seconds=segundos,
                    person_generation="allow_adult",
                    negative_prompt=negative or None,
                ),
            )
            t0 = time.time()
            while not op.done:
                time.sleep(15)
                op = client.operations.get(op)
                if time.time() - t0 > 600:
                    return False, "timeout (>10min)"
            gen = op.response.generated_videos[0]
            client.files.download(file=gen.video)
            gen.video.save(saida)
            return True, "ok"
        except Exception as e:
            erros.append(str(e)[:140])
            continue
    return False, " | ".join(erros) or "sem chave com billing"
