import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  ATUALIZADO_EM,
  DOCUMENTOS,
  dadosDaEmpresaPendentes,
} from "@/lib/legal";

/**
 * Moldura dos três documentos legais. Existe pra que Termos, Privacidade e
 * Reembolso tenham exatamente a mesma cara e a mesma navegação: documento legal
 * com visual diferente do irmão passa impressão de improviso.
 *
 * Também é aqui que mora o aviso de dados pendentes, pra ninguém publicar sem
 * querer uma página com "PENDENTE" no lugar do CNPJ.
 */
export function PaginaLegal({
  titulo,
  versao,
  children,
}: {
  titulo: string;
  versao: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      {dadosDaEmpresaPendentes && (
        <div className="mb-8 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <b>Documento ainda não publicável.</b> Falta preencher razão social,
            CNPJ e endereço em <code>src/lib/legal.ts</code>. Este aviso some
            sozinho quando os três campos forem preenchidos.
          </p>
        </div>
      )}

      <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Versão {versao} | Última atualização: {ATUALIZADO_EM}
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed">{children}</div>

      <nav className="mt-12 border-t pt-6 text-sm">
        <p className="mb-3 font-medium">Outros documentos</p>
        <ul className="space-y-1">
          {DOCUMENTOS.filter((d) => d.titulo !== titulo).map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                className="text-primary underline underline-offset-4"
              >
                {d.titulo}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/" className="text-primary underline underline-offset-4">
              Voltar pro início
            </Link>
          </li>
        </ul>
      </nav>
    </main>
  );
}

/** Uma seção numerada do documento. */
export function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
