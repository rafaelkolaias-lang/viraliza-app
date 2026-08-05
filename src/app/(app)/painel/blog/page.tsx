import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Newspaper, Clock, Lock, Crown } from "lucide-react";
import { requireUser, assinaturaAtiva } from "@/lib/dal";
import { EmBreve } from "@/components/app/em-breve";
import { blogTemArtigos, listarArtigos, dataDoArtigo } from "@/lib/blog";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

/**
 * Blog da plataforma (ocupa o lugar da antiga aba "Apoie o projeto").
 *
 * Sem nenhum artigo em `lib/blog.ts`, a tela é o "EM BREVE" (mesmo padrão do
 * Viraliza Academy). Assim que o primeiro artigo entrar na lista, esta página
 * vira a listagem sozinha, sem precisar mexer aqui.
 */
export default async function BlogPage() {
  const user = await requireUser();

  if (!blogTemArtigos()) {
    return (
      <EmBreve
        etiqueta="Conteúdo novo toda semana"
        titulo="Blog"
        destaque="Viraliza"
        Icone={Newspaper}
        descricao="Artigos rápidos com o que está funcionando agora: produtos em alta, formatos de vídeo que convertem e novidades da plataforma antes de todo mundo."
        itens={[
          {
            titulo: "Tendências da semana",
            texto: "O que está bombando na Shopee e no TikTok Shop pra você sair na frente.",
          },
          {
            titulo: "Dicas de quem vende",
            texto: "Táticas práticas de criativo, gancho e postagem testadas por afiliados de verdade.",
          },
          {
            titulo: "Novidades da plataforma",
            texto: "Cada ferramenta nova explicada com exemplo de uso real, direto da equipe.",
          },
        ]}
        rodape="Assim que o primeiro artigo sair, o aviso chega no sininho."
      />
    );
  }

  const artigos = listarArtigos();
  const assinante = await assinaturaAtiva(user);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que está funcionando agora pra vender com vídeo: tendências, táticas de criativo
          e as novidades da plataforma.
          {!assinante && " Os artigos marcados como exclusivos abrem completos pra assinantes."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {artigos.map((a) => (
          <Link
            key={a.slug}
            href={`/painel/blog/${a.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition-colors hover:border-primary/40 hover:bg-card"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-primary/10">
              {a.capa ? (
                <Image
                  src={a.capa}
                  alt={a.titulo}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 340px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="grid size-full place-items-center text-primary/60">
                  <Newspaper className="size-8" />
                </span>
              )}
              {a.exclusivo && (
                <span
                  className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur ${
                    assinante
                      ? "bg-primary/20 text-primary"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {assinante ? <Crown className="size-3" /> : <Lock className="size-3" />}
                  {assinante ? "Exclusivo" : "Só pra assinantes"}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-4">
              <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
                {a.categoria}
              </span>
              <h2 className="mt-1 text-sm font-semibold leading-snug">{a.titulo}</h2>
              <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
                {a.resumo}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                <span>{dataDoArtigo(a.publicadoEm)}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {a.minutos} min
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
