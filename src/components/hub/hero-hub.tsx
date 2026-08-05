import Link from "next/link";
import {
  Clapperboard,
  Coins,
  Crown,
  LayoutGrid,
  LifeBuoy,
  Sparkles,
} from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

// Mosaico fixo do herói: Shopee, TikTok e YouTube.
const MOSAICO = ["/capas/shopee.png", "/capas/tiktok.png", "/capas/youtube.png"];

/**
 * Herói da tela de Início: boas-vindas + o estado da conta em uma olhada.
 *
 * Ele ANUNCIA a plataforma inteira, e não só o acervo. O texto antigo dizia
 * "seu acervo de cortes prontos pra postar", o que era verdade quando a
 * plataforma era só biblioteca; hoje o carro-chefe é gerar vídeo com IA, e
 * quem caía aqui não tinha pista disso.
 *
 * As tarjinhas de status (crédito, assinatura, vídeos) são LINKS: elas são o
 * caminho mais curto pro que a pessoa costuma querer depois de olhar o número.
 *
 * Tudo é renderizado no servidor (a tela é Server Component), então a data da
 * assinatura já chega pronta como texto e não existe risco de hydration.
 */
export function HeroHub({
  nome,
  saldoCentavos,
  assinaturaTexto,
  assinaturaAtiva,
  prontos,
  emProducao,
}: {
  nome: string;
  /** saldo da carteira em centavos (1 crédito = R$ 0,01) */
  saldoCentavos: number;
  /** já formatado pelo servidor, ex.: "Assinatura até 12/09" */
  assinaturaTexto: string;
  assinaturaAtiva: boolean;
  prontos: number;
  emProducao: number;
}) {
  const primeiroNome = nome.split(" ")[0];

  const tarja =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-grid-glow p-6 md:p-9">
      <div className="grain absolute inset-0" />
      <div className="relative grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
        {/* texto */}
        <div className="animate-rise">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Tudo da plataforma em um lugar
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-glow md:text-4xl">
            Oi, {primeiroNome} 👋
            <br />o que você vai criar hoje?
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
            Abaixo está <strong className="text-foreground">tudo</strong> que a
            plataforma faz: criar vídeo com IA, montar e cortar os seus, achar
            clientes e baixar conteúdo pronto pra postar.
          </p>

          {/* estado da conta, em tarjinhas clicáveis */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/painel/creditos"
              className={`${tarja} border-primary/30 bg-primary/10 text-primary hover:border-primary/60`}
            >
              <Coins className="size-3.5" />
              {fmt(saldoCentavos)} créditos
            </Link>

            <Link
              href="/painel/assinatura"
              className={
                assinaturaAtiva
                  ? `${tarja} border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/60`
                  : `${tarja} border-amber-500/40 bg-amber-500/10 text-amber-400 hover:border-amber-500/70`
              }
            >
              <Crown className="size-3.5" />
              {assinaturaTexto}
            </Link>

            <Link
              href="/painel"
              className={`${tarja} border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground`}
            >
              <Clapperboard className="size-3.5" />
              {fmt(prontos)} {prontos === 1 ? "vídeo pronto" : "vídeos prontos"}
            </Link>

            {emProducao > 0 && (
              <Link
                href="/painel"
                className={`${tarja} border-amber-500/40 bg-amber-500/10 text-amber-400 hover:border-amber-500/70`}
              >
                <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
                {fmt(emProducao)} em produção
              </Link>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/painel/lab"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles className="size-4" />
              Criar com IA
            </Link>
            <Link
              href="/painel"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold transition-colors hover:border-primary/50"
            >
              <LayoutGrid className="size-4" />
              Meus vídeos
            </Link>
            <Link
              href="/painel/ajuda"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-semibold transition-colors hover:border-primary/50"
            >
              <LifeBuoy className="size-4" />
              Como funciona
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
