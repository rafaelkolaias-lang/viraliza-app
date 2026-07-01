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
          <BrandMark size={40} />
        </Link>
        {children}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos Termos e Política de Privacidade.
        </p>
      </div>
    </main>
  );
}
