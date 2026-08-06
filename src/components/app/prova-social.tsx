"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";

/**
 * Notificação de "fulano acabou de assinar" no canto da tela.
 *
 * Os nomes vêm das compras REAIS da plataforma (rota /api/publico/vendas-recentes),
 * já picotados no servidor. Se não houver venda na janela, nada aparece: melhor
 * caixa vazia do que caixa mentirosa, que é o tipo de coisa que a pessoa checa
 * justamente quando está decidindo pagar.
 */

type Venda = { nome: string; oque: string; minutos: number };

const PRIMEIRA_ESPERA = 6_000; // deixa a pessoa ler a oferta antes do 1º pop
const TEMPO_NA_TELA = 5_500;
const INTERVALO = 12_000; // silêncio entre um pop e o próximo
const SAIDA = 500; // duração da animação de saída (bate com o duration-500)

function haQuantoTempo(min: number): string {
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function ProvaSocial() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [i, setI] = useState(0);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/publico/vendas-recentes")
      .then((r) => r.json())
      .then((d: { vendas?: Venda[] }) => {
        if (vivo && Array.isArray(d.vendas)) setVendas(d.vendas);
      })
      .catch(() => {
        // silêncio: a página de pagamento não pode piscar erro por causa disso
      });
    return () => {
      vivo = false;
    };
  }, []);

  // um ciclo por índice: espera, aparece, some, passa pro próximo. A troca de `i`
  // dispara o efeito de novo, e é isso que encadeia os pops.
  useEffect(() => {
    if (!vendas.length) return;
    const espera = i === 0 ? PRIMEIRA_ESPERA : INTERVALO;
    const abrir = setTimeout(() => setVisivel(true), espera);
    const fechar = setTimeout(() => setVisivel(false), espera + TEMPO_NA_TELA);
    const proximo = setTimeout(
      () => setI((n) => (n + 1) % vendas.length),
      espera + TEMPO_NA_TELA + SAIDA,
    );
    return () => {
      clearTimeout(abrir);
      clearTimeout(fechar);
      clearTimeout(proximo);
    };
  }, [vendas, i]);

  const v = vendas[i];
  if (!v) return null;

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)] transition-all duration-500 ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-3.5 py-2.5 shadow-xl backdrop-blur">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <ShoppingBag className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold">
            {v.nome} {v.oque}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {haQuantoTempo(v.minutos)} · compra verificada
          </span>
        </span>
      </div>
    </div>
  );
}
