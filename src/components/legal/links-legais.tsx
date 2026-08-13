import Link from "next/link";
import { DOCUMENTOS } from "@/lib/legal";
import { cn } from "@/lib/utils";

/**
 * Linha com os três documentos legais, pra pôr PERTO DO BOTÃO DE PAGAR.
 *
 * O motivo é jurídico, não decorativo: pelo art. 46 do CDC o contrato só obriga
 * o consumidor se ele teve a chance de conhecer o conteúdo ANTES de contratar.
 * Documento que só aparece depois do pagamento não vale contra quem pagou.
 */
export function LinksLegais({
  aviso = "Ao comprar, você concorda com os documentos abaixo.",
  className,
}: {
  aviso?: string;
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {aviso}{" "}
      {DOCUMENTOS.map((d, i) => (
        <span key={d.href}>
          {i > 0 && (i === DOCUMENTOS.length - 1 ? " e " : ", ")}
          <Link
            href={d.href}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {d.titulo}
          </Link>
        </span>
      ))}
      .
    </p>
  );
}
