import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

/**
 * Moldura das telas de auth: fundo escuro com brilho verde + grão,
 * marca no topo e o conteúdo (card) centralizado. Responsivo.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-grid-glow grain relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div className="animate-rise relative z-10 flex w-full max-w-[420px] flex-col items-center">
        <Link href="/" className="mb-8">
          <BrandMark size={56} />
        </Link>
        {children}
        {/* Estes links são a prova de que a pessoa teve acesso aos documentos
            antes de contratar (art. 46 do CDC). Antes eram texto morto, sem
            link e sem documento existindo: não apagar nem tirar o href. */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com os nossos{" "}
          <Link href="/termos" className="underline underline-offset-4 hover:text-foreground">
            Termos de Uso
          </Link>
          , a{" "}
          <Link
            href="/privacidade"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Política de Privacidade
          </Link>{" "}
          e a{" "}
          <Link
            href="/reembolso"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Política de Reembolso
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
