import type { Metadata } from "next";
import { CorteEstudio } from "@/components/app/corte-estudio";
import { getCurrentUser } from "@/lib/dal";
import { getVideoParaCortar } from "@/lib/jobs";
import { midiaUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Criar um Corte",
};

/**
 * Criar um Corte: limpar um vídeo que a pessoa já tem no computador.
 *
 * Não confundir com "Cortes de qualquer vídeo" (`/painel/cortes`), que baixa de
 * um LINK e fatia em vários cortes com a IA escolhendo os melhores momentos.
 * Aqui é o arquivo local, sem IA: tira os pedaços ruins e o silêncio.
 */
export default async function CriarCortePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const user = await getCurrentUser();
  const bloqueado = user?.role === "demo";

  // "Cortar" em Meus vídeos: chega com o id do vídeo pronto e a timeline já abre
  // carregada, sem upload nenhum. O endereço do arquivo sai do BANCO (o link da
  // barra só traz o id), então ninguém consegue apontar a tela pra outro vídeo.
  const sp = await searchParams;
  const origem = sp.job && user ? await getVideoParaCortar(user.id, sp.job) : null;
  const videoInicial = origem
    ? { ...origem, url: midiaUrl(origem.url) ?? origem.url }
    : undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Criar um Corte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {videoInicial
            ? "Esse é um vídeo que você já gerou aqui. Tire os pedaços que não presta e o silêncio entre as falas: sai um corte novo, e o vídeo original continua intacto."
            : "Suba um vídeo do seu computador, tire os pedaços que não presta e o silêncio entre as falas. Sem IA e sem legenda: sai o seu vídeo, limpo, no formato de celular."}
        </p>
      </div>
      <CorteEstudio bloqueado={bloqueado} videoInicial={videoInicial} />
    </div>
  );
}
