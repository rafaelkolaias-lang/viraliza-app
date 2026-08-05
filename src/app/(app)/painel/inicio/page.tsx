import type { Metadata } from "next";
import Link from "next/link";
import { Gem, Play } from "lucide-react";
import { assinaturaAtiva, requireUser } from "@/lib/dal";
import { getCarteira } from "@/lib/creditos";
import { contarVideosDoUsuario } from "@/lib/jobs";
import { getTotalVirais } from "@/lib/virais";
import { getTotalProdutos } from "@/lib/produtos";
import { getCategorias, getTotalAcervo } from "@/lib/acervo";
import { blogTemArtigos } from "@/lib/blog";
import { HeroHub } from "@/components/hub/hero-hub";
import { InicioAtalhos, InicioCatalogo } from "@/components/app/inicio-hub";
import { EBOOKS } from "@/lib/membro";

export const metadata: Metadata = { title: "Início" };
export const dynamic = "force-dynamic";

/**
 * Início: o mapa da plataforma inteira.
 *
 * Regra desta tela: TUDO que existe pro usuário aparece aqui, inclusive o que
 * está travado (biblioteca sem assinatura) e o que ainda não abriu (Academy,
 * Blog). O que está travado ganha uma etiqueta em vez de sumir, senão a pessoa
 * nem descobre que aquilo existe pra querer assinar.
 *
 * Quando entrar ferramenta nova na plataforma, ela entra no catálogo em
 * `components/app/inicio-hub.tsx` (é o único lugar a mexer aqui).
 */
export default async function InicioPage() {
  const user = await requireUser();

  const [
    carteira,
    liberado,
    videos,
    totalVirais,
    totalProdutos,
    totalAcervo,
    categorias,
  ] = await Promise.all([
    getCarteira(user.id),
    assinaturaAtiva(user),
    contarVideosDoUsuario(user.id),
    getTotalVirais(),
    getTotalProdutos(),
    getTotalAcervo(),
    getCategorias(),
  ]);

  // Texto da tarjinha de assinatura. Admin e demo contam como ativa e podem não
  // ter data nenhuma (`assinaturaAte` null = não vence), por isso os 3 casos.
  const vence = carteira.assinaturaAte;
  const assinaturaTexto = !liberado
    ? "Sem assinatura ativa"
    : vence
      ? `Assinatura até ${vence.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          timeZone: "America/Sao_Paulo",
        })}`
      : "Assinatura ativa";

  return (
    <div className="space-y-8">
      <HeroHub
        nome={user.nome}
        saldoCentavos={carteira.saldoCentavos}
        assinaturaTexto={assinaturaTexto}
        assinaturaAtiva={liberado}
        prontos={videos.prontos}
        emProducao={videos.emProducao}
      />

      <InicioAtalhos />

      <InicioCatalogo
        bibliotecaLiberada={liberado}
        blogTemArtigo={blogTemArtigos()}
        totalVirais={totalVirais}
        totalProdutos={totalProdutos}
        totalAcervo={totalAcervo}
        totalCategorias={categorias.length}
      />

      {/* Os ebooks da Área Membro ficam por último, com a capa de cada um: é o
          único conteúdo da tela que vale mais como imagem do que como texto. */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Gem className="size-5 text-primary" />
            Ebooks da Área Membro
          </h2>
          <p className="text-sm text-muted-foreground">
            Material pra você vender mais. Clique numa capa pra ler.
          </p>
        </div>

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
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
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
    </div>
  );
}
