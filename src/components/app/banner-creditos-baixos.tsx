"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CAKTO_2500_URL,
  CREDITOS_PROMO,
  PRECO_PROMO,
  LIMITE_BANNER_BAIXO,
} from "@/lib/promos";

// 1 crédito = R$ 0,01, então o saldo em centavos é o próprio nº de créditos.
function fmtCreditos(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

/** Avisa o React quando o "fechado nesta sessão" muda. */
function subscribe(cb: () => void) {
  window.addEventListener("banner-creditos", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("banner-creditos", cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Banner fixo no topo pra quem está com pouco crédito (saldo < 1000): oferece o
 * pacote promocional de 2.500 créditos por R$20. Tem "x" que fecha na sessão
 * atual (sessionStorage), mas volta a aparecer no próximo acesso/login. Some
 * sozinho quando o saldo passa do limite.
 */
export function BannerCreditosBaixos({ saldoCentavos }: { saldoCentavos: number }) {
  // lido como estado externo pra não quebrar a hidratação (no servidor = aberto).
  const fechado = useSyncExternalStore(
    subscribe,
    () => sessionStorage.getItem("banner_creditos_fechado") === "1",
    () => false,
  );

  if (saldoCentavos >= LIMITE_BANNER_BAIXO) return null;
  if (fechado) return null;

  function fechar() {
    sessionStorage.setItem("banner_creditos_fechado", "1");
    window.dispatchEvent(new Event("banner-creditos"));
  }

  return (
    <div className="fixed left-1/2 top-[3.75rem] z-40 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 md:top-4 md:left-[calc(50%+8rem)]">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 px-3 py-2.5 shadow-lg backdrop-blur-md sm:px-4">
        <span className="hidden shrink-0 place-items-center rounded-xl bg-amber-500/20 p-2 text-amber-500 sm:grid">
          <Zap className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-foreground">
            🔥 Tá acabando o crédito! Leve {fmtCreditos(CREDITOS_PROMO)} por só{" "}
            {PRECO_PROMO}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Você tem {fmtCreditos(saldoCentavos)} créditos. Reponha e continue criando.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 bg-amber-500 text-white hover:bg-amber-600"
          render={<Link href={CAKTO_2500_URL} />}
        >
          Aproveitar
        </Button>
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
