import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, MessageCircle, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/dal";
import { GRUPOS_AJUDA, numeroDaSecao } from "@/lib/ajuda-indice";
import { AjudaComecar } from "@/components/app/ajuda-comecar";
import { AjudaInfluenciador } from "@/components/app/ajuda-influenciador";
import { AjudaVideos } from "@/components/app/ajuda-videos";
import { AjudaFerramentas } from "@/components/app/ajuda-ferramentas";
import { AjudaConta } from "@/components/app/ajuda-conta";

export const metadata: Metadata = { title: "Ajuda" };
export const dynamic = "force-dynamic";

/**
 * CENTRAL DE AJUDA: o manual da plataforma escrito pra quem nunca mexeu em nada
 * parecido. A régua é a pessoa mais perdida: nada de "configure o avatar", e sim
 * "clique no botão verde escrito Criar com IA".
 *
 * Montagem: índice fixo à esquerda (âncoras) + grupos de seções à direita. O
 * conteúdo mora em `components/app/ajuda-*.tsx` e a numeração em
 * `lib/ajuda-indice.ts` - mexer na ordem lá arruma o índice e os títulos juntos.
 */
export default async function AjudaPage() {
  await requireUser();

  // WhatsApp do suporte vem do ambiente (mesmo número dos e-mails). Sem número
  // configurado, o botão manda pra tela de sugestões em vez de quebrar.
  const zap = (process.env.WHATSAPP_SUPORTE || "").replace(/\D/g, "");
  const linkSuporte = zap ? `https://wa.me/55${zap}` : "/painel/sugestoes";
  const suporteExterno = Boolean(zap);

  return (
    <div className="space-y-6">
      {/* ===== TOPO ===== */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-grid-glow p-6 md:p-8">
        <div className="grain absolute inset-0" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <LifeBuoy className="size-3.5" />
              Central de ajuda
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-glow md:text-4xl">
              Como usar o Viraliza
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
              Explicado devagar, do jeito mais simples possível, com o nome dos botões
              que você vê na tela. Se travar em qualquer ponto, é só chamar a gente.
            </p>
          </div>

          <a
            href={linkSuporte}
            target={suporteExterno ? "_blank" : undefined}
            rel={suporteExterno ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50"
          >
            <MessageCircle className="size-4 text-primary" />
            Falar com o suporte
          </a>
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ===== ÍNDICE ===== */}
        <aside className="hidden w-64 shrink-0 lg:sticky lg:top-6 lg:block">
          <nav className="max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-border bg-card p-4">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Conteúdo
            </p>
            {GRUPOS_AJUDA.map((g) => (
              <div key={g.grupo} className="mt-4 first:mt-3">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-primary/70">
                  {g.grupo}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {g.itens.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="flex gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <span className="text-primary/60">{numeroDaSecao(s.id)}</span>
                        {s.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* ===== CONTEÚDO ===== */}
        <div className="min-w-0 flex-1 space-y-5">
          <AjudaComecar />
          <AjudaInfluenciador />
          <AjudaVideos />
          <AjudaFerramentas />
          <AjudaConta linkSuporte={linkSuporte} suporteExterno={suporteExterno} />

          {/* ===== RODAPÉ ===== */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card p-5 text-center text-sm">
            <Sparkles className="size-4 text-primary" />
            <span className="text-muted-foreground">Não encontrou o que procurava?</span>
            <a
              href={linkSuporte}
              target={suporteExterno ? "_blank" : undefined}
              rel={suporteExterno ? "noopener noreferrer" : undefined}
              className="font-semibold text-primary hover:underline"
            >
              Falar com o suporte
            </a>
            <span className="text-muted-foreground/50">ou</span>
            <Link href="/painel/sugestoes" className="font-semibold text-primary hover:underline">
              deixar uma sugestão
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
