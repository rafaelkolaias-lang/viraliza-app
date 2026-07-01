import type { Metadata } from "next";
import Link from "next/link";
import { Gem, Play, LayoutGrid, Wrench } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { getTotalVirais } from "@/lib/virais";
import { getTotalProdutos } from "@/lib/produtos";
import { HeroHub } from "@/components/hub/hero-hub";
import { CategoriaCard } from "@/components/hub/categoria-card";
import { EBOOKS } from "@/lib/membro";

export const metadata: Metadata = { title: "Início" };
export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

export default async function InicioPage() {
  const user = await requireUser();
  const [totalCortes, totalProdutos] = await Promise.all([
    getTotalVirais(),
    getTotalProdutos(),
  ]);

  // Ferramentas - cada carta abre (ou abrirá) a ferramenta.
  const ferramentas = [
    {
      titulo: "Editor automático",
      subtitulo: "Crie um vídeo",
      capa: "/capas/editor.png",
      href: "/painel/novo",
      emBreve: false,
    },
    {
      titulo: "Cortes de qualquer vídeo",
      subtitulo: "Cole o link e corte",
      capa: "/capas/cortes-auto.png",
      href: "/painel/cortes",
      emBreve: false,
    },
    {
      titulo: "MapsLeads",
      subtitulo: "Captação de leads",
      capa: "/capas/mapsleads.png",
      href: "/painel/leads",
      emBreve: false,
    },
  ];

  // Coleções da vitrine - cada carta abre o acervo daquela origem.
  // Por enquanto só a Shopee tem conteúdo; as outras ficam "Em breve".
  const colecoes = [
    {
      titulo: "Shopee",
      subtitulo: `+${fmt(totalCortes)} vídeos · +${fmt(totalProdutos)} produtos`,
      capa: "/capas/shopee.png",
      href: "/painel/shopee",
      emBreve: false,
    },
    {
      titulo: "Acervo de cortes",
      subtitulo: "+19 mil · filmes, séries, podcasts, memes",
      capa: "/capas/acervo.png",
      href: "/painel/acervo",
      emBreve: false,
    },
    {
      titulo: "Cortes do YouTube",
      subtitulo: "Cortes virais",
      capa: "/capas/youtube.png",
      href: "/painel/acervo",
      emBreve: false,
    },
    {
      titulo: "Reels do Instagram",
      subtitulo: "Cortes virais",
      capa: "/capas/instagram.png",
      href: "/painel/acervo",
      emBreve: false,
    },
    {
      titulo: "Vídeos do TikTok",
      subtitulo: "Cortes virais",
      capa: "/capas/tiktok.png",
      href: "/painel/acervo",
      emBreve: false,
    },
  ];

  return (
    <div className="space-y-8">
      <HeroHub
        nome={user.nome}
        totalCortes={totalCortes}
        totalProdutos={totalProdutos}
      />

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <LayoutGrid className="size-5 text-primary" />
            Explore o acervo
          </h2>
          <p className="text-sm text-muted-foreground">
            Clique numa capa pra ver todos os vídeos da coleção.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {colecoes.map((c) => (
            <CategoriaCard
              key={c.titulo}
              href={c.href}
              titulo={c.titulo}
              subtitulo={c.subtitulo}
              capa={c.capa}
              emBreve={c.emBreve}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Wrench className="size-5 text-primary" />
            Ferramentas
          </h2>
          <p className="text-sm text-muted-foreground">
            Produza e prospecte sem sair do hub.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {ferramentas.map((f) => (
            <CategoriaCard
              key={f.titulo}
              href={f.href}
              titulo={f.titulo}
              subtitulo={f.subtitulo}
              capa={f.capa}
              emBreve={f.emBreve}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Gem className="size-5 text-primary" />
            Área Membro
          </h2>
          <p className="text-sm text-muted-foreground">
            Tutoriais e ebooks pra você vender mais. Clique pra assistir e ler.
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
