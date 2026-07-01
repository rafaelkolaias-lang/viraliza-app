import Link from "next/link";
import { Flame, Download, ShoppingBag, Wrench } from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

// Mosaico fixo do herói: Shopee, TikTok e YouTube.
const MOSAICO = ["/capas/shopee.png", "/capas/tiktok.png", "/capas/youtube.png"];

/**
 * Herói do hub - banner de boas-vindas com as estatísticas reais e CTAs.
 * À direita, um mosaico de capas dos cortes mais novos (só desktop).
 */
export function HeroHub({
  nome,
  totalCortes,
  totalProdutos,
}: {
  nome: string;
  totalCortes: number;
  totalProdutos: number;
}) {
  const primeiroNome = nome.split(" ")[0];
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-grid-glow p-6 md:p-9">
      <div className="grain absolute inset-0" />
      <div className="relative grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
        {/* texto */}
        <div className="animate-rise">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Flame className="size-3.5" />
            Central de virais
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-glow md:text-4xl">
            Oi, {primeiroNome} 👋
            <br />
            seu acervo de cortes prontos pra postar.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
            <strong className="text-foreground">{fmt(totalCortes)} cortes virais</strong>{" "}
            e <strong className="text-foreground">{fmt(totalProdutos)} produtos</strong>{" "}
            esperando você. Baixe, poste e venda - sem gravar nada.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/painel/virais"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Download className="size-4" />
              Explorar cortes
            </Link>
            <Link
              href="/painel/produtos"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold transition-colors hover:border-primary/50"
            >
              <ShoppingBag className="size-4" />
              Produtos
            </Link>
            <Link
              href="/painel/ferramentas"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold transition-colors hover:border-primary/50"
            >
              <Wrench className="size-4" />
              Ferramentas
            </Link>
          </div>
        </div>

        {/* mosaico de capas (desktop) - Shopee, TikTok, YouTube */}
        <div className="relative hidden h-64 md:block">
          <div className="absolute inset-0 flex items-center justify-end gap-3">
            {MOSAICO.map((src, i) => (
              <div
                key={src}
                className="aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl border border-border shadow-xl"
                style={{
                  transform: `translateY(${i === 1 ? -16 : i === 0 ? 14 : 6}px) rotate(${
                    i === 0 ? -4 : i === 2 ? 4 : 0
                  }deg)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
