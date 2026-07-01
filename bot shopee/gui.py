# -*- coding: utf-8 -*-
"""
GUI v2 da Fábrica de Vídeos - VideosIA
Abas: "Vídeo pronto" (você dá os clipes) e "Gerar com IA (Veo)" (IA cria a cena).
Monta uma FILA de produtos e gera todos em paralelo. Não trava (segundo plano).
"""
import os
import re
import shutil
import threading
import unicodedata
import concurrent.futures as cf
import customtkinter as ctk
from tkinter import filedialog, messagebox

import fabrica

BASE = os.path.dirname(os.path.abspath(__file__))
DIR_PRODUTOS = os.path.join(BASE, "produtos")
DIR_MUSICAS = os.path.join(BASE, "entrada", "musicas")
DIR_SAIDA = os.path.join(BASE, "saida")

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

TONS = {"Agressivo": "agressivo", "Equilibrado": "equilibrado", "Tranquilo": "tranquilo"}


def slug(nome):
    s = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower() or "produto"


def listar_musicas():
    if not os.path.isdir(DIR_MUSICAS):
        return []
    return [f for f in sorted(os.listdir(DIR_MUSICAS))
            if f.lower().endswith((".mp3", ".m4a", ".opus", ".wav", ".aac"))]


class Form:
    """Formulário de um produto dentro de uma aba. modo: 'video' ou 'veo'."""
    def __init__(self, parent, modo):
        self.modo = modo
        self.videos, self.imagens = [], []
        parent.grid_columnconfigure(0, weight=1)
        r = 0

        ctk.CTkLabel(parent, text="Nome do produto", anchor="w").grid(row=r, column=0, sticky="ew", padx=8, pady=(8, 0)); r += 1
        self.e_nome = ctk.CTkEntry(parent, placeholder_text="Ex: Kit Legging Fitness AQN")
        self.e_nome.grid(row=r, column=0, sticky="ew", padx=8, pady=4); r += 1

        ctk.CTkLabel(parent, text="Descrição do fornecedor", anchor="w").grid(row=r, column=0, sticky="ew", padx=8, pady=(6, 0)); r += 1
        self.t_desc = ctk.CTkTextbox(parent, height=110)
        self.t_desc.grid(row=r, column=0, sticky="ew", padx=8, pady=4); r += 1

        fbtn = ctk.CTkFrame(parent, fg_color="transparent")
        fbtn.grid(row=r, column=0, sticky="ew", padx=8, pady=6); r += 1
        fbtn.grid_columnconfigure((0, 1), weight=1)
        if modo == "video":
            ctk.CTkButton(fbtn, text="🎬 Vídeos", command=self.add_videos).grid(row=0, column=0, padx=4, sticky="ew")
            ctk.CTkButton(fbtn, text="🖼️ Imagens", command=self.add_imagens).grid(row=0, column=1, padx=4, sticky="ew")
        else:
            ctk.CTkButton(fbtn, text="🖼️ Imagens do produto", command=self.add_imagens).grid(row=0, column=0, columnspan=2, padx=4, sticky="ew")
        self.l_arq = ctk.CTkLabel(parent, text="—", anchor="w", text_color="#9aa")
        self.l_arq.grid(row=r, column=0, sticky="ew", padx=8); r += 1

        if modo == "veo":
            ctk.CTkLabel(parent, text="⚠️ A IA gera 1 cena com modelo (~US$1,75/produto)",
                         anchor="w", text_color="#e8b").grid(row=r, column=0, sticky="ew", padx=8, pady=(2, 0)); r += 1

        ctk.CTkLabel(parent, text="Formato", anchor="w").grid(row=r, column=0, sticky="ew", padx=8, pady=(6, 0)); r += 1
        self.seg_fmt = ctk.CTkSegmentedButton(parent, values=["Legenda", "Voz narrada"])
        self.seg_fmt.set("Legenda"); self.seg_fmt.grid(row=r, column=0, sticky="ew", padx=8, pady=4); r += 1

        ctk.CTkLabel(parent, text="Tom do marketing", anchor="w").grid(row=r, column=0, sticky="ew", padx=8, pady=(6, 0)); r += 1
        self.seg_tom = ctk.CTkSegmentedButton(parent, values=list(TONS))
        self.seg_tom.set("Agressivo"); self.seg_tom.grid(row=r, column=0, sticky="ew", padx=8, pady=4); r += 1

        linha = ctk.CTkFrame(parent, fg_color="transparent")
        linha.grid(row=r, column=0, sticky="ew", padx=8, pady=4); r += 1
        linha.grid_columnconfigure((0, 1), weight=1)
        ctk.CTkLabel(linha, text="Variantes").grid(row=0, column=0, sticky="w")
        self.seg_var = ctk.CTkSegmentedButton(linha, values=["1", "2", "3"])
        self.seg_var.set("1"); self.seg_var.grid(row=1, column=0, padx=(0, 4), sticky="ew")
        self.e_preco = ctk.CTkEntry(linha, placeholder_text="Preço (opcional)")
        self.e_preco.grid(row=1, column=1, sticky="ew")

        ctk.CTkLabel(parent, text="Música (início é automático)", anchor="w").grid(row=r, column=0, sticky="ew", padx=8, pady=(6, 0)); r += 1
        self.opt_mus = ctk.CTkOptionMenu(parent, values=["(primeira da pasta)"] + listar_musicas())
        self.opt_mus.grid(row=r, column=0, sticky="ew", padx=8, pady=4); r += 1

    def add_videos(self):
        fs = filedialog.askopenfilenames(filetypes=[("Vídeos", "*.mp4 *.mov *.mkv *.webm")])
        if fs: self.videos = list(fs)
        self._upd()

    def add_imagens(self):
        fs = filedialog.askopenfilenames(filetypes=[("Imagens", "*.jpg *.jpeg *.png *.webp")])
        if fs: self.imagens = list(fs)
        self._upd()

    def _upd(self):
        self.l_arq.configure(text=f"🎬 {len(self.videos)} vídeo(s) | 🖼️ {len(self.imagens)} imagem(ns)")

    def coletar(self):
        nome = self.e_nome.get().strip()
        if not nome:
            return None, "Falta o nome do produto."
        if self.modo == "video" and not self.videos:
            return None, "No modo 'Vídeo pronto' adiciona pelo menos 1 vídeo."
        if self.modo == "veo" and not self.imagens:
            return None, "No modo 'Gerar com IA' adiciona pelo menos 1 imagem."
        return dict(
            nome=nome, modo=self.modo,
            descricao=self.t_desc.get("1.0", "end").strip(),
            videos=list(self.videos), imagens=list(self.imagens),
            formato="voz" if "Voz" in self.seg_fmt.get() else "legenda",
            tom=TONS[self.seg_tom.get()], variantes=self.seg_var.get(),
            preco=self.e_preco.get().strip(),
            musica=self.opt_mus.get(),
        ), None

    def limpar(self):
        self.e_nome.delete(0, "end"); self.t_desc.delete("1.0", "end")
        self.e_preco.delete(0, "end"); self.videos = []; self.imagens = []; self._upd()


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("🏭 Fábrica de Vídeos - VideosIA")
        self.geometry("1040x780")
        self.fila = []   # lista de prod_dir
        self._build()

    def _build(self):
        self.grid_columnconfigure(0, weight=3)
        self.grid_columnconfigure(1, weight=2)
        self.grid_rowconfigure(0, weight=1)

        tabs = ctk.CTkTabview(self)
        tabs.grid(row=0, column=0, padx=12, pady=12, sticky="nsew")
        t1 = tabs.add("🎬 Vídeo pronto")
        t2 = tabs.add("🎥 Gerar com IA (Veo)")
        f1 = ctk.CTkScrollableFrame(t1, label_text="Você fornece os clipes")
        f1.pack(fill="both", expand=True)
        f2 = ctk.CTkScrollableFrame(t2, label_text="A IA cria a cena a partir das imagens")
        f2.pack(fill="both", expand=True)
        self.form_video = Form(f1, "video")
        self.form_veo = Form(f2, "veo")
        self.tabs = tabs

        for fr, form in ((f1, self.form_video), (f2, self.form_veo)):
            b = ctk.CTkButton(fr, text="➕  Adicionar à fila", height=40,
                              command=lambda fo=form: self.adicionar(fo))
            b.grid(column=0, sticky="ew", padx=8, pady=10)

        right = ctk.CTkFrame(self)
        right.grid(row=0, column=1, padx=(0, 12), pady=12, sticky="nsew")
        right.grid_rowconfigure(2, weight=1)
        right.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(right, text="🗂️  Fila de produtos", font=("", 14, "bold")).grid(row=0, column=0, padx=10, pady=(8, 4), sticky="w")
        self.l_fila = ctk.CTkLabel(right, text="(vazia)", anchor="w", justify="left")
        self.l_fila.grid(row=1, column=0, padx=10, sticky="ew")
        self.t_log = ctk.CTkTextbox(right, font=("Consolas", 12))
        self.t_log.grid(row=2, column=0, sticky="nsew", padx=10, pady=6)
        self.btn_gerar = ctk.CTkButton(right, text="🚀  GERAR TODOS DA FILA", height=46,
                                       font=("", 15, "bold"), command=self.gerar_todos)
        self.btn_gerar.grid(row=3, column=0, sticky="ew", padx=10, pady=(6, 4))
        ctk.CTkButton(right, text="📂 Abrir pasta de saída", command=self.abrir_saida).grid(row=4, column=0, sticky="ew", padx=10, pady=(0, 10))
        self.log("Pronto. Preencha um produto e clique 'Adicionar à fila'.\n")

    def log(self, m):
        self.t_log.insert("end", m); self.t_log.see("end")

    def abrir_saida(self):
        os.makedirs(DIR_SAIDA, exist_ok=True); os.startfile(DIR_SAIDA)

    def adicionar(self, form):
        d, err = form.coletar()
        if err:
            messagebox.showwarning("Faltou algo", err); return
        try:
            prod = self._criar_pasta(d)
        except Exception as e:
            messagebox.showerror("Erro", str(e)); return
        self.fila.append(prod)
        nomes = "\n".join(f"  • {os.path.basename(p)}" for p in self.fila)
        self.l_fila.configure(text=nomes)
        self.log(f"➕ Adicionado à fila: {d['nome']}\n")
        form.limpar()

    def _criar_pasta(self, d):
        prod = os.path.join(DIR_PRODUTOS, slug(d["nome"]))
        # limpa arquivos antigos de um produto com mesmo nome (evita usar vídeo velho)
        for sub in ("videos", "imagens"):
            p = os.path.join(prod, sub)
            if os.path.isdir(p):
                shutil.rmtree(p, ignore_errors=True)
        os.makedirs(os.path.join(prod, "videos"), exist_ok=True)
        os.makedirs(os.path.join(prod, "imagens"), exist_ok=True)
        for v in d["videos"]:
            shutil.copy2(v, os.path.join(prod, "videos", os.path.basename(v)))
        for im in d["imagens"]:
            shutil.copy2(im, os.path.join(prod, "imagens", os.path.basename(im)))
        with open(os.path.join(prod, "descricao.txt"), "w", encoding="utf-8") as f:
            f.write(d["descricao"])
        mus = "" if d["musica"].startswith("(") else d["musica"]
        cfg = [f"produto: {d['nome']}", f"formato: {d['formato']}", f"tom: {d['tom']}",
               f"variantes: {d['variantes']}", f"musica: {mus}", f"preco: {d['preco']}",
               f"gerar_cena: {'sim' if d['modo'] == 'veo' else 'nao'}", "plataforma: shopee"]
        with open(os.path.join(prod, "config.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(cfg) + "\n")
        return prod

    def gerar_todos(self):
        if not self.fila:
            messagebox.showinfo("Fila vazia", "Adiciona pelo menos 1 produto."); return
        self.btn_gerar.configure(state="disabled", text="⏳ Gerando...")
        fila = list(self.fila)
        self.log(f"\n=== Gerando {len(fila)} produto(s) em paralelo ===\n")
        threading.Thread(target=self._worker, args=(fila,), daemon=True).start()

    def _worker(self, fila):
        try:
            with cf.ThreadPoolExecutor(max_workers=fabrica.MAX_PARALELO) as ex:
                futs = {ex.submit(fabrica.processar, p, True): p for p in fila}
                for fut in cf.as_completed(futs):
                    nome, status = fut.result()
                    self.after(0, self.log, f"  [{nome}] {status}\n")
        except Exception as e:
            self.after(0, self.log, f"ERRO geral: {e}\n")
        self.after(0, self._fim)

    def _fim(self):
        self.btn_gerar.configure(state="normal", text="🚀  GERAR TODOS DA FILA")
        self.fila = []
        self.l_fila.configure(text="(vazia)")
        self.log("\n✅ Fila concluída! Veja os vídeos + .txt em saida/\n")


if __name__ == "__main__":
    App().mainloop()
