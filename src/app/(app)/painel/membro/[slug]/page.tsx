import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ArrowRight, BookOpen } from "lucide-react";
import { getEbook } from "@/lib/membro";
import { requireAssinatura } from "@/lib/dal";

// Página autenticada (o layout exige login) - sempre dinâmica.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const e = getEbook(slug);
  return { title: e ? e.titulo : "Conhecimento" };
}

export default async function EbookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAssinatura();
  const { slug } = await params;
  const ebook = getEbook(slug);
  if (!ebook) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/painel/membro"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Área do membro
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {ebook.titulo}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {ebook.descricao}
        </p>
      </div>

      {/* Vídeo do YouTube */}
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ebook.youtubeId}?playsinline=1&rel=0`}
          title={ebook.titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>

      {/* Conteúdo */}
      <article className="space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
          <BookOpen className="size-4 text-primary" />
          Conteúdo
        </div>
        {ebook.secoes.map((s) => (
          <section key={s.titulo} className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">{s.titulo}</h2>
            {s.paragrafos.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>

      {/* CTAs pras features */}
      {ebook.ctas && ebook.ctas.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4">
          <p className="w-full text-sm font-medium">Coloque em prática agora:</p>
          {ebook.ctas.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {c.label}
              <ArrowRight className="size-4" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
