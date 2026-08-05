"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlogBlocos } from "@/components/app/blog-blocos";
import type { BlocoArtigo } from "@/lib/blog";

/**
 * Fim da prévia do artigo: o botão "Continuar lendo" e o que acontece ao clicar.
 *
 * - Leitor LIBERADO (artigo aberto ou assinatura ativa): o clique abre o resto
 *   do texto, que já veio pronto do servidor.
 * - Leitor BLOQUEADO (artigo exclusivo, sem assinatura): o `restante` chega
 *   VAZIO de propósito (o servidor não manda o texto pago pro navegador de quem
 *   não pode ler) e o clique mostra o convite pra assinar.
 */
export function BlogLeitura({
  restante,
  bloqueado,
}: {
  restante: BlocoArtigo[];
  bloqueado: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  // artigo curto e liberado (só a prévia existe): não tem o que continuar
  if (!bloqueado && restante.length === 0) return null;

  if (aberto && !bloqueado) {
    return (
      <div className="mt-4">
        <BlogBlocos blocos={restante} />
      </div>
    );
  }

  return (
    <div className="relative mt-2">
      {/* véu por cima do fim da prévia: dá a sensação de que o texto continua */}
      <span className="pointer-events-none absolute inset-x-0 -top-28 h-28 bg-gradient-to-t from-background to-transparent" />

      {aberto && bloqueado ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-6 py-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-500/15">
            <Lock className="size-7 text-amber-400" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">
            O resto deste artigo é pra assinantes
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Sua assinatura não está ativa. Assine (ou renove) pra ler os artigos completos,
            junto com o acervo de cortes, os vídeos virais e a área do membro.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button render={<Link href="/painel/assinatura" />}>
              <Crown className="size-4" />
              Assinar e continuar lendo
            </Button>
            <Button
              variant="ghost"
              render={<Link href="/painel/blog" />}
            >
              Ver outros artigos
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <Button onClick={() => setAberto(true)}>
            <BookOpen className="size-4" />
            Continuar lendo
          </Button>
          {bloqueado && (
            <p className="text-xs text-muted-foreground">
              A parte final deste artigo é exclusiva pra assinantes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
