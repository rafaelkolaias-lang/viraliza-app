# -*- coding: utf-8 -*-
"""
BOT TELEGRAM -> VÍDEOS VIRAIS
Baixa vídeos novos de canais/grupos que VOCÊ é membro e disponibiliza na web
(galeria "Vídeos virais"). Sem perder qualidade (baixa o arquivo original).

O que ele trata sozinho:
- FloodWait (limite de velocidade do Telegram): detecta e espera o tempo pedido.
- Não rebaixa o mesmo vídeo: tracker (baixados.json) com chave única por mensagem/arquivo.
- Extrai o LINK do produto da legenda + um título.
- Modo histórico (baixa as últimas N) e modo ao vivo (captura vídeos novos na hora).

Setup rápido:
  1. Pegue API_ID e API_HASH em https://my.telegram.org -> "API development tools"
  2. No .env da RAIZ adicione:
       TELEGRAM_API_ID=123456
       TELEGRAM_API_HASH=xxxxxxxx
       TELEGRAM_CANAIS=@canal1,@canal2     (canais/grupos onde você é membro)
  3. pip install -r requirements.txt
  4. python baixar_virais.py                 # baixa histórico recente e fica ouvindo novos
     python baixar_virais.py --historico 200 # baixa as últimas 200 de cada canal e sai
"""
import os
import re
import json
import shutil
import asyncio
import argparse
import subprocess
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from telethon import TelegramClient, events
from telethon.errors import FloodWaitError
from telethon.tl.types import DocumentAttributeVideo

load_dotenv()  # lê o .env da raiz (mesmo dos outros bots)

API_ID = int(os.getenv("TELEGRAM_API_ID", "0") or 0)
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
CANAIS = [c.strip() for c in os.getenv("TELEGRAM_CANAIS", "").split(",") if c.strip()]
# canais de IMAGENS (produtos virais). Padrão: o acervo da Shopee.
CANAIS_IMG = [c.strip() for c in os.getenv(
    "TELEGRAM_CANAIS_IMAGENS", "AE-IA Storys - Acervo Shopee").split(",") if c.strip()]

# Servidor web (produção): se configurado, sobe os vídeos/imagens pra lá também.
WEB_URL = (os.getenv("WEB_URL", "") or "").rstrip("/")
WORKER_TOKEN = os.getenv("WORKER_TOKEN", "")

BASE = os.path.dirname(os.path.abspath(__file__))
# saída servida pela web: app/public/virais/*.mp4 + app/data/virais.json
SAIDA_VIDEOS = os.path.abspath(os.path.join(BASE, "..", "app", "public", "virais"))
META_JSON = os.path.abspath(os.path.join(BASE, "..", "app", "data", "virais.json"))
# produtos (imagens): app/public/produtos/*.jpg + app/data/produtos.json
SAIDA_PRODUTOS = os.path.abspath(os.path.join(BASE, "..", "app", "public", "produtos"))
META_PRODUTOS = os.path.abspath(os.path.join(BASE, "..", "app", "data", "produtos.json"))
TRACKER = os.path.join(BASE, "baixados.json")
TRACKER_IMG = os.path.join(BASE, "baixados_produtos.json")
SESSION = os.path.join(BASE, "sessao_virais")
SESSION_IMG = os.path.join(BASE, "sessao_produtos")  # sessão separada p/ rodar em paralelo

# ffmpeg pra gerar miniatura (1º frame) — mesmo caminho da fábrica, com fallback
_FF = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFMPEG = os.path.join(_FF, "ffmpeg.exe")
if not os.path.exists(FFMPEG):
    FFMPEG = "ffmpeg"


def gerar_thumb(video_path, thumb_path):
    """Extrai o 1º frame do vídeo como uma imagem pequena (prévia rápida)."""
    if os.path.exists(thumb_path):
        return True
    try:
        subprocess.run(
            [FFMPEG, "-y", "-ss", "0.5", "-i", video_path, "-frames:v", "1",
             "-vf", "scale=360:-2", thumb_path],
            capture_output=True, timeout=60,
        )
        return os.path.exists(thumb_path)
    except Exception:
        return False

URL_RE = re.compile(r"https?://[^\s)]+")

os.makedirs(SAIDA_VIDEOS, exist_ok=True)
os.makedirs(SAIDA_PRODUTOS, exist_ok=True)
os.makedirs(os.path.dirname(META_JSON), exist_ok=True)


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


def chave(msg):
    midia = getattr(msg, "video", None) or getattr(msg, "document", None)
    fid = getattr(midia, "id", None)
    return f"{msg.chat_id}:{msg.id}:{fid}"


def extrair_link(texto):
    if not texto:
        return ""
    m = URL_RE.search(texto)
    return m.group(0) if m else ""


