import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";

/**
 * Marca do app: ícone geométrico (play) + wordmark.
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
        className="relative grid place-items-center rounded-[10px] bg-primary shadow-[0_0_24px_-4px_var(--color-primary)]"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          width={size * 0.46}
          height={size * 0.46}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M6 4.5c0-1.2 1.3-1.9 2.3-1.3l11 7.5c.9.6.9 2 0 2.6l-11 7.5c-1 .6-2.3 0-2.3-1.3V4.5Z"
            fill="var(--color-primary-foreground)"
          />
        </svg>
      </span>
      {showName && (
        <span className="text-xl font-semibold tracking-tight text-foreground">
          {brand.name}
        </span>
      )}
    </div>
  );
}
