"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, CheckCheck, X, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ViralCard } from "@/components/app/viral-card";
import { Paginacao } from "@/components/app/paginacao";
import { excluirViral } from "@/app/actions/virais";
import { midiaUrl, linkBaixar } from "@/lib/utils";
import type { ViralVideo } from "@/lib/types";

/**
 * Grade paginada NO SERVIDOR: recebe só os itens da página atual + o total. Troca
 * de página navega pela URL (?page=), então o servidor busca só aquela fatia (nunca
 * carrega os milhares de uma vez). Seleção/baixar valem pra página atual.
 */
export function ViraisGaleria({
  itens,
  total,
  pagina,
  porPagina,
  baseHref,
  isAdmin = false,
}: {
  itens: ViralVideo[];
  total: number;
  pagina: number;
  porPagina: number;
  baseHref: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [excluindo, startExcluir] = useTransition();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  function irPara(p: number) {
    const sep = baseHref.includes("?") ? "&" : "?";
    router.push(`${baseHref}${sep}page=${p}`);
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
    if (selecionados.size === itens.length) setSelecionados(new Set());
    else setSelecionados(new Set(itens.map((v) => v.id)));
  }

  function baixarSelecionados() {
    const escolhidos = itens.filter((v) => selecionados.has(v.id) && v.arquivo);
    if (escolhidos.length === 0) {
      toast.info("Selecione vídeos desta página pra baixar.");
      return;
    }
    escolhidos.forEach((v, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        // linkBaixar força o download de verdade (funciona no celular)
        a.href = linkBaixar(midiaUrl(v.arquivo), v.titulo)!;
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 400);
    });
    toast.success(`Baixando ${escolhidos.length} vídeo(s) em qualidade total...`);
  }

  const total_sel = selecionados.size;

  if (total === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
        <Flame className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nenhum vídeo aqui ainda</p>
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
          {selecionados.size === itens.length
            ? "Limpar seleção"
            : "Selecionar a página"}
        </Button>
        <Button size="sm" disabled={total_sel === 0} onClick={baixarSelecionados}>
          <DownloadCloud className="size-4" />
          Baixar selecionados{total_sel > 0 ? ` (${total_sel})` : ""}
        </Button>
        {total_sel > 0 && (
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

      {/* Grade (página atual, vinda do servidor) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {itens.map((v) => (
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
