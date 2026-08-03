import Image from "next/image";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

/**
 * Marca do app: o V neon + wordmark. O brilho "respira" (pulsa devagar) via CSS,
 * pra dar o efeito de neon vivo sem virar vídeo pesado. Quem tem "reduzir
 * movimento" ligado no sistema vê o V parado, com o brilho fixo.
 *
 * `size` controla o ícone; o texto acompanha.
 */
export function BrandMark({
  className,
  showName = true,
  size = 36,
}: {
  className?: string;
  showName?: boolean;
  size?: number;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className="relative grid shrink-0 place-items-center [animation:neon-respira_2.4s_ease-in-out_infinite] motion-reduce:animate-none"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Image
          src="/marca/logo.png"
          alt=""
          width={size}
          height={size}
          priority
          className="h-full w-full object-contain"
        />
      </span>
      {showName && (
        <span className="text-xl font-semibold tracking-tight text-foreground">
          {brand.name}
        </span>
      )}
    </div>
  );
}
