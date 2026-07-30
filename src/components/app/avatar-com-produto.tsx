"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, Loader2, Sparkles, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTO_AVATAR, USOS_PRODUTO, CENARIOS } from "@/lib/avatar-modelo";
import { normalizarImagem, ERRO_IMAGEM } from "@/lib/imagem-cliente";
import type { AvatarCriado } from "@/components/app/avatar-quiz";

/**
 * "Avatar com produto": junta uma PESSOA (avatar salvo OU foto enviada) com a foto
 * do PRODUTO e gera a imagem da pessoa usando o produto (segurando, passando no
 * rosto/cabelo...). POST /api/avatar/com-produto. A imagem entra na galeria.
 */

export function AvatarComProduto({
  avatares = [],
  onSair,
  onCriado,
}: {
  avatares?: AvatarCriado[];
  onSair: () => void;
  onCriado?: (a: AvatarCriado) => void;
}) {
  const [nome, setNome] = useState("");
  // fonte da pessoa: um avatar salvo ou uma foto nova
  const [fonte, setFonte] = useState<"salvo" | "foto">(avatares.length ? "salvo" : "foto");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(avatares[0]?.imagemUrl ?? null);
  const [pessoaFoto, setPessoaFoto] = useState<string | null>(null);
  const [produtoFoto, setProdutoFoto] = useState<string | null>(null);
  const [produtoNome, setProdutoNome] = useState("");
  const [uso, setUso] = useState(USOS_PRODUTO[0].chave);
  const [cenario, setCenario] = useState(CENARIOS[0].chave);
  const [genero, setGenero] = useState<"female" | "male">("female");
  const [gerando, setGerando] = useState(false);
  const inPessoa = useRef<HTMLInputElement>(null);
  const inProduto = useRef<HTMLInputElement>(null);

  const temPessoa = fonte === "salvo" ? !!avatarUrl : !!pessoaFoto;
  const pronto = nome.trim().length >= 2 && temPessoa && !!produtoFoto;

  async function ler(file: File | undefined | null, set: (v: string) => void) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    // converte pra JPEG de verdade (HEIC/AVIF com nome .jpg quebram a IA)
    const dataUrl = await normalizarImagem(file);
    if (!dataUrl) {
      toast.error(ERRO_IMAGEM);
      return;
    }
    set(dataUrl);
  }

  async function gerar() {
    if (!pronto || gerando) return;
    setGerando(true);
    try {
      const res = await fetch("/api/avatar/com-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          genero,
          uso,
          cenario,
          produtoNome: produtoNome.trim() || undefined,
          produtoFoto,
          ...(fonte === "salvo" ? { pessoaUrl: avatarUrl } : { pessoaFoto }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.erro || "Não consegui gerar a imagem.");
        return;
      }
      toast.success("Imagem criada! 🎉");
      if (data.avatar) onCriado?.(data.avatar);
      onSair();
    } catch {
      toast.error("Erro de conexão. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="rounded-[28px] border border-border bg-card p-6 sm:p-8">
      <button
        type="button"
        onClick={onSair}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar
      </button>

      <h2 className="mt-4 text-xl font-black tracking-tight">Avatar com produto</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha uma pessoa e a foto do produto. A IA gera a pessoa usando o produto,
        pronta pra virar post ou vídeo.
      </p>

      {/* nome */}
      <div className="mt-6">
        <label className="text-sm font-semibold">Nome da imagem</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Ana com o creme"
          maxLength={120}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {/* pessoa: avatar salvo ou foto nova */}
      <div className="mt-5">
        <label className="text-sm font-semibold">Quem aparece</label>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            onClick={() => setFonte("salvo")}
            disabled={!avatares.length}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40",
              fonte === "salvo"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50",
            )}
          >
            Avatar salvo
          </button>
          <button
            type="button"
            onClick={() => setFonte("foto")}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              fonte === "foto"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50",
            )}
          >
            Subir foto
          </button>
        </div>

        {fonte === "salvo" ? (
          avatares.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {avatares.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAvatarUrl(a.imagemUrl)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border-2 transition-colors",
                    avatarUrl === a.imagemUrl ? "border-primary" : "border-transparent hover:border-primary/40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imagemUrl} alt={a.nome} className="aspect-[3/4] w-full object-cover" />
                  {avatarUrl === a.imagemUrl && (
                    <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Você ainda não tem avatares salvos. Suba uma foto.
            </p>
          )
        ) : (
          <div className="mt-3">
            <input
              ref={inPessoa}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => ler(e.target.files?.[0], setPessoaFoto)}
            />
            {pessoaFoto ? (
              <div className="relative w-32 overflow-hidden rounded-2xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pessoaFoto} alt="pessoa" className="aspect-[3/4] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPessoaFoto(null)}
                  className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inPessoa.current?.click()}
                className="flex aspect-[3/4] w-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
              >
                <ImagePlus className="size-6" />
                <span className="text-[11px] font-semibold">Foto da pessoa</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* produto */}
      <div className="mt-5">
        <label className="text-sm font-semibold">Foto do produto</label>
        <input
          ref={inProduto}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => ler(e.target.files?.[0], setProdutoFoto)}
        />
        <div className="mt-1.5 flex items-start gap-3">
          {produtoFoto ? (
            <div className="relative w-32 overflow-hidden rounded-2xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={produtoFoto} alt="produto" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => setProdutoFoto(null)}
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inProduto.current?.click()}
              className="flex aspect-square w-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
            >
              <ImagePlus className="size-6" />
              <span className="text-[11px] font-semibold">Foto do produto</span>
            </button>
          )}
          <div className="flex-1">
            <input
              value={produtoNome}
              onChange={(e) => setProdutoNome(e.target.value)}
              placeholder="Nome do produto (opcional)"
              maxLength={120}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Ajuda a IA a entender o objeto. Ex: creme facial, tênis, garrafa.
            </p>
          </div>
        </div>
      </div>

      {/* genero */}
      <div className="mt-5">
        <label className="text-sm font-semibold">Gênero</label>
        <div className="mt-1.5 flex gap-2">
          {([["female", "Mulher"], ["male", "Homem"]] as const).map(([v, txt]) => (
            <button
              key={v}
              type="button"
              onClick={() => setGenero(v)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                genero === v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {/* uso */}
      <div className="mt-5">
        <label className="text-sm font-semibold">Como o produto aparece</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {USOS_PRODUTO.map((u) => (
            <button
              key={u.chave}
              type="button"
              onClick={() => setUso(u.chave)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                uso === u.chave
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* cenario (o fundo já sai na imagem: serve pro vídeo de 15s) */}
      <div className="mt-5">
        <label className="text-sm font-semibold">Cenário (fundo da imagem)</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CENARIOS.map((c) => (
            <button
              key={c.chave}
              type="button"
              onClick={() => setCenario(c.chave)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                cenario === c.chave
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          A pessoa já sai com esse fundo. Bom pra depois virar vídeo de 15s.
        </p>
      </div>

      {/* gerar */}
      <div className="mt-6">
        <button
          type="button"
          onClick={gerar}
          disabled={!pronto || gerando}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition-all",
            pronto && !gerando
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {gerando ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {gerando ? "Gerando a imagem..." : `Gerar imagem (${CUSTO_AVATAR} créditos)`}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {gerando
            ? "A IA está montando a imagem. Leva alguns segundos. ✨"
            : "Dica: foto do produto limpa e bem iluminada sai melhor."}
        </p>
      </div>
    </div>
  );
}
