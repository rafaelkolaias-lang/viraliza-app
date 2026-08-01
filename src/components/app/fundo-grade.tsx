/**
 * Fundo do laboratório: grade quadriculada cobrindo a tela toda (fixed, então
 * acompanha o scroll), com brilho verde no topo e nas bordas escurecendo pra não
 * competir com o conteúdo. Nasceu no Viraliza Labs e virou a cara das telas de
 * criação (Labs, Meus avatares).
 */
export function FundoGrade() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[44px_44px] opacity-50 sm:bg-size-[56px_56px]" />
      <div className="absolute left-1/2 top-0 size-[680px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/12 blur-3xl" />
      <div className="absolute -bottom-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-primary/6 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_10%,transparent_20%,var(--background)_95%)]" />
    </div>
  );
}
