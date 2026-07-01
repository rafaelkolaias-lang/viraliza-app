import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { Prateleira } from "@/components/hub/prateleira";
import { CapaCorte } from "@/components/hub/capa-corte";
import { getViralVideos } from "@/lib/virais";
import { requireAssinatura } from "@/lib/dal";
import type { ViralVideo } from "@/lib/types";

export const metadata: Metadata = { title: "Cortes" };

// sempre lê o virais.json fresco (pra aparecer o que o bot acabou de baixar)
export const dynamic = "force-dynamic";

/** "Nicho: Cozinha" -> "Cozinha". Sem padrão, usa o próprio título. */
function nichoDe(titulo: string): string {
  const m = /nicho:\s*(.+)/i.exec(titulo || "");
  return (m ? m[1] : titulo || "Geral").trim();
}

const POR_PRATELEIRA = 24;

export default async function ViraisPage() {
  await requireAssinatura();
  const videos = await getViralVideos();

  // mais novos primeiro
  const ordenados = [...videos].sort((a, b) =>
    (b.adicionadoEm || "").localeCompare(a.adicionadoEm || ""),
  );

  // agrupa por nicho
  const porNicho = new Map<string, ViralVideo[]>();
  for (const v of ordenados) {
    const n = nichoDe(v.titulo);
    const lista = porNicho.get(n);
    if (lista) lista.push(v);
    else porNicho.set(n, [v]);
  }
  // nichos com mais itens primeiro
  const nichos = [...porNicho.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Flame className="size-6 text-orange-400" />
          Cortes Shopee
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {videos.length.toLocaleString("pt-BR")} cortes prontos pra postar -
          separados por nicho. Arraste de lado e baixe o que quiser.
        </p>
      </div>

      {videos.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border py-20 text-center">
          <Flame className="size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhum corte ainda</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Assim que o bot do Telegram baixar vídeos novos, eles aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Cortes em alta (mais novos, de todos os nichos) */}
          <Prateleira titulo="🔥 Em alta agora">
            {ordenados.slice(0, POR_PRATELEIRA).map((v) => (
              <CapaCorte key={v.id} video={v} />
            ))}
          </Prateleira>

          {/* Uma prateleira por nicho */}
          {nichos.map(([nicho, lista]) => (
            <Prateleira key={nicho} titulo={nicho}>
              {lista.slice(0, POR_PRATELEIRA).map((v) => (
                <CapaCorte key={v.id} video={v} />
              ))}
            </Prateleira>
          ))}
        </>
      )}
    </div>
  );
}
