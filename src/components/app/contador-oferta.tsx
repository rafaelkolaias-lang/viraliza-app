"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

/**
 * Contagem regressiva do desconto.
 *
 * O prazo fica no sessionStorage, então recarregar a página NÃO devolve os 15
 * minutos: quem chegou às 10h tem o mesmo relógio às 10h10. Contador que reseta
 * sozinho a cada F5 é o tipo de coisa que a pessoa testa, percebe e usa como
 * motivo pra não confiar em mais nada da página.
 */

const CHAVE = "viraliza:oferta-ate";

function dois(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function ContadorOferta({ minutos }: { minutos: number }) {
  const [resta, setResta] = useState<number | null>(null);

  useEffect(() => {
    let fim = Number(sessionStorage.getItem(CHAVE) || 0);
    if (!fim || fim < Date.now()) {
      fim = Date.now() + minutos * 60_000;
      sessionStorage.setItem(CHAVE, String(fim));
    }
    const tick = () => setResta(Math.max(0, fim - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [minutos]);

  // primeira renderização no servidor não sabe o relógio: sai vazio pra não
  // piscar um valor errado antes de hidratar
  if (resta === null) return null;

  const seg = Math.floor(resta / 1000);
  const acabou = seg <= 0;

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5">
      <Timer className="size-4 shrink-0 text-primary" />
      <p className="text-xs leading-tight">
        {acabou ? (
          <>
            <b className="font-semibold">Corra:</b> este preço sai do ar a qualquer momento.
          </>
        ) : (
          <>
            <b className="font-semibold">Seu desconto está reservado por</b>{" "}
            <span className="font-mono text-sm font-bold tabular-nums text-primary">
              {dois(Math.floor(seg / 60))}:{dois(seg % 60)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
