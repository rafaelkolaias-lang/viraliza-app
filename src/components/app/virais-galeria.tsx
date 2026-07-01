"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, CheckCheck, X, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ViralCard } from "@/components/app/viral-card";
import { Paginacao } from "@/components/app/paginacao";
import { excluirViral } from "@/app/actions/virais";
import { midiaUrl } from "@/lib/utils";
import type { ViralVideo } from "@/lib/types";

const POR_PAGINA = 30;

export function ViraisGaleria({
  videos,
  isAdmin = false,
}: {
  videos: ViralVideo[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [excluindo, startExcluir] = useTransition();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.ceil(videos.length / POR_PAGINA);
  const visiveis = videos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  function irPara(p: number) {
    setPagina(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function excluir(video: ViralVideo) {
    if (!confirm(`Excluir "${video.titulo}"? Isso some pra todos os usuários.`)) {
      return;
    }
    startExcluir(async () => {
      const res = await excluirViral(video.id);
      if (res?.erro) {
        toast.error(res.erro);
        return;
      }
      setSelecionados((prev) => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
      toast.success("Vídeo excluído.");
      router.refresh();
    });
  }

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodos() {
    if (selecionados.size === videos.length) setSelecionados(new Set());
    else setSelecionados(new Set(videos.map((v) => v.id)));
  }

  function baixarSelecionados() {
    const itens = videos.filter((v) => selecionados.has(v.id) && v.arquivo);
    if (itens.length === 0) {
      toast.info("Os vídeos ficam disponíveis quando o bot do Telegram rodar.");
      return;
    }
    // baixa em sequência (qualidade original, arquivo direto)
    itens.forEach((v, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = midiaUrl(v.arquivo)!;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 400);
    });
    toast.success(`Baixando ${itens.length} vídeo(s) em qualidade total...`);
  }

  const total = selecionados.size;

  if (videos.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
        <Flame className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nenhum vídeo viral ainda</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Assim que o bot do Telegram baixar vídeos novos, eles aparecem aqui
          automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={selecionarTodos}>
          <CheckCheck className="size-4" />
          {selecionados.size === videos.length
            ? "Limpar seleção"
            : "Selecionar todos"}
        </Button>
        <Button size="sm" disabled={total === 0} onClick={baixarSelecionados}>
          <DownloadCloud className="size-4" />
          Baixar selecionados{total > 0 ? ` (${total})` : ""}
        </Button>
        {total > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelecionados(new Set())}
          >
            <X className="size-4" />
            Cancelar
          </Button>
        )}
      </div>

      {/* Grade (página atual) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visiveis.map((v) => (
          <ViralCard
            key={v.id}
            video={v}
            selected={selecionados.has(v.id)}
            onToggle={() => toggle(v.id)}
            isAdmin={isAdmin}
            onExcluir={() => excluir(v)}
            excluindo={excluindo}
          />
        ))}
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={irPara} />
    </div>
  );
}
