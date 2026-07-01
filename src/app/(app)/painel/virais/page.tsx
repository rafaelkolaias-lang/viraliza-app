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

// cortes sem nicho (só o link) caem nesse balde
const BUCKET_SEM_NICHO = "Achadinhos";

/** Usa a categoria REAL do vídeo (vinda do "Nicho: X" da legenda). */
function nichoDe(v: ViralVideo): string {
  return v.categoria?.trim() || BUCKET_SEM_NICHO;
}

function href(nicho: string) {
  return `/painel/virais/todos?nicho=${encodeURIComponent(nicho)}`;
}

// quantos aparecem na prateleira antes do "Ver todos" (o resto abre na grade)
const POR_PRATELEIRA = 20;

export default async function ViraisPage() {
  await requireAssinatura();
  const videos = await getViralVideos();

  // mais novos primeiro
  const ordenados = [...videos].sort((a, b) =>
    (b.adicionadoEm || "").localeCompare(a.adicionadoEm || ""),
  );

  // "em alta" = os que vieram com nicho (🔥); se não houver, os mais novos
  const emAlta = ordenados.filter((v) => v.emAlta);
  const destaque = (emAlta.length ? emAlta : ordenados).slice(0, POR_PRATELEIRA);

  // agrupa por nicho (categoria real)
  const porNicho = new Map<string, ViralVideo[]>();
  for (const v of ordenados) {
    const n = nichoDe(v);
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
          {/* Cortes em alta (com nicho / mais novos) */}
          <Prateleira titulo="🔥 Em alta agora" verTodosHref="/painel/virais/todos">
            {destaque.map((v) => (
              <CapaCorte key={v.id} video={v} />
            ))}
          </Prateleira>

          {/* Uma prateleira por nicho - "Ver todos" abre a grade paginada com TUDO */}
          {nichos.map(([nicho, lista]) => (
            <Prateleira
              key={nicho}
              titulo={`${nicho} (${lista.length.toLocaleString("pt-BR")})`}
              verTodosHref={lista.length > POR_PRATELEIRA ? href(nicho) : undefined}
            >
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
