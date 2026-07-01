# -*- coding: utf-8 -*-
"""
BAIXAR VÍDEOS SATISFATÓRIOS (uso pessoal — pra postar no TikTok).
Pega TODOS os vídeos dos canais cujo nome bate com o filtro (padrão: "satisf",
que cobre "Vídeos Satisfatórios" e "Satisfying Videos") e salva numa pasta,
uma subpasta por canal. NÃO mexe no fluxo do site (não sobe pra web).

Usa a MESMA conta do Telegram (sessão já logada), copiada pra uma sessão
separada (sessao_satisf) pra não conflitar com o bot de virais.

Uso:
  python baixar_satisfatorios.py --listar          # só mostra os canais que casam
  python baixar_satisfatorios.py                   # baixa TUDO dos canais que casam
  python baixar_satisfatorios.py --n 200           # baixa as últimas 200 de cada
  python baixar_satisfatorios.py --filtro satisfying   # muda o filtro de nome
"""
import os
import sys
import json
import shutil
import asyncio
import argparse
import unicodedata
from datetime import datetime, timezone

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import FloodWaitError
from telethon.tl.types import DocumentAttributeVideo

# imprime acentos/emoji sem quebrar no console do Windows
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

load_dotenv()
API_ID = int(os.getenv("TELEGRAM_API_ID", "0") or 0)
API_HASH = os.getenv("TELEGRAM_API_HASH", "")

BASE = os.path.dirname(os.path.abspath(__file__))
SESSION_BASE = os.path.join(BASE, "sessao_virais")     # sessão já logada
SESSION = os.path.join(BASE, "sessao_satisf")          # cópia, roda em paralelo
SAIDA = os.path.abspath(os.path.join(BASE, "..", "satisfatorios"))  # D:\VideosIA\satisfatorios
TRACKER = os.path.join(BASE, "baixados_satisf.json")


def norm(s):
    """minúsculo e sem acento, pra casar nomes."""
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def nome_seguro(s):
    s = (s or "canal").strip()
    for ch in '<>:"/\\|?*':
        s = s.replace(ch, "_")
    return s[:60] or "canal"


def carregar(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def salvar(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def eh_video(msg):
    if getattr(msg, "video", None):
        return True
    doc = getattr(msg, "document", None)
    if doc:
        return any(isinstance(a, DocumentAttributeVideo) for a in doc.attributes)
    return False


async def achar_canais(client, filtro):
    """Retorna [(entity, nome)] dos diálogos cujo nome contém o filtro."""
    f = norm(filtro)
    achados = []
    async for d in client.iter_dialogs():
        if not (d.is_channel or d.is_group):
            continue
        if f in norm(d.name or ""):
            achados.append((d.entity, d.name or "canal"))
    return achados


async def baixar_canal(client, entity, nome, limite, tracker):
    pasta = os.path.join(SAIDA, nome_seguro(nome))
    os.makedirs(pasta, exist_ok=True)
    print(f"\n== Canal: {nome}  ->  {pasta}")
    baixados = 0
    vistos = 0
    async for msg in client.iter_messages(entity, limit=limite):
        if not eh_video(msg):
            continue
        vistos += 1
        k = f"{msg.chat_id}:{msg.id}"
        destino = os.path.join(pasta, f"{abs(msg.chat_id)}_{msg.id}.mp4")
        if k in tracker or os.path.exists(destino):
            continue
        while True:
            try:
                print(f"  baixando {os.path.basename(destino)} ...")
                await client.download_media(msg, file=destino)
                break
            except FloodWaitError as e:
                print(f"  FloodWait: aguardando {e.seconds}s...")
                await asyncio.sleep(e.seconds + 1)
            except Exception as e:
                print(f"  [erro] {e} — pulei")
                break
        if os.path.exists(destino) and os.path.getsize(destino) > 0:
            tracker[k] = destino
            baixados += 1
            if baixados % 10 == 0:
                salvar(TRACKER, tracker)
    salvar(TRACKER, tracker)
    print(f"== {nome}: {baixados} novo(s) (de {vistos} vídeos vistos)")
    return baixados


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--filtro", default="satisf", help="parte do nome do canal")
    ap.add_argument("--n", type=int, default=0, help="máximo por canal (0 = tudo)")
    ap.add_argument("--listar", action="store_true", help="só mostra os canais que casam")
    args = ap.parse_args()

    if not API_ID or not API_HASH:
        print("Faltam TELEGRAM_API_ID / TELEGRAM_API_HASH no .env da raiz."); return

    # copia a sessão já logada (sem novo login) pra rodar em paralelo com o bot
    if not os.path.exists(SESSION + ".session") and os.path.exists(SESSION_BASE + ".session"):
        shutil.copy(SESSION_BASE + ".session", SESSION + ".session")
        print("Sessão copiada (sem novo login).")

    client = TelegramClient(SESSION, API_ID, API_HASH, flood_sleep_threshold=60)
    await client.start()
    print("Conectado ao Telegram.")

    canais = await achar_canais(client, args.filtro)
    if not canais:
        print(f"Nenhum canal com '{args.filtro}' no nome. Você é membro deles?")
        await client.disconnect(); return

    print(f"\nCanais que casam com '{args.filtro}':")
    for _, nome in canais:
        print(f"  - {nome}")

    if args.listar:
        await client.disconnect(); return

    os.makedirs(SAIDA, exist_ok=True)
    tracker = carregar(TRACKER, {})
    limite = args.n if args.n > 0 else None
    total = 0
    for entity, nome in canais:
        total += await baixar_canal(client, entity, nome, limite, tracker)

    print(f"\n>>> PRONTO. {total} vídeo(s) baixado(s) em {SAIDA}")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