# domínios de link da Shopee (inclui os encurtados de afiliado)
SHOPEE_RE = re.compile(r"(shopee\.com\.br|shope\.ee|s\.shopee\.|shp\.ee)", re.I)


def eh_link_shopee(link):
    return bool(link) and bool(SHOPEE_RE.search(link))


# ligado por --so-link-shopee: só sobe imagem que tenha link da Shopee
SO_LINK_SHOPEE = False


def titulo_de(texto, fallback):
    if not texto:
        return fallback
    primeira = texto.strip().splitlines()[0]
    primeira = URL_RE.sub("", primeira).strip(" -|·")
    return primeira[:80] or fallback


def duracao_de(msg):
    doc = getattr(msg, "document", None) or getattr(msg, "video", None)
    for a in getattr(doc, "attributes", []) or []:
        if isinstance(a, DocumentAttributeVideo):
            return int(a.duration or 0)
    return 0


def subir_para_web(item, arquivo_path):
    """Sobe o vídeo + miniatura + metadados pro servidor. Silencioso se não configurado."""
    if not WEB_URL or not WORKER_TOKEN:
        return
    if not os.path.exists(arquivo_path):
        return
    # gera a miniatura (1º frame) ao lado do vídeo
    thumb_path = os.path.join(SAIDA_VIDEOS, item["id"] + ".jpg")
    tem_thumb = gerar_thumb(arquivo_path, thumb_path)
    abertos = []
    try:
        fv = open(arquivo_path, "rb"); abertos.append(fv)
        files = {"video": (item["id"] + ".mp4", fv, "video/mp4")}
        if tem_thumb:
            ft = open(thumb_path, "rb"); abertos.append(ft)
            files["thumb"] = (item["id"] + ".jpg", ft, "image/jpeg")
        r = requests.post(
            f"{WEB_URL}/api/worker/viral",
            headers={"x-worker-token": WORKER_TOKEN},
            data={
                "id": item["id"],
                "titulo": item["titulo"],
                "link": item.get("link", ""),
                "duracaoSeg": str(item.get("duracaoSeg", 0)),
                "canal": item.get("canal", ""),
                "adicionadoEm": item.get("adicionadoEm", ""),
            },
            files=files,
            timeout=300,
        )
        if r.ok:
            print(f"  ↑ subido pra web ({WEB_URL})")
        else:
            print(f"  [aviso] web respondeu {r.status_code} ao subir {item['id']}")
    except Exception as e:
        print(f"  [aviso] não consegui subir pra web: {e}")
    finally:
        for fh in abertos:
            fh.close()


async def baixar_msg(client, msg, tracker, meta):
    if not eh_video(msg):
        return False
    k = chave(msg)
    if k in tracker:
        return False
    vid_id = f"tg_{abs(msg.chat_id)}_{msg.id}"
    destino = os.path.join(SAIDA_VIDEOS, vid_id + ".mp4")
    while True:
        try:
            print(f"  baixando {vid_id} ...")
            await client.download_media(msg, file=destino)
            break
        except FloodWaitError as e:  # limite de velocidade -> espera e tenta de novo
            print(f"  FloodWait: aguardando {e.seconds}s...")
            await asyncio.sleep(e.seconds + 1)
    texto = msg.message or ""
    item = {
        "id": vid_id,
        "titulo": titulo_de(texto, "Vídeo viral"),
        "link": extrair_link(texto),
        "arquivo": f"/virais/{vid_id}.mp4",
        "duracaoSeg": duracao_de(msg),
        "canal": str(msg.chat_id),
        "adicionadoEm": (msg.date or datetime.now(timezone.utc)).isoformat(),
    }
    meta.insert(0, item)  # mais novo primeiro
    tracker[k] = vid_id
    salvar(META_JSON, meta)
    salvar(TRACKER, tracker)
    subir_para_web(item, destino)  # sobe pro servidor de produção (se configurado)
    print(f"  OK: {item['titulo']} | link: {item['link'] or '—'}")
    return True


def eh_imagem(msg):
    if getattr(msg, "photo", None):
        return True
    doc = getattr(msg, "document", None)
    mime = getattr(doc, "mime_type", "") or ""
    return mime.startswith("image/")


