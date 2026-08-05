"use client";

import { useEffect, useState } from "react";
import { Upload, UserRound, Download, Trash2, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { linkBaixar } from "@/lib/utils";
import type { AvatarCriado } from "@/lib/avatar-modelo";
import { avatarCriandoAgora } from "@/components/app/avatar-criar";
import { AVATARES_PRONTOS } from "@/lib/avatares-prontos";
import { AvatarSubir } from "@/components/app/avatar-subir";

/**
 * FRONT do "Meus avatares": a galeria de influenciadores da pessoa, em cards
 * grandes (a foto é o que importa aqui, não o texto).
 *
 * Esta tela é SÓ a galeria. Os três caminhos de criação com IA moram em
 * `/painel/meus-avatares/criar` e os cenários em `/painel/meus-avatares/cenarios`,
 * cada um no seu endereço, alcançáveis pelo menu retrátil "Personalize com IA".
 * Antes tudo isso convivia aqui, em abas e links miúdos, e ninguém achava.
 *
 * O único formulário que continua AQUI é o "Enviar imagem": ele não usa IA, não
 * gasta crédito e o resultado entra direto na lista logo abaixo, então tirar a
 * pessoa da galeria pra isso seria caminho a mais por nada.
 */

type Modo = null | "subir";

/** Card grande da galeria: foto em cima, nome e ficha embaixo. */
function CardAvatar({
  nome,
  ficha,
  imagemUrl,
  onExcluir,
  excluindo,
}: {
  nome: string;
  ficha?: string;
  imagemUrl: string;
  onExcluir?: () => void;
  excluindo?: boolean;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-[0_0_30px_-12px_var(--color-primary)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagemUrl}
          alt={nome}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="truncate text-sm font-semibold">{nome}</p>
        {ficha && (
          <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{ficha}</p>
        )}
        <div className="mt-auto flex items-center justify-end gap-1 pt-2">
          <a
            href={linkBaixar(imagemUrl, `${nome || "avatar"}.png`)}
            title="Baixar"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download className="size-4" />
          </a>
          {onExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              disabled={excluindo}
              title="Excluir"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              {excluindo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Topo da tela: identidade da area. */
function Cabecalho() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary shadow-[0_0_24px_-6px_var(--color-primary)]">
        <Palette className="size-5" />
      </span>
      <div>
        <h1 className="text-xl font-black tracking-tight sm:text-2xl">Galeria de avatares</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Os influenciadores que você pode usar nos seus vídeos
        </p>
      </div>
    </div>
  );
}

export function MeusAvatares({ avataresIniciais = [] }: { avataresIniciais?: AvatarCriado[] }) {
  const [modo, setModo] = useState<Modo>(null);
  const [avatares, setAvatares] = useState<AvatarCriado[]>(avataresIniciais);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  // tem uma criação longa rodando (a pessoa saiu da tela no meio): a lista se
  // atualiza sozinha até o influenciador novo chegar
  const [criandoAgora, setCriandoAgora] = useState(false);

  useEffect(() => {
    if (!avatarCriandoAgora()) return;
    setCriandoAgora(true);
    const qtdInicial = avataresIniciais.length;
    const t = setInterval(async () => {
      if (!avatarCriandoAgora()) {
        // a marca sumiu (terminou ou expirou): busca uma última vez e para
        clearInterval(t);
        setCriandoAgora(false);
      }
      try {
        const r = await fetch("/api/avatar", { cache: "no-store" });
        const d = await r.json();
        if (Array.isArray(d?.avatares)) {
          setAvatares(d.avatares);
          if (d.avatares.length > qtdInicial) {
            clearInterval(t);
            setCriandoAgora(false);
            toast.success("Seu influenciador ficou pronto!");
          }
        }
      } catch {
        // rede piscou: tenta no próximo ciclo
      }
    }, 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aoCriar = (a: AvatarCriado) => {
    setAvatares((prev) => [a, ...prev]);
    setModo(null);
  };

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"? Os vídeos já feitos com ele continuam funcionando.`)) return;
    setExcluindo(id);
    try {
      const r = await fetch(`/api/avatar/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui excluir.");
      setAvatares((prev) => prev.filter((a) => a.id !== id));
      toast.success("Influenciador excluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui excluir.");
    } finally {
      setExcluindo(null);
    }
  }

  // ===== envio de imagem pronta (não usa IA, não cobra) =====
  if (modo === "subir") {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <AvatarSubir onSair={() => setModo(null)} onCriado={aoCriar} />
      </div>
    );
  }

  // ===== galeria =====
  return (
    <div className="relative w-full space-y-5">
      <Cabecalho />

      {/* criação longa em andamento: a lista se atualiza sozinha */}
      {criandoAgora && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <Loader2 className="size-4.5 shrink-0 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              Influenciador sendo criado agora.
            </span>{" "}
            Ele aparece aqui sozinho em 1 a 3 minutos, não precisa criar de novo.
          </p>
        </div>
      )}

      {/* ===== AÇÕES =====
          Só o "Enviar imagem" mora aqui. Criar com IA saiu de propósito: é um
          atalho do menu "Personalize com IA", e repetir o botão na galeria dava
          dois caminhos pro mesmo lugar. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModo("subir")}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50"
        >
          <Upload className="size-4" />
          Enviar imagem
        </button>
      </div>

      {/* ===== GALERIA ===== */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Seus influenciadores</h2>
        {avatares.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {avatares.map((a) => (
              <CardAvatar
                key={a.id}
                nome={a.nome}
                ficha={a.ficha}
                imagemUrl={a.imagemUrl}
                excluindo={excluindo === a.id}
                onExcluir={() => excluir(a.id, a.nome)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
              <UserRound className="size-6" />
            </span>
            <p className="font-medium">Nenhum influenciador seu por aqui ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Envie a imagem de alguém que você já tem, aqui em cima, ou use o{" "}
              <strong className="text-foreground">Criar com IA</strong> no menu da
              esquerda. Ele passa a aparecer na hora de gerar seus vídeos.
            </p>
          </div>
        )}
      </div>

      {/* ===== PRONTOS DA PLATAFORMA ===== */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Influenciadores da plataforma</h2>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
            Grátis
          </span>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground">
          Já vêm com a plataforma e todo mundo pode usar nos vídeos, sem gastar nada.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {AVATARES_PRONTOS.map((a) => (
            <CardAvatar key={a.id} nome={a.nome} imagemUrl={a.src} />
          ))}
        </div>
      </div>
    </div>
  );
}
