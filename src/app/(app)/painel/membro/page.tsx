import type { Metadata } from "next";
import Link from "next/link";
import { Gem, MonitorDown, Play } from "lucide-react";
import { MateriaisLista } from "@/components/app/materiais-lista";
import { BaixarBotoes } from "@/components/app/baixar-botoes";
import { getMateriais } from "@/lib/materiais";
import { getCurrentUser, requireAssinatura } from "@/lib/dal";
import { EBOOKS } from "@/lib/membro";

export const metadata: Metadata = { title: "Área do membro" };

// sempre lê os materiais frescos (admin pode ter acabado de adicionar)
export const dynamic = "force-dynamic";

export default async function MembroPage() {
  await requireAssinatura();
  const materiais = getMateriais();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {/* Cabeçalho */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Gem className="size-6 text-primary" />
          Área do membro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprenda a vender, baixe os pacotes e leve a fábrica pro seu PC.
        </p>
      </div>

      {/* Conhecimento (ebooks + tutoriais) */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          Conhecimento
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {EBOOKS.map((e) => (
            <Link
              key={e.slug}
              href={`/painel/membro/${e.slug}`}
              className="group block"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-lg group-hover:shadow-primary/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.cover}
                  alt={e.titulo}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="grid size-11 place-items-center rounded-full bg-primary/90">
                    <Play className="size-5 fill-primary-foreground text-primary-foreground" />
                  </span>
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight">
                {e.titulo}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Materiais pra baixar */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          Materiais pra baixar
        </h2>
        <MateriaisLista materiais={materiais} isAdmin={isAdmin} />
      </section>

      {/* App de computador */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          App de computador
        </h2>
        <div className="grain bg-grid-glow relative overflow-hidden rounded-2xl border border-border p-6 text-center sm:p-8">
          <div className="relative z-10 flex flex-col items-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/12">
              <MonitorDown className="size-7 text-primary" />
            </span>
            <h3 className="mt-4 text-xl font-semibold tracking-tight">
              Leve a fábrica pro seu computador
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              O app roda a geração localmente - mais rápido e com os vídeos prontos
              direto na sua máquina.
            </p>
            <div className="mt-5 w-full max-w-sm">
              <BaixarBotoes />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Windows 10/11 · macOS 12+ · grátis
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
