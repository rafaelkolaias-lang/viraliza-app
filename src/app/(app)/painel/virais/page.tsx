import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { Prateleira } from "@/components/hub/prateleira";
import { CapaCorte } from "@/components/hub/capa-corte";
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
  const [{ emAlta, nichos }, total] = await Promise.all([
    getPrateleirasVirais(POR_PRATELEIRA),
    getTotalVirais(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Flame className="size-6 text-orange-400" />
          Cortes Shopee
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total.toLocaleString("pt-BR")} cortes prontos pra postar - separados por
          nicho. Arraste de lado e baixe o que quiser.
        </p>
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
          <Prateleira titulo="🔥 Em alta agora" verTodosHref="/painel/virais/todos">
            {emAlta.map((v) => (
              <CapaCorte key={v.id} video={v} />
            ))}
          </Prateleira>

          {nichos.map((n) => (
            <Prateleira
              key={n.nicho}
              titulo={`${n.nicho} (${n.total.toLocaleString("pt-BR")})`}
              verTodosHref={n.total > n.itens.length ? href(n.nicho) : undefined}
            >
              {n.itens.map((v) => (
                <CapaCorte key={v.id} video={v} />
              ))}
            </Prateleira>
          ))}
        </>
      )}
    </div>
  );
}
