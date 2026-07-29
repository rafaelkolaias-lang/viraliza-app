"use client";

import { useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type AvatarAdminDTO = {
  id: string;
  nome: string;
  genero: string;
  imagemUrl: string;
  origem: string; // "quiz" | "foto" | "produto" | "upload"
  criadoEm: string;
  usuario: string;
  email: string;
};

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ORIGEM: Record<string, { label: string; cls: string }> = {
  quiz: { label: "Criado do zero", cls: "bg-primary/90 text-primary-foreground" },
  foto: { label: "Da foto dele", cls: "bg-blue-500/90 text-white" },
  produto: { label: "Com produto", cls: "bg-amber-500/90 text-black" },
  upload: { label: "Upload (grátis)", cls: "bg-muted-foreground/80 text-background" },
};

/** Galeria admin: todos os avatares, com quem fez, origem e data. Filtro local. */
export function AdminAvatares({ avatares }: { avatares: AvatarAdminDTO[] }) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const visiveis = useMemo(
    () =>
      termo
        ? avatares.filter(
            (a) =>
              a.usuario.toLowerCase().includes(termo) ||
              a.email.toLowerCase().includes(termo) ||
              a.nome.toLowerCase().includes(termo),
          )
        : avatares,
    [avatares, termo],
  );

  if (avatares.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
        <UserRound className="size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nenhum avatar ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Quando os usuários criarem ou subirem avatares, aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 sm:max-w-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por usuário, e-mail ou nome do avatar..."
          className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visiveis.map((a) => {
          const o = ORIGEM[a.origem] ?? ORIGEM.quiz;
          return (
            <div key={a.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.imagemUrl} alt={a.nome} className="size-full object-cover" />
                <span
                  className={cn(
                    "absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-bold",
                    o.cls,
                  )}
                >
                  {o.label}
                </span>
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-medium" title={a.nome}>
                  {a.nome}
                </p>
                <p className="truncate text-[11px] text-primary">{a.usuario}</p>
                <p className="truncate text-[10px] text-muted-foreground">{a.email}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                  {fmtData.format(new Date(a.criadoEm))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
