# -*- coding: utf-8 -*-
"""
IMPORTAR PRODUTO POR PRINT - tira print da página da Shopee (Win+Shift+S), salva e:

  python importar.py caminho\print1.png [print2.png ...]

O Gemini LÊ o print (nome, preço, vendidos, avaliação), JULGA se o produto está em
alta (vale fazer vídeo?) e CRIA a pasta produtos/<slug>/ pronta com config.txt e
descricao.txt. Depois é só jogar as fotos do produto em imagens/ (clique direito >
salvar imagem na galeria da Shopee) e rodar a fábrica ou usar a GUI.
"""
import os
import re
import sys
import unicodedata

import gemini_copy

BASE = os.path.dirname(os.path.abspath(__file__))
DIR_PRODUTOS = os.path.join(BASE, "produtos")


def slugify(nome, max_len=60):
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:max_len].rstrip("-") or "produto"


def main():
    prints_paths = [a for a in sys.argv[1:] if os.path.exists(a)]
    if not prints_paths:
        print(__doc__)
        return
    prints = []
    for p in prints_paths:
        with open(p, "rb") as f:
            b = f.read()
        mime = "image/png" if p.lower().endswith(".png") else "image/jpeg"
        prints.append((b, mime))

    print(f"Analisando {len(prints)} print(s) com o Gemini...")
    d = gemini_copy.analisar_produto_print(prints)

    alta = "SIM 🔥" if d.get("em_alta") else "não"
    print(f"""
=== ANÁLISE DO PRODUTO ===
Produto:    {d.get('produto', '?')}
Preço:      {d.get('preco', '?')}
Vendidos:   {d.get('vendidos', '?')}
Avaliação:  {d.get('avaliacao', '?')}
Público:    {d.get('publico', '?')}

EM ALTA?    {alta}  (potencial: {d.get('potencial', '?')}/10)
Motivo:     {d.get('motivo', '')}
""")

    slug = slugify(d.get("produto", "produto"))
    prod_dir = os.path.join(DIR_PRODUTOS, slug)
    os.makedirs(os.path.join(prod_dir, "imagens"), exist_ok=True)
    os.makedirs(os.path.join(prod_dir, "videos"), exist_ok=True)

    with open(os.path.join(prod_dir, "config.txt"), "w", encoding="utf-8") as f:
        f.write(f"""produto: {d.get('produto', slug)}
formato: legenda
tom: equilibrado
variantes: 1
musica:
preco: {d.get('preco', '')}
gerar_cena: nao
plataforma: shopee
""")
    with open(os.path.join(prod_dir, "descricao.txt"), "w", encoding="utf-8") as f:
        f.write(d.get("descricao", "") + "\n")

    print(f"Pasta criada: {prod_dir}")
    print("Agora: salve as fotos do produto em imagens\\ (e vídeo em videos\\, se tiver),")
    print("ajuste o config.txt se quiser (musica, tom, variantes, gerar_cena) e rode:")
    print(f"  python fabrica.py {slug}")


if __name__ == "__main__":
    main()
