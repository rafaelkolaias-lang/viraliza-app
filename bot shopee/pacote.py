# -*- coding: utf-8 -*-
"""
PACOTE DO DIA - prepara o lote de postagem e alimenta a planilha resultados.csv

Uso:
  python pacote.py                -> registra vídeos novos da saida/ na planilha e
                                     monta postar/AAAA-MM-DD/ com horários sugeridos
  python pacote.py --so-registrar -> só adiciona na planilha (sem montar o lote)

A planilha resultados.csv abre direto no Excel. Depois de postar, preencha:
views, curtidas, comentarios, cliques_sacolinha, pedidos. Aí rode: python analisar.py
"""
import os
import csv
import sys
import shutil
import subprocess
from datetime import date

BASE = os.path.dirname(os.path.abspath(__file__))
DIR_SAIDA = os.path.join(BASE, "saida")
DIR_POSTAR = os.path.join(BASE, "postar")
CSV_PATH = os.path.join(BASE, "resultados.csv")
DIR_PRODUTOS = os.path.join(BASE, "produtos")

_FF = r"C:\Users\lucas\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
FFPROBE = os.path.join(_FF, "ffprobe.exe")
if not os.path.exists(FFPROBE):
    FFPROBE = "ffprobe"

CAMPOS = ["data", "horario", "arquivo", "produto", "formato", "tom", "duracao_s",
          "views", "curtidas", "comentarios", "cliques_sacolinha", "pedidos", "obs"]

# Horários por PRIORIDADE (picos: meio-dia e depois das 18h). Pra quem posta muito
# (até 10/dia), espalha nos picos primeiro e preenche o resto do dia.
HORARIOS = ["12:00", "18:30", "19:30", "12:45", "20:30",
            "11:00", "21:00", "15:30", "17:00", "09:30",
            "13:30", "16:00", "22:00", "10:15", "14:30"]


def duracao(path):
    try:
        out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                              "-of", "default=noprint_wrappers=1:nokey=1", path],
                             capture_output=True, text=True, errors="replace")
        return round(float(out.stdout.strip()), 1)
    except Exception:
        return ""


def info_produto(arquivo):
    """Acha produtos/<slug>/config.txt pelo nome do arquivo (tira -vN do fim)."""
    slug = os.path.splitext(arquivo)[0]
    for s in (slug, slug.rsplit("-v", 1)[0]):
        p = os.path.join(DIR_PRODUTOS, s, "config.txt")
        if os.path.exists(p):
            cfg = {}
            with open(p, encoding="utf-8") as f:
                for ln in f:
                    if ":" in ln:
                        k, v = ln.split(":", 1)
                        cfg[k.strip().lower()] = v.strip()
            return cfg.get("produto", slug), cfg.get("formato", ""), cfg.get("tom", "")
    return slug, "", ""


def ler_planilha():
    if not os.path.exists(CSV_PATH):
        return []
    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def salvar_planilha(linhas):
    with open(CSV_PATH, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS, delimiter=";")
        w.writeheader()
        w.writerows(linhas)


def main():
    so_registrar = "--so-registrar" in sys.argv
    linhas = ler_planilha()
    ja = {l["arquivo"] for l in linhas}
    novos = [f for f in sorted(os.listdir(DIR_SAIDA))
             if f.lower().endswith(".mp4") and f not in ja]
    if not novos:
        print("Nenhum vídeo novo na saida/ — planilha já está em dia.")
        return

    hoje = date.today().isoformat()
    hor = sorted(HORARIOS[:len(novos)]) if len(novos) <= len(HORARIOS) else \
        sorted(HORARIOS) + [""] * (len(novos) - len(HORARIOS))

    destino = os.path.join(DIR_POSTAR, hoje)
    if not so_registrar:
        os.makedirs(destino, exist_ok=True)

    print(f"\n=== PACOTE DO DIA {hoje} — {len(novos)} vídeo(s) ===\n")
    for n, (arq, h) in enumerate(zip(novos, hor), 1):
        produto, formato, tom = info_produto(arq)
        linhas.append({"data": hoje, "horario": h, "arquivo": arq, "produto": produto,
                       "formato": formato, "tom": tom,
                       "duracao_s": duracao(os.path.join(DIR_SAIDA, arq)),
                       "views": "", "curtidas": "", "comentarios": "",
                       "cliques_sacolinha": "", "pedidos": "", "obs": ""})
        if not so_registrar:
            novo_nome = f"{n:02d}_{h.replace(':', 'h')}_{arq}" if h else f"{n:02d}_{arq}"
            shutil.copy2(os.path.join(DIR_SAIDA, arq), os.path.join(destino, novo_nome))
        print(f"  {n:02d}. {h or '--:--'}  {arq}")

    salvar_planilha(linhas)
    print(f"\nPlanilha atualizada: {CSV_PATH}")
    if not so_registrar:
        print(f"Lote pronto em: {destino}")
    print("Depois de postar, preencha views/curtidas/cliques na planilha e rode:")
    print("  python analisar.py")


if __name__ == "__main__":
    main()