def subir_img_para_web(item, arquivo_path):
    """Sobe a imagem (produto) + metadados pro servidor. Silencioso se não configurado."""
    if not WEB_URL or not WORKER_TOKEN or not os.path.exists(arquivo_path):
        return
    try:
        ext = os.path.splitext(arquivo_path)[1] or ".jpg"
        with open(arquivo_path, "rb") as f:
            r = requests.post(
                f"{WEB_URL}/api/worker/produto",
                headers={"x-worker-token": WORKER_TOKEN},
                data={
                    "id": item["id"],
                    "titulo": item["titulo"],
                    "link": item.get("link", ""),
                    "canal": item.get("canal", ""),
                    "adicionadoEm": item.get("adicionadoEm", ""),
                    "ext": ext,
                },
                files={"imagem": (item["id"] + ext, f, "image/jpeg")},
                timeout=120,
            )
        if r.ok:
            print(f"  ↑ produto subido pra web")
        else:
            print(f"  [aviso] web respondeu {r.status_code} ao subir produto {item['id']}")
    except Exception as e:
        print(f"  [aviso] não consegui subir produto: {e}")


async def baixar_img(client, msg, tracker, meta):
    if not eh_imagem(msg):
        return False
    k = f"img:{msg.chat_id}:{msg.id}"
    if k in tracker:
        return False
    texto = msg.message or ""
    link = extrair_link(texto)
    # filtro opcional: só produtos com link da Shopee (descarta avisos/cursos)
    if SO_LINK_SHOPEE and not eh_link_shopee(link):
        return False
    prod_id = f"tg_{abs(msg.chat_id)}_{msg.id}"
    destino = os.path.join(SAIDA_PRODUTOS, prod_id + ".jpg")
    while True:
        try:
            print(f"  baixando imagem {prod_id} ...")
            await client.download_media(msg, file=destino)
            break
        except FloodWaitError as e:
            print(f"  FloodWait: aguardando {e.seconds}s...")
            await asyncio.sleep(e.seconds + 1)
    item = {
        "id": prod_id,
        "titulo": titulo_de(texto, "Produto viral"),
        "link": link,
        "arquivo": f"/produtos/{prod_id}.jpg",
        "canal": str(msg.chat_id),
        "adicionadoEm": (msg.date or datetime.now(timezone.utc)).isoformat(),
    }
    meta.insert(0, item)
    tracker[k] = prod_id
    salvar(META_PRODUTOS, meta)
    salvar(TRACKER_IMG, tracker)
    subir_img_para_web(item, destino)
    print(f"  OK (produto): {item['titulo']} | link: {item['link'] or '—'}")
    return True


async def baixar_historico(client, canais, n):
    tracker = carregar(TRACKER, {})
    meta = carregar(META_JSON, [])
    total = 0
    for canal in canais:
        print(f"Lendo últimas {n} mensagens (vídeos)...")
        async for msg in client.iter_messages(canal, limit=n):
            if await baixar_msg(client, msg, tracker, meta):
                total += 1
    print(f"\nConcluído. {total} vídeo(s) novo(s).")


async def baixar_historico_img(client, canais, n):
    tracker = carregar(TRACKER_IMG, {})
    meta = carregar(META_PRODUTOS, [])
    total = 0
    for canal in canais:
        print(f"Lendo últimas {n} mensagens (imagens)...")
        async for msg in client.iter_messages(canal, limit=n):
            if await baixar_img(client, msg, tracker, meta):
                total += 1
    print(f"\nConcluído. {total} produto(s) novo(s).")


async def ouvir(client, canais_video, canais_img):
    tracker_v = carregar(TRACKER, {})
    tracker_i = carregar(TRACKER_IMG, {})
    meta_v = carregar(META_JSON, [])
    meta_p = carregar(META_PRODUTOS, [])

    if canais_video:
        @client.on(events.NewMessage(chats=canais_video))
        async def _hv(event):
            if await baixar_msg(client, event.message, tracker_v, meta_v):
                print("  (vídeo novo ao vivo)")

    if canais_img:
        @client.on(events.NewMessage(chats=canais_img))
        async def _hi(event):
            if await baixar_img(client, event.message, tracker_i, meta_p):
                print("  (produto novo ao vivo)")

    print("Ouvindo novos vídeos e produtos... (Ctrl+C pra sair)")
    await client.run_until_disconnected()


async def resolver_canais(client, nomes):
    """Aceita @usuario, id numérico OU o NOME do canal (procura nos seus diálogos)."""
    resolvidos, dialogs = [], None
    for c in nomes:
        if c.startswith("@") or c.lstrip("-").isdigit():
            resolvidos.append(c)
            continue
        if dialogs is None:
            dialogs = await client.get_dialogs()
        achou = next(
            (d.entity for d in dialogs if c.lower() in (d.name or "").lower()), None
        )
        if achou:
            print(f"Canal encontrado pelo nome: {c}")
            resolvidos.append(achou)
        else:
            print(f"[aviso] não achei '{c}' nos seus canais (rode --listar pra ver)")
    return resolvidos


