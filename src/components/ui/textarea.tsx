import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `min-w-0` junto do `field-sizing-content` (11/08/2026): com o field-sizing o
 * campo PEDE a largura do que está escrito nele - e, num campo vazio, a do
 * placeholder. Dentro de um flex/grid, `min-width: auto` transforma esse pedido
 * em largura mínima que ninguém consegue encolher: no celular, um placeholder
 * de uma frase esticava a coluna inteira e a página ganhava rolagem lateral.
 * Com o zero, o `w-full` manda e o texto quebra linha, que é o certo.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
