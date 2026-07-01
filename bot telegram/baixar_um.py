# -*- coding: utf-8 -*-
"""
Baixa UMA mensagem específica do Telegram pelo link (t.me/canal/ID).
Usa a sessão já logada (sessao_virais). Salva na pasta atual.

Uso:
  python baixar_um.py https://t.me/TESTEMUNHOS_arrebatamento/842
  python baixar_um.py https://t.me/canal/123  -o "C:\\caminho\\saida"
"""
import os
import re
import sys
import asyncio
import argparse

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import FloodWaitError

load_dotenv()  # .env da raiz

API_ID = int(os.getenv("TELEGRAM_API_ID", "0") or 0)
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
BASE = os.path.dirname(os.path.abspath(__file__))
SESSION = os.path.join(BASE, "sessao_virais")

LINK_RE = re.compile(r"t\.me/(?:c/)?([^/]+)/(\d+)")


def parse_link(link):
    m = LINK_RE.search(link)
    if not m:
        raise SystemExit("Link inválido. Use algo como https://t.me/canal/123")
    canal, msg_id = m.group(1), int(m.group(2))
    # links privados (t.me/c/123456/78) usam id numérico do canal
    if "/c/" in link:
        canal = int("-100" + canal)
    else:
        canal = "@" + canal
    return canal, msg_id


def progresso(rotulo):
    estado = {"ultimo": -1}
    def cb(recebido, total):
        if not total:
            return
        pct = int(recebido * 100 / total)
        if pct != estado["ultimo"]:
            estado["ultimo"] = pct
            print(f"\r  baixando {rotulo}... {pct}% "
                  f"({recebido/1e6:.1f}/{total/1e6:.1f} MB)", end="", flush=True)
    return cb


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("link", help="link da mensagem: https://t.me/canal/ID")
    ap.add_argument("-o", "--out", default=BASE, help="pasta de saída")
    args = ap.parse_args()

    if not API_ID or not API_HASH:
        raise SystemExit("Faltam TELEGRAM_API_ID / TELEGRAM_API_HASH no .env")

    canal, msg_id = parse_link(args.link)
    os.makedirs(args.out, exist_ok=True)

    client = TelegramClient(SESSION, API_ID, API_HASH, flood_sleep_threshold=60)
    await client.start()
    print(f"Conectado. Buscando {canal} msg {msg_id} ...")

    try:
        msg = await client.get_messages(canal, ids=msg_id)
    except Exception as e:
        raise SystemExit(f"Não consegui acessar o canal/mensagem: {e}")

    if not msg:
        raise SystemExit("Mensagem não encontrada (apagada ou sem acesso).")
    if not msg.media:
        raise SystemExit("Essa mensagem não tem mídia (vídeo/arquivo) pra baixar.")

    # nome de saída
    nome = f"tg_{abs(msg.chat_id)}_{msg.id}"
    while True:
        try:
            destino = await client.download_media(
                msg, file=os.path.join(args.out, nome),
                progress_callback=progresso(nome),
            )
            break
        except FloodWaitError as e:
            print(f"\n  FloodWait: aguardando {e.seconds}s...")
            await asyncio.sleep(e.seconds + 1)

    print(f"\nOK! Salvo em: {destino}")
    if msg.message:
        print(f"Legenda: {msg.message.strip()[:200]}")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