async def listar_dialogos(client):
    print("Seus canais e grupos:\n")
    async for d in client.iter_dialogs():
        if d.is_channel or d.is_group:
            uname = getattr(d.entity, "username", None)
            print(f"  - {d.name}  | @{uname or '(sem @)'}  | id={d.id}")


def subir_tudo():
    """Sobe pro servidor tudo que já está no PC (vídeos virais + produtos)."""
    if not WEB_URL or not WORKER_TOKEN:
        print("Configure WEB_URL e WORKER_TOKEN no .env da raiz primeiro."); return
    # vídeos
    meta = carregar(META_JSON, [])
    print(f"Subindo {len(meta)} vídeo(s) pra {WEB_URL} ...")
    ev = 0
    for item in meta:
        arq = os.path.join(SAIDA_VIDEOS, item["id"] + ".mp4")
        if os.path.exists(arq):
            subir_para_web(item, arq); ev += 1
        else:
            print(f"  [pulado] vídeo sumiu: {item['id']}")
    # produtos (imagens)
    meta_p = carregar(META_PRODUTOS, [])
    print(f"Subindo {len(meta_p)} produto(s) ...")
    ep = 0
    for item in meta_p:
        arq = os.path.join(SAIDA_PRODUTOS, item["id"] + ".jpg")
        if os.path.exists(arq):
            subir_img_para_web(item, arq); ep += 1
        else:
            print(f"  [pulado] imagem sumiu: {item['id']}")
    print(f"\nConcluído. {ev} vídeo(s) + {ep} produto(s) enviados.")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--historico", type=int, default=0,
                    help="baixa as últimas N de cada canal e sai")
    ap.add_argument("--listar", action="store_true",
                    help="lista seus canais/grupos (pra achar o nome certo) e sai")
    ap.add_argument("--subir-tudo", action="store_true",
                    help="sobe pro servidor os virais que já estão no PC (sem Telegram)")
    ap.add_argument("--so-videos", action="store_true",
                    help="processa SÓ os canais de vídeo")
    ap.add_argument("--so-imagens", action="store_true",
                    help="processa SÓ os canais de imagem (sessão separada, roda em paralelo)")
    ap.add_argument("--sessao", default="",
                    help="usa uma sessão separada com esse apelido (copia da principal, "
                         "sem novo login) pra rodar EM PARALELO com outra instância")
    ap.add_argument("--so-link-shopee", action="store_true",
                    help="nas imagens, só sobe as que têm link da Shopee (ignora avisos/cursos)")
    args = ap.parse_args()

    global SO_LINK_SHOPEE
    SO_LINK_SHOPEE = args.so_link_shopee

    if args.subir_tudo:
        subir_tudo(); return

    if not API_ID or not API_HASH:
        print("Faltam TELEGRAM_API_ID / TELEGRAM_API_HASH no .env"); return

    # Sessões separadas rodam em paralelo (sem conflito de arquivo .session).
    # --so-imagens já usa a sua; --sessao <apelido> cria uma sob demanda (copiada
    # da principal, sem novo login).
    sess = SESSION
    if args.so_imagens:
        sess = SESSION_IMG
    if args.sessao:
        sess = os.path.join(BASE, f"sessao_{args.sessao}")
    if sess != SESSION and not os.path.exists(sess + ".session") \
            and os.path.exists(SESSION + ".session"):
        shutil.copy(SESSION + ".session", sess + ".session")
        print("Sessão copiada (sem novo login).")

    # flood_sleep_threshold: floods curtos o Telethon já espera sozinho
    client = TelegramClient(sess, API_ID, API_HASH, flood_sleep_threshold=60)
    await client.start()  # na 1ª vez pede telefone + código do Telegram
    print("Conectado ao Telegram.\n")

    if args.listar:
        await listar_dialogos(client)
        return

    # decide quais canais processar conforme os flags
    quer_video = not args.so_imagens
    quer_imagem = not args.so_videos
    canais = await resolver_canais(client, CANAIS) if quer_video else []
    canais_img = await resolver_canais(client, CANAIS_IMG) if quer_imagem else []
    if not canais and not canais_img:
        print("Nenhum canal resolvido. Rode: python baixar_virais.py --listar")
        return
    print(f"Vídeos: {len(canais)} canal(is) | Imagens: {len(canais_img)} canal(is)\n")

    if args.historico:
        if canais:
            await baixar_historico(client, canais, args.historico)
        if canais_img:
            await baixar_historico_img(client, canais_img, args.historico)
    else:
        if canais:
            await baixar_historico(client, canais, 50)       # histórico recente
        if canais_img:
            await baixar_historico_img(client, canais_img, 50)
        await ouvir(client, canais, canais_img)              # e fica ao vivo


if __name__ == "__main__":
    asyncio.run(main())
