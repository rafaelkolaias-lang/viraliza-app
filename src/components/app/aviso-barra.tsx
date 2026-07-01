import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AvisoDTO } from "@/lib/notificacoes";

// Cor escolhida pelo admin -> classe da faixa. Texto branco em todas.
const COR_CLASSE: Record<AvisoDTO["cor"], string> = {
  laranja: "bg-orange-500",
  vermelho: "bg-red-600",
  azul: "bg-blue-600",
  verde: "bg-emerald-600",
};

function Faixa({ aviso }: { aviso: AvisoDTO }) {
  const classe = COR_CLASSE[aviso.cor] ?? COR_CLASSE.azul;
  const externo = /^https?:\/\//i.test(aviso.link ?? "");

  const conteudo = (
    <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium">
      <span>{aviso.mensagem}</span>
      {aviso.link && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold underline underline-offset-2">
          Ver <ArrowRight className="size-3.5" />
        </span>
      )}
    </div>
  );

  if (!aviso.link) {
    return <div className={`${classe} text-white`}>{conteudo}</div>;
  }

  return (
    <div className={`${classe} text-white transition-opacity hover:opacity-95`}>
      {externo ? (
        <a href={aviso.link} target="_blank" rel="noopener noreferrer" className="block">
          {conteudo}
        </a>
      ) : (
        <Link href={aviso.link} className="block">
          {conteudo}
        </Link>
      )}
    </div>
  );
}

/** Barras horizontais fixas no topo (uma abaixo da outra se houver mais de uma). */
export function AvisoBarra({ avisos }: { avisos: AvisoDTO[] }) {
  if (!avisos || avisos.length === 0) return null;
  return (
    <div className="flex flex-col">
      {avisos.map((a) => (
        <Faixa key={a.id} aviso={a} />
      ))}
    </div>
  );
}
