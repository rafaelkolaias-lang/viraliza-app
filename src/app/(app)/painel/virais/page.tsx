import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { PrateleiraVirais } from "@/components/hub/prateleira-virais";
import { getPrateleirasVirais, getTotalVirais } from "@/lib/virais";
import { requireAssinatura } from "@/lib/dal";

export const metadata: Metadata = { title: "Cortes" };
export const dynamic = "force-dynamic";

function href(nicho: string) {
  return `/painel/virais/todos?nicho=${encodeURIComponent(nicho)}`;
}

const POR_PRATELEIRA = 20;

export default async function ViraisPage() {
  await requireAssinatura();
  // semente de rotação por visita: gira as prateleiras de nicho a cada entrada
  // (a página é force-dynamic, então cada acesso gera uma nova).
  const rotacaoSeed = Math.floor(Math.random() * 1_000_000_000) + 1;
  const [{ emAlta, emAltaTotal, nichos }, total] = await Promise.all([
    getPrateleirasVirais(POR_PRATELEIRA, 14, rotacaoSeed),
    getTotalVirais(),
  ]);

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/12 via-card to-background p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            <Flame className="size-3.5 fill-white" />
            Atualiza sozinho, todo dia
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Cortes Shopee virais
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            {total.toLocaleString("pt-BR")} cortes prontos pra postar, separados por
            nicho. Passe o mouse pra assistir, baixe ou edite com um clique.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
          <Flame className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum corte ainda</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Assim que o bot do Telegram baixar vídeos novos, eles aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          <PrateleiraVirais
            titulo="Em alta agora"
            verTodosHref="/painel/virais/todos"
            itensIniciais={emAlta}
            total={emAltaTotal}
            emAlta
            porPagina={POR_PRATELEIRA}
          />

          {nichos.map((n) => (
            <PrateleiraVirais
              key={n.nicho}
              titulo={`${n.nicho} (${n.total.toLocaleString("pt-BR")})`}
              verTodosHref={n.total > n.itens.length ? href(n.nicho) : undefined}
              itensIniciais={n.itens}
              total={n.total}
              nicho={n.nicho}
              porPagina={POR_PRATELEIRA}
              rotacaoSeed={rotacaoSeed}
            />
          ))}
        </>
      )}
    </div>
  );
}
