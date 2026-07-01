import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AcervoGrid } from "@/components/app/acervo-grid";
import { getCategoria } from "@/lib/acervo";
import { requireAssinatura } from "@/lib/dal";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { cat } = await getCategoria(slug, { page: 1 });
  return { title: cat ? cat.nome : "Categoria" };
}

export default async function CategoriaAcervoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAssinatura();
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q || "").trim();

  const { cat, itens, total, totalPaginas, pagina } = await getCategoria(slug, {
    page,
    q,
  });
  if (!cat) notFound();

  const linkPagina = (p: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (p > 1) usp.set("page", String(p));
    const qs = usp.toString();
    return `/painel/acervo/${slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/painel/acervo"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Acervo
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{cat.nome}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {cat.count.toLocaleString("pt-BR")} cortes - clique pra tocar ou baixar.
        </p>
      </div>

      {/* busca (form GET - recarrega com ?q=) */}
      <form method="get" className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar nesta categoria..."
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {q && (
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString("pt-BR")} resultado(s) para{" "}
          <span className="text-foreground">&quot;{q}&quot;</span>
        </p>
      )}

      {itens.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-16 text-center">
          <p className="font-medium">Nenhum vídeo encontrado</p>
          {q && (
            <Link
              href={`/painel/acervo/${slug}`}
              className="mt-2 text-sm text-primary"
            >
              Limpar busca
            </Link>
          )}
        </div>
      ) : (
        <AcervoGrid itens={itens} />
      )}

      {/* paginação (links - só 48 por página) */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {pagina > 1 ? (
            <Link
              href={linkPagina(pagina - 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50"
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground/40">
              <ChevronLeft className="size-4" />
              Anterior
            </span>
          )}

          <span className="text-sm text-muted-foreground">
            Página {pagina} de {totalPaginas}
          </span>

          {pagina < totalPaginas ? (
            <Link
              href={linkPagina(pagina + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50"
            >
              Próxima
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground/40">
              Próxima
              <ChevronRight className="size-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
