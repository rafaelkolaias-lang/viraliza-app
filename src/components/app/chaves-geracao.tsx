"use client";

import { useState } from "react";
import { Image as ImageIcon, Video, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Chave geral da geração (só admin, no Diagnóstico): desliga a criação de imagem
 * e/ou de vídeo na hora, sem deploy. Serve pra quando o motor está fora do ar ou
 * batendo cota: em vez da galera gastar tentativa e abrir reporte, a tela avisa
 * que está em manutenção.
 */

function Chave({
  titulo,
  descricao,
  Icone,
  ligado,
  ocupado,
  onMudar,
}: {
  titulo: string;
  descricao: string;
  Icone: typeof ImageIcon;
  ligado: boolean;
  ocupado: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3.5 transition-colors",
        ligado ? "border-border/60 bg-card/60" : "border-destructive/40 bg-destructive/5",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          ligado ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive",
        )}
      >
        <Icone className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">
          {ligado ? descricao : "PAUSADO: ninguém consegue gerar agora."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        disabled={ocupado}
        onClick={() => onMudar(!ligado)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
          ligado ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 grid size-5 place-items-center rounded-full bg-white transition-all",
            ligado ? "left-[22px]" : "left-0.5",
          )}
        >
          {ocupado && <Loader2 className="size-3 animate-spin text-black/60" />}
        </span>
      </button>
    </div>
  );
}

export function ChavesGeracao({
  imagemInicial,
  videoInicial,
}: {
  imagemInicial: boolean;
  videoInicial: boolean;
}) {
  const [imagem, setImagem] = useState(imagemInicial);
  const [video, setVideo] = useState(videoInicial);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function mudar(chave: "geracao_imagem" | "geracao_video", ligado: boolean) {
    setOcupado(chave);
    // otimista: a chave vira na hora e volta se der erro
    if (chave === "geracao_imagem") setImagem(ligado);
    else setVideo(ligado);
    try {
      const r = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chave, ligado }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      setImagem(!!d.imagem);
      setVideo(!!d.video);
      toast.success(
        `${chave === "geracao_imagem" ? "Imagens" : "Vídeos"}: ${ligado ? "geração liberada" : "geração pausada"}`,
      );
    } catch (e) {
      if (chave === "geracao_imagem") setImagem(!ligado);
      else setVideo(!ligado);
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Power className="size-4 text-primary" />
        <h2 className="font-semibold">Chave geral da geração</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Desliga a geração na hora, sem deploy. Use quando o motor estiver fora do ar
        ou batendo cota: a pessoa vê um aviso de manutenção em vez de gastar
        tentativa. Créditos nunca são cobrados quando falha.
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Chave
          titulo="Geração de imagens"
          descricao="Lab, avatares e avatar com produto."
          Icone={ImageIcon}
          ligado={imagem}
          ocupado={ocupado === "geracao_imagem"}
          onMudar={(v) => mudar("geracao_imagem", v)}
        />
        <Chave
          titulo="Geração de vídeos"
          descricao="Vídeo com avatar, vídeo livre e Lab."
          Icone={Video}
          ligado={video}
          ocupado={ocupado === "geracao_video"}
          onMudar={(v) => mudar("geracao_video", v)}
        />
      </div>
    </section>
  );
}
