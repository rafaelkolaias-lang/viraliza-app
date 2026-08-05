import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Crown, Newspaper } from "lucide-react";
import { requireUser, assinaturaAtiva } from "@/lib/dal";
import { BlogBlocos } from "@/components/app/blog-blocos";
import { BlogLeitura } from "@/components/app/blog-leitura";
import { artigoPorSlug, dataDoArtigo, outrosArtigos, podeLerCompleto } from "@/lib/blog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artigo = artigoPorSlug(slug);
  return { title: artigo ? `${artigo.titulo} · Blog` : "Blog" };
}

/**
 * Leitura de um artigo do blog.
 *
 * O PAYWALL é decidido AQUI, no servidor: quando o artigo é exclusivo e a
 * assinatura não está ativa, o `conteudo` nem é enviado pro navegador. A pessoa
 * lê a prévia, clica em "Continuar lendo" e recebe o convite pra assinar.
 */
export default async function ArtigoBlogPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const artigo = artigoPorSlug(slug);
  if (!artigo) notFound();

  const assinante = await assinaturaAtiva(user);
  const liberado = podeLerCompleto(artigo, assinante);
  const outros = outrosArtigos(artigo.slug);

  return (
    <article className="mx-auto w-full max-w-3xl">
      <Link
        href="/painel/blog"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Voltar pro blog
      </Link>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
            {artigo.categoria}
          </span>
          {artigo.exclusivo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Crown className="size-3" />
              Exclusivo pra assinantes
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{artigo.titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{artigo.resumo}</p>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground/70">
          <span>{dataDoArtigo(artigo.publicadoEm)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {artigo.minutos} min de leitura
          </span>
        </div>
      </header>

      {artigo.capa && (
        <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl border border-border/60 bg-primary/10">
          <Image
            src={artigo.capa}
            alt={artigo.titulo}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      {/* prévia: aberta pra qualquer usuário logado */}
      <div className="mt-6">
        <BlogBlocos blocos={artigo.previa} />
      </div>

      {/* o resto do texto só viaja pro navegador de quem pode ler */}
      <BlogLeitura restante={liberado ? artigo.conteudo : []} bloqueado={!liberado} />

      {outros.length > 0 && (
        <section className="mt-10 border-t border-border/60 pt-6">
          <h2 className="text-sm font-semibold">Continue por aqui</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {outros.map((o) => (
              <Link
                key={o.slug}
                href={`/painel/blog/${o.slug}`}
                className="rounded-2xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <Newspaper className="size-4 text-primary" />
                <p className="mt-2 text-sm font-medium leading-snug">{o.titulo}</p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  {o.minutos} min de leitura
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
