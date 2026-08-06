/**
 * Marcas dos meios de pagamento aceitos, desenhadas em SVG aqui mesmo.
 *
 * Por que não é imagem: PNG de logo baixado por aí vem com fundo errado, borda
 * serrilhada e peso, e checkout com bandeira feia passa a impressão contrária da
 * que a gente quer. SVG inline escala em qualquer tela, não faz request e sempre
 * fica nítido. As formas são simplificadas de propósito (a intenção é
 * reconhecimento, não reprodução da marca registrada).
 *
 * Server component: é só desenho, não tem estado.
 */

function Cartao({ children, titulo }: { children: React.ReactNode; titulo: string }) {
  return (
    <span
      title={titulo}
      className="inline-flex h-7 w-11 items-center justify-center rounded-[5px] border border-black/10 bg-white shadow-sm"
    >
      {children}
    </span>
  );
}

function Visa() {
  return (
    <Cartao titulo="Visa">
      <svg viewBox="0 0 48 16" className="h-3 w-8" aria-label="Visa">
        <text
          x="24"
          y="13"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="15"
          fontWeight="700"
          fontStyle="italic"
          letterSpacing="0.5"
          fill="#1434CB"
        >
          VISA
        </text>
      </svg>
    </Cartao>
  );
}

function Mastercard() {
  return (
    <Cartao titulo="Mastercard">
      <svg viewBox="0 0 40 24" className="h-4 w-7" aria-label="Mastercard">
        <circle cx="15" cy="12" r="9" fill="#EB001B" />
        <circle cx="25" cy="12" r="9" fill="#F79E1B" />
        {/* a interseção laranja escura é o que faz o olho reconhecer a marca */}
        <path
          d="M20 5.2a9 9 0 0 0 0 13.6 9 9 0 0 0 0-13.6z"
          fill="#FF5F00"
        />
      </svg>
    </Cartao>
  );
}

function Elo() {
  return (
    <Cartao titulo="Elo">
      <svg viewBox="0 0 40 24" className="h-4 w-8" aria-label="Elo">
        <circle cx="9" cy="12" r="6.5" fill="#00A4E0" />
        <circle cx="9" cy="12" r="2.6" fill="#fff" />
        <text
          x="24"
          y="17"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="12"
          fontWeight="700"
          fill="#000"
        >
          elo
        </text>
      </svg>
    </Cartao>
  );
}

function Amex() {
  return (
    <span
      title="American Express"
      className="inline-flex h-7 w-11 items-center justify-center rounded-[5px] bg-[#006FCF] shadow-sm"
    >
      <svg viewBox="0 0 48 16" className="h-3 w-9" aria-label="American Express">
        <text
          x="24"
          y="12"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="10"
          fontWeight="800"
          letterSpacing="0.4"
          fill="#fff"
        >
          AMEX
        </text>
      </svg>
    </span>
  );
}

function Hipercard() {
  return (
    <span
      title="Hipercard"
      className="inline-flex h-7 w-11 items-center justify-center rounded-[5px] bg-[#B3131B] shadow-sm"
    >
      <svg viewBox="0 0 48 16" className="h-3 w-9" aria-label="Hipercard">
        <text
          x="24"
          y="12"
          textAnchor="middle"
          fontFamily="Helvetica, Arial, sans-serif"
          fontSize="10"
          fontWeight="800"
          letterSpacing="0.2"
          fill="#fff"
        >
          HIPER
        </text>
      </svg>
    </span>
  );
}

export function BandeiraPix({ className = "size-5" }: { className?: string }) {
  // marca do Pix (Banco Central): quatro pontas de seta fechando um losango
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Pix">
      <g fill="#32BCAD">
        <path d="M22.06 21.3a4.3 4.3 0 0 1-3.05-1.26l-2.44-2.45a.85.85 0 0 0-1.17 0l-2.45 2.45a4.3 4.3 0 0 1-3.05 1.26h-.48l3.09 3.1a4.94 4.94 0 0 0 6.99 0l3.1-3.1h-.54z" />
        <path d="M9.9 10.68a4.3 4.3 0 0 1 3.05 1.26l2.45 2.45a.83.83 0 0 0 1.17 0l2.44-2.44a4.3 4.3 0 0 1 3.05-1.27h.54l-3.1-3.09a4.94 4.94 0 0 0-6.99 0l-3.09 3.09h.48z" />
        <path d="M27.02 12.5l-2.62-2.62a.64.64 0 0 1-.24.05h-1.6a3.05 3.05 0 0 0-2.14.89l-2.44 2.44a2.14 2.14 0 0 1-3.02 0l-2.45-2.45a3.05 3.05 0 0 0-2.14-.88h-1.6a.64.64 0 0 1-.23-.05L4.98 12.5a4.94 4.94 0 0 0 0 6.99l2.56 2.56c.07-.03.15-.05.23-.05h1.6a3.05 3.05 0 0 0 2.14-.89l2.45-2.45a2.2 2.2 0 0 1 3.02 0l2.44 2.44a3.05 3.05 0 0 0 2.14.89h1.6c.09 0 .17.02.24.05l2.62-2.61a4.94 4.94 0 0 0 0-6.93z" />
      </g>
    </svg>
  );
}

function Pix() {
  return (
    <Cartao titulo="Pix">
      <BandeiraPix className="size-5" />
    </Cartao>
  );
}

/** Fileira "Aceitamos": as cinco bandeiras mais o Pix. */
export function Bandeiras({ comPix = true }: { comPix?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Visa />
      <Mastercard />
      <Elo />
      <Amex />
      <Hipercard />
      {comPix ? <Pix /> : null}
    </div>
  );
}
